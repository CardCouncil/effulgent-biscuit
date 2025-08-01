import React, { useState } from 'react';
import { Search, Loader2, ShoppingCart, ExternalLink, DollarSign, ChevronDown } from 'lucide-react';

interface CardResult {
  store: string;
  name: string;
  priceMin: number;
  priceMax: number;
  availability: string;
  url: string;
  image?: string;
  condition?: string;
}

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<CardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const stores = [
    { 
      name: 'Players C&C', 
      key: 'playerscandc', 
      url: 'https://playerscandc.com/',
      suggestApiUrl: 'https://playerscandc.com/search/suggest.json?q={term}&resources[type]=product&resources[limit]=10&section_id=predictive-search'
    },
    { 
      name: 'Mana Lounge', 
      key: 'manalounge', 
      url: 'https://www.manalounge.ca/',
      suggestApiUrl: 'https://www.manalounge.ca/search/suggest.json?q={term}&resources[type]=product&resources[limit]=10&section_id=predictive-search'
    },
    { 
      name: 'Lamood Comics', 
      key: 'lamoodcomics', 
      url: 'https://lamoodcomics.ca/',
      suggestApiUrl: 'https://lamoodcomics.ca/search/suggest.json?q={term}&resources[type]=product&resources[limit]=10&section_id=predictive-search'
    }
  ];

  const fetchSuggestions = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const response = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.data || []);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.warn('Error fetching suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Debounce function for API calls
  const debounce = (func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  };

  const debouncedFetchSuggestions = debounce(fetchSuggestions, 300);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedFetchSuggestions(value);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const searchCards = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a card name to search');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);
    setShowSuggestions(false);

    try {
      const searchPromises = stores.map(async (store) => {
        try {
          const encodedSearchTerm = encodeURIComponent(searchTerm.trim());
          const apiUrl = store.suggestApiUrl.replace('{term}', encodedSearchTerm);
          
          // Use CORS proxy directly since Shopify APIs always block direct calls
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`;
          const response = await fetch(proxyUrl);

          if (!response.ok) {
            throw new Error(`${store.name} search failed`);
          }

          const data = await response.json();
          
          // Parse Shopify predictive search response
          const products = data?.resources?.results?.products || [];
          
          const results: CardResult[] = products
            .filter((product: any) => product.available === true)
            .map((product: any) => ({
              store: store.name,
              name: product.title || 'Unknown Card',
              priceMin: parseFloat(product.price_min || '0'),
              priceMax: parseFloat(product.price_max || '0'),
              availability: 'In Stock',
              url: product.url ? `${store.url.replace(/\/$/, '')}${product.url}` : store.url,
              image: product.image || product.featured_image?.url,
              condition: 'NM'
            }));
          
          return results;
        } catch (error) {
          console.warn(`Error searching ${store.name}:`, error);
          return [];
        }
      });

      const allResults = await Promise.all(searchPromises);
      const flatResults = allResults.flat();
      
      if (flatResults.length === 0) {
        setError('No cards found. Try a different search term.');
      } else {
        setResults(flatResults.sort((a, b) => a.priceMin - b.priceMin));
      }
    } catch (error) {
      setError('An error occurred while searching. Please try again.');
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchCards();
  };

  const formatPriceRange = (priceMin: number, priceMax: number) => {
    if (priceMin === priceMax) {
      return `$${priceMin.toFixed(2)}`;
    }
    return `$${priceMin.toFixed(2)} - $${priceMax.toFixed(2)}`;
  };

  const getStoreColor = (store: string) => {
    const colors = {
      'Players C&C': 'bg-blue-500',
      'Mana Lounge': 'bg-purple-500',
      'Lamood Comics': 'bg-green-500'
    };
    return colors[store as keyof typeof colors] || 'bg-gray-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">MTG Price Finder</h1>
              <p className="text-purple-300 text-sm">Compare prices across local hobby stores</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Search Section */}
        <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-8 mb-8 border border-purple-500/20">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">Find Your MTG Cards</h2>
            <p className="text-purple-300">Search across all local stores to find the best prices</p>
          </div>

          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={handleInputChange}
                placeholder="Enter card name (e.g., 'Lightning Bolt', 'Black Lotus')"
                className="w-full pl-12 pr-12 py-4 bg-white/10 border border-purple-500/30 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              {loadingSuggestions && (
                <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 text-purple-400 w-5 h-5 animate-spin" />
              )}
              {!loadingSuggestions && suggestions.length > 0 && (
                <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 text-purple-400 w-5 h-5" />
              )}
              
              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-sm border border-purple-500/30 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                  {suggestions.slice(0, 10).map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left px-4 py-3 text-white hover:bg-purple-500/20 transition-colors border-b border-purple-500/10 last:border-b-0"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Searching stores...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>Search All Stores</span>
                </>
              )}
            </button>
          </form>

          {/* Store indicators */}
          <div className="flex justify-center space-x-6 mt-6">
            {stores.map((store) => (
              <div key={store.key} className="text-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1"></div>
                <span className="text-xs text-purple-300">{store.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-8">
            <p className="text-red-300 text-center">{error}</p>
          </div>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">
                Found {results.length} result{results.length !== 1 ? 's' : ''} for "{searchTerm}"
              </h3>
              <div className="text-purple-300 text-sm">
                Sorted by price (lowest first)
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {results.map((card, index) => (
                <div
                  key={index}
                  className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all hover:transform hover:scale-105"
                >
                  {/* Store Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getStoreColor(card.store)}`}>
                      {card.store}
                    </span>
                  </div>

                  {/* Card Info */}
                  <div className="space-y-4">
                    <h4 className="text-white font-semibold text-lg leading-tight">{card.name}</h4>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl font-bold text-green-400">
                          {formatPriceRange(card.priceMin, card.priceMax)}
                        </span>
                      </div>
                    </div>

                    <a
                      href={card.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center space-x-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 py-2 px-4 rounded-lg transition-all"
                    >
                      <span>View on Store</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && results.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-12 h-12 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Ready to Search</h3>
            <p className="text-purple-300">Enter a Magic: The Gathering card name to find the best prices</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-black/20 backdrop-blur-sm border-t border-purple-500/20 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-purple-300">
            <p className="mb-4">Searching across your local hobby stores:</p>
            <div className="flex justify-center space-x-8">
              {stores.map((store) => (
                <a
                  key={store.key}
                  href={store.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  {store.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;