const { app } = require('@azure/functions');

// Only these stores can be queried. Keeping the allowlist on the server
// stops the function from being used as an open proxy to any site.
const STORES = {
  playerscandc: 'https://playerscandc.com',
  manalounge: 'https://www.manalounge.ca',
  lamoodcomics: 'https://lamoodcomics.ca',
};

const MAX_QUERY_LENGTH = 200;
const UPSTREAM_TIMEOUT_MS = 10000;

const json = (status, body, extraHeaders = {}) => ({
  status,
  jsonBody: body,
  headers: { 'Cache-Control': 'no-store', ...extraHeaders },
});

const toProduct = (product, baseUrl) => ({
  title: product.title || 'Unknown Card',
  available: product.available === true,
  priceMin: parseFloat(product.price_min || product.price || '0'),
  priceMax: parseFloat(product.price_max || product.price || '0'),
  url: product.url ? `${baseUrl}${product.url}` : baseUrl,
  image: product.image || product.featured_image?.url || null,
});

app.http('search', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'search',
  handler: async (request, context) => {
    const storeKey = request.query.get('store') || '';
    const term = (request.query.get('q') || '').trim();

    const baseUrl = STORES[storeKey];
    if (!baseUrl) {
      return json(400, { error: `Unknown store "${storeKey}"`, stores: Object.keys(STORES) });
    }
    if (!term || term.length > MAX_QUERY_LENGTH) {
      return json(400, { error: `Query "q" must be 1-${MAX_QUERY_LENGTH} characters` });
    }

    const upstream = new URL('/search/suggest.json', baseUrl);
    upstream.searchParams.set('q', term);
    upstream.searchParams.set('resources[type]', 'product');
    upstream.searchParams.set('resources[limit]', '10');

    let response;
    try {
      response = await fetch(upstream, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; CardCouncil/1.0)',
        },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error.name === 'TimeoutError';
      context.warn(`${storeKey}: ${timedOut ? 'timed out' : error.message}`);
      return json(timedOut ? 504 : 502, { error: `Could not reach ${storeKey}` });
    }

    if (!response.ok) {
      context.warn(`${storeKey}: upstream returned ${response.status}`);
      // Pass rate limiting through so the client can back off and retry.
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        return json(429, { error: `${storeKey} is rate limiting requests` },
          retryAfter ? { 'Retry-After': retryAfter } : {});
      }
      return json(502, { error: `${storeKey} returned HTTP ${response.status}` });
    }

    let data;
    try {
      data = await response.json();
    } catch {
      return json(502, { error: `${storeKey} did not return JSON` });
    }

    const products = (data?.resources?.results?.products || []).map((p) => toProduct(p, baseUrl));

    // Short cache: stock changes, but repeat searches within a few minutes are common.
    return json(200, { store: storeKey, products }, { 'Cache-Control': 'public, max-age=300' });
  },
});
