import { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  slug: string;
  cover_image_url?: string;
  device_performance?: {
    steam_deck?: { status?: string };
    rog_ally?: { status?: string };
    legion_go?: { status?: string };
  };
  best_deal?: {
    price: number;
    normal_price: number;
    discount_percent: number;
    store: string;
  };
}

interface SearchProps {
  device?: string;
  isMobile?: boolean;
}

export default function Search({ device = 'all', isMobile = false }: SearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shortcut: CMD+K or CTRL+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isMobile) {
          setIsMobileExpanded(true);
        }
        inputRef.current?.focus();
      }

      // ESC to close
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsMobileExpanded(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    console.log('🔍 [Search.tsx] Starting search for:', query); // DEBUG

    debounceRef.current = setTimeout(async () => {
      try {
        const url = `/api/search?q=${encodeURIComponent(query)}&device=${device}&limit=8`;
        console.log('📡 [Search.tsx] Fetching:', url); // DEBUG

        const response = await fetch(url);
        console.log('📡 [Search.tsx] Response status:', response.status); // DEBUG

        const data = await response.json();
        console.log('📦 [Search.tsx] Data received:', data); // DEBUG
        console.log('📦 [Search.tsx] Results count:', data.results?.length || 0); // DEBUG

        setResults(data.results || []);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('❌ [Search.tsx] Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, device]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex === -1) {
          window.location.href = `/search?q=${encodeURIComponent(query)}`;
        } else if (selectedIndex === results.length) {
          window.location.href = `/search?q=${encodeURIComponent(query)}`;
        } else if (results[selectedIndex]) {
          window.location.href = `/game/${results[selectedIndex].slug}`;
        }
        break;
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleResultClick = (slug: string) => {
    if (typeof window !== 'undefined' && (window as any).umami) {
      (window as any).umami.track('search_result_click', {
        query,
        slug,
        device,
        position: results.findIndex((r) => r.slug === slug),
      });
    }

    window.location.href = `/game/${slug}`;
  };

  const getDeviceStatus = (result: SearchResult) => {
    if (!result.device_performance || device === 'all') return null;

    const deviceKey =
      device === 'steam_deck' ? 'steam_deck' :
        device === 'rog_ally' ? 'rog_ally' :
          device === 'legion_go' ? 'legion_go' : null;

    if (!deviceKey) return null;

    const status = result.device_performance[deviceKey]?.status;
    return status;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-500';
      case 'playable':
        return 'text-yellow-500';
      case 'poor':
        return 'text-red-500';
      default:
        return 'text-zinc-500';
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  if (isMobile && !isMobileExpanded) {
    return (
      <button
        onClick={() => setIsMobileExpanded(true)}
        className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        aria-label="Open search"
      >
        <SearchIcon className="w-5 h-5 text-zinc-400" />
      </button>
    );
  }

  return (
    <div className={`relative ${isMobile ? 'fixed inset-0 z-50 bg-black/95 p-4' : ''}`}>
      {isMobile && isMobileExpanded && (
        <button
          onClick={() => {
            setIsMobileExpanded(false);
            setQuery('');
            setIsOpen(false);
          }}
          className="absolute top-4 right-4 p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          aria-label="Close search"
        >
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      )}

      <div className={`relative ${isMobile ? 'mt-12' : ''}`}>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && setIsOpen(true)}
            placeholder="Search games..."
            className={`
              w-full bg-zinc-900 border border-zinc-800 rounded-lg
              pl-10 pr-10 py-2.5 text-sm text-white placeholder-zinc-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              transition-all
              ${isMobile ? 'text-base' : 'w-[320px]'}
            `}
            autoComplete="off"
            spellCheck="false"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-800 rounded transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          )}
        </div>

        {!isMobile && !query && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600 pointer-events-none">
            <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700">⌘K</kbd>
          </div>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={`
            absolute top-full mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl
            overflow-hidden z-50
            ${isMobile ? 'left-0 right-0' : 'w-[420px]'}
          `}
        >
          {isLoading && (
            <div className="p-4 text-center text-zinc-500 text-sm">
              <div className="inline-block w-4 h-4 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && results.length === 0 && query.length >= 2 && (
            <div className="p-4 text-center text-zinc-500 text-sm">
              No games found matching "{query}"
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="max-h-[400px] overflow-y-auto">
              {results.map((result, index) => {
                const status = getDeviceStatus(result);
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result.slug)}
                    className={`
                      w-full flex items-center gap-3 p-3 text-left
                      transition-colors
                      ${isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'}
                    `}
                  >
                    <div className="flex-shrink-0 w-12 h-16 bg-zinc-800 rounded overflow-hidden">
                      {result.cover_image_url ? (
                        <img
                          src={result.cover_image_url}
                          alt={result.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-sm truncate">
                        {result.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        {status && (
                          <span className={`text-xs ${getStatusColor(status)} capitalize`}>
                            {status}
                          </span>
                        )}

                        {result.best_deal && (
                          <>
                            {status && <span className="text-zinc-700">·</span>}
                            <span className="text-xs text-green-500 font-semibold">
                              {formatPrice(result.best_deal.price)}
                            </span>
                            {result.best_deal.discount_percent > 0 && (
                              <span className="text-xs text-zinc-500">
                                -{result.best_deal.discount_percent}%
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              <a
                href={`/search?q=${encodeURIComponent(query)}`}
                className={`
                  block w-full p-3 text-center text-sm font-semibold
                  transition-colors border-t border-zinc-800
                  ${selectedIndex === results.length ? 'bg-zinc-800 text-blue-400' : 'text-blue-500 hover:bg-zinc-800/50'}
                `}
              >
                See all results for "{query}"
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}