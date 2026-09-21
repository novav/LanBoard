// SearchBar.tsx — client component for local + external search.
// - Debounced requests to /api/search?q=xxx (300ms).
// - Results dropdown (absolute + backdrop-blur) with title, URL, category.
// - Enter with a local match -> opens the first match.
// - Enter with no local match -> forwards query to external search engine.
//
// Search engines are loaded from the shared useSettings() hook, which
// fetches /api/settings only once across the whole page (singleton).
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useSettings } from './useSettings';

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  description: string;
  category: { name: string };
}

type SearchEngine = { name: string; url: string };

const DEFAULT_ENGINES: SearchEngine[] = [
  { name: 'Baidu', url: 'https://www.baidu.com/s?wd={query}' },
];

function parseEngines(raw: string | undefined): SearchEngine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
  } catch {
    return [];
  }
}

export function SearchBar() {
  const { data: settings } = useSettings();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const engines: SearchEngine[] = settings
    ? (() => {
        const parsed = parseEngines(settings.searchEngines);
        return parsed.length > 0 ? parsed : DEFAULT_ENGINES;
      })()
    : DEFAULT_ENGINES;

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    search(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = query.trim();

      if (results.length > 0) {
        setResults([]);
        window.open(results[0].url, '_blank');
        inputRef.current?.blur();
        return;
      }

      if (trimmed && engines[selectedEngine]) {
        const searchUrl = engines[selectedEngine].url.replace('{query}', encodeURIComponent(trimmed));
        window.open(searchUrl, '_blank');
        inputRef.current?.blur();
      }
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setResults([]);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const showOverlay = query.trim() && (loading || results.length > 0);

  return (
    <div className="search-container relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
      <div
        className={cn(
          'flex items-center gap-3 rounded-2xl border border-white/30 bg-white/20 px-5 py-4 text-white shadow-lg backdrop-blur-xl',
          'focus-within:border-white/50 focus-within:bg-white/25 transition-all duration-200',
        )}
      >
        <svg
          className="shrink-0 text-white/70"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Search your services..."
          className="w-full bg-transparent text-base outline-none placeholder:text-white/60"
          autoComplete="off"
          aria-label="Search services"
        />
        {query && (
          <button
            type="button"
            className="shrink-0 text-white/60 hover:text-white transition-colors"
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        {engines.length > 1 && (
          <div className="shrink-0 flex items-center gap-1 border-l border-white/20 pl-3">
            {engines.map((engine, idx) => (
              <button
                key={idx}
                type="button"
                className={cn(
                  'px-2 py-1 rounded-lg text-xs font-medium transition-all',
                  selectedEngine === idx
                    ? 'bg-white/30 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10',
                )}
                onClick={() => setSelectedEngine(idx)}
                title={engine.name}
              >
                {engine.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {showOverlay && (
        <div
          className="absolute top-full z-40 mt-3 w-full rounded-2xl border border-white/20 bg-white/15 shadow-2xl backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="p-5 text-center text-sm text-white/70">Searching...</div>
          ) : (
            <ul className="max-h-96 overflow-auto py-1">
              {results.map((r) => (
                <li key={r.id}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 px-6 py-4 hover:bg-white/25 transition-all duration-200 cursor-pointer"
                    onClick={() => {
                      setResults([]);
                      inputRef.current?.blur();
                    }}
                  >
                    {r.icon ? (
                      <img
                        src={r.icon}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-10 w-10 shrink-0 rounded-lg object-contain bg-white/10 p-1.5 border border-white/20"
                      />
                    ) : (
                      <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg bg-white/20 border border-white/30 text-white font-semibold">
                        {r.title.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold text-white drop-shadow-sm">
                        {r.title}
                      </div>
                      <div className="truncate text-sm text-white/70 mt-0.5">
                        {r.category.name} · {new URL(r.url).host}
                      </div>
                    </div>
                    <svg
                      className="h-5 w-5 shrink-0 text-white/40"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}