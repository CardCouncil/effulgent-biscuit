import React, { useState } from 'react';
import { Search, Loader2, ShoppingCart, ExternalLink, DollarSign, ChevronDown, Plus, X, AlertTriangle, CheckCircle } from 'lucide-react';

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

interface CardSearchResult {
  cardName: string;
  status: 'found' | 'not_found' | 'no_inventory';
  results: CardResult[];
}
function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [cardList, setCardList] = useState('');
  const [searchResults, setSearchResults] = useState<CardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searchMode, setSearchMode] = useState<'single' | 'list'>('single');

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
      const url = `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
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

  // Retry function with exponential backoff
  const fetchWithRetry = async (url: string, maxRetries: number = 3): Promise<any> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        
        if (isLastAttempt) {
          throw error;
        }
        
        // Exponential backoff: wait 1s, then 2s, then 4s
        const waitTime = Math.pow(2, attempt - 1) * 1000;
        console.warn(`Attempt ${attempt} failed, retrying in ${waitTime}ms...`, error);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  };

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

  const addCardToList = () => {
    if (!searchTerm.trim()) return;
    
    const newCard = searchTerm.trim();
    const currentCards = cardList.split('\n').filter(card => card.trim() !== '');
    
    if (!currentCards.includes(newCard)) {
      const updatedList = currentCards.length > 0 
        ? currentCards.join('\n') + '\n' + newCard
        : newCard;
      setCardList(updatedList);
    }
    
    setSearchTerm('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const removeCardFromList = (cardToRemove: string) => {
    const currentCards = cardList.split('\n').filter(card => card.trim() !== '');
    const updatedCards = currentCards.filter(card => card !== cardToRemove);
    setCardList(updatedCards.join('\n'));
  };

  const validateCardName = async (cardName: string): Promise<boolean> => {
    try {
      const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName.trim())}`;
      const response = await fetch(url);
      return response.ok;
    } catch (error) {
      console.warn('Error validating card name:', error);
      return false;
    }
  };

  const searchSingleCard = async (cardName: string): Promise<CardSearchResult> => {
    // First validate the card name exists
    const isValidCard = await validateCardName(cardName);
    
    if (!isValidCard) {
      return {
        cardName,
        status: 'not_found',
        results: []
      };
    }

    const searchPromises = stores.map(async (store) => {
      try {
        const encodedSearchTerm = encodeURIComponent(cardName.trim());
        const apiUrl = store.suggestApiUrl.replace('{term}', encodedSearchTerm);
        
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`;
        const data = await fetchWithRetry(proxyUrl, 3);
        
        const products = data?.resources?.results?.products || [];
        
        const results: CardResult[] = products
          .filter((product: any) => product.available === true)
          .filter((product: any) => {
            // Check if the product title contains the card name (case insensitive)
            const productTitle = (product.title || '').toLowerCase();
            const searchCardName = cardName.toLowerCase();
            return productTitle.includes(searchCardName);
          })
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
        console.warn(`Failed to search ${store.name} for ${cardName}:`, error);
        return [];
      }
    });

    const allResults = await Promise.all(searchPromises);
    const flatResults = allResults.flat();
    
    return {
      cardName,
      status: flatResults.length > 0 ? 'found' : 'no_inventory',
      results: flatResults.sort((a, b) => a.priceMin - b.priceMin)
    };
  };

  const searchCards = async () => {
    const cardsToSearch = searchMode === 'single' 
      ? [searchTerm.trim()]
      : cardList.split('\n').map(card => card.trim()).filter(card => card !== '');

    if (cardsToSearch.length === 0) {
      setError(searchMode === 'single' ? 'Please enter a card name to search' : 'Please enter at least one card name');
      return;
    }

    setLoading(true);
    setError('');
    setSearchResults([]);
    setShowSuggestions(false);

    try {
      const results: CardSearchResult[] = [];
      
      // Process cards sequentially with delay
      for (let i = 0; i < cardsToSearch.length; i++) {
        const cardName = cardsToSearch[i];
        
        // Add delay between requests (except for the first one)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const result = await searchSingleCard(cardName);
        results.push(result);
        
        // Update results immediately as each card is processed
        setSearchResults([...results]);
      }
      
      // Final error summary after all cards are processed
      const totalFound = results.filter(r => r.status === 'found').length;
      const totalNotFound = results.filter(r => r.status === 'not_found').length;
      const totalNoInventory = results.filter(r => r.status === 'no_inventory').length;
      
      if (totalFound === 0 && totalNotFound === 0 && totalNoInventory === 0) {
        setError('No cards found. Please check your search terms.');
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
    if (searchMode === 'single') {
      searchCards();
    } else {
      searchCards();
    }
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

  const getStatusIcon = (status: CardSearchResult['status']) => {
    switch (status) {
      case 'found':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'not_found':
        return <X className="w-5 h-5 text-red-400" />;
      case 'no_inventory':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getStatusText = (status: CardSearchResult['status']) => {
    switch (status) {
      case 'found':
        return 'Found in stores';
      case 'not_found':
        return 'Card not recognized';
      case 'no_inventory':
        return 'No inventory available';
    }
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
            <p className="text-purple-300">Search across all local stores to find the best prices - single cards or bulk lists</p>
          </div>

          {/* Search Mode Toggle */}
          <div className="flex justify-center mb-6">
            <div className="bg-black/50 rounded-lg p-1 flex">
              <button
                type="button"
                onClick={() => setSearchMode('single')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  searchMode === 'single' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-purple-300 hover:text-white'
                }`}
              >
                Single Card
              </button>
              <button
                type="button"
                onClick={() => setSearchMode('list')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  searchMode === 'list' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-purple-300 hover:text-white'
                }`}
              >
                Multiple Cards
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
            {/* Single Card Search */}
            {searchMode === 'single' && (
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
            )}

            {/* Multiple Card Search */}
            {searchMode === 'list' && (
              <div className="space-y-4 mb-4">
                {/* Card List Textarea */}
                <div>
                  <label className="block text-purple-300 text-sm font-medium mb-2">
                    Card List (one per line):
                  </label>
                  <textarea
                    value={cardList}
                    onChange={(e) => setCardList(e.target.value)}
                    placeholder="Enter card names, one per line..."
                    rows={8}
                    className="w-full p-4 bg-white/10 border border-purple-500/30 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                  />
                </div>
              </div>
            )}
              
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Searching stores{searchMode === 'list' ? ' for all cards' : ''}...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>
                    Search All Stores{searchMode === 'list' && cardList.trim() 
                      ? ` (${cardList.split('\n').filter(card => card.trim() !== '').length} cards)`
                      : ''
                    }
                  </span>
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
        {searchResults.length > 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-2">
                Search Results
              </h3>
              <div className="text-purple-300 text-sm">
                {searchResults.filter(r => r.status === 'found').length} cards found • {' '}
                {searchResults.filter(r => r.status === 'no_inventory').length} no inventory • {' '}
                {searchResults.filter(r => r.status === 'not_found').length} unrecognized 
              </div>
            </div>

            {searchResults.map((cardResult, cardIndex) => (
              <div key={cardIndex} className="bg-black/20 rounded-2xl p-6 border border-purple-500/20">
                {/* Card Header */}
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xl font-bold text-white">{cardResult.cardName}</h4>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(cardResult.status)}
                    <span className="text-sm text-purple-300">{getStatusText(cardResult.status)}</span>
                  </div>
                </div>

                {/* Results Grid */}
                {cardResult.results.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {cardResult.results.map((card, index) => (
                      <div
                        key={index}
                        className="bg-black/30 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20 hover:border-purple-500/40 transition-all"
                      >
                        {/* Store Badge */}
                        <div className="flex items-center justify-between mb-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getStoreColor(card.store)}`}>
                            {card.store}
                          </span>
                        </div>

                        {/* Card Info */}
                        <div className="space-y-3">
                          <h5 className="text-white font-medium text-sm leading-tight">{card.name}</h5>
                          
                          <div className="text-xl font-bold text-green-400">
                            {formatPriceRange(card.priceMin, card.priceMax)}
                          </div>

                          <a
                            href={card.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center space-x-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 py-2 px-3 rounded-lg transition-all text-sm"
                          >
                            <span>View</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-purple-300">
                    {cardResult.status === 'not_found' ? (
                      <div className="space-y-2">
                        <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto" />
                        <p>Card name not recognized</p>
                        <p className="text-sm">Please check the spelling or try a different name</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <AlertTriangle className="w-8 h-8 text-orange-400 mx-auto" />
                        <p>No inventory available at local stores</p>
                        <p className="text-sm">Card exists but no copies are currently in stock</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && searchResults.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-12 h-12 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Ready to Search</h3>
            <p className="text-purple-300">
              Enter Magic: The Gathering card names to find the best prices across local stores
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;