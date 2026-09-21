// useSettings.ts — shared singleton fetch for /api/settings.
//
// Previously ThemeColorProvider and SearchBar each fetched /api/settings
// on their own mount, producing two identical network round-trips on the
// home page. This hook fetches once and keeps the result in module-level
// state (singleton), so every consumer shares the same request and the
// same cached data. A subsequent `refetch()` forces a fresh pull.
'use client';

import { useCallback, useState, useEffect, useRef } from 'react';

type Settings = Record<string, string> & {
  themeColor?: string;
  searchEngines?: string;
};

type Result = {
  data: Settings | null;
  loading: boolean;
  refetch: () => void;
};

let pendingPromise: Promise<Settings | null> | null = null;

export function useSettings(): Result {
  const [data, setData] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const mountRef = useRef(false);

  const fetchSettings = useCallback(async () => {
    pendingPromise = pendingPromise ?? fetch('/api/settings').then((res) => res.json()).catch(() => null);
    return pendingPromise;
  }, []);

  const refetch = useCallback(() => {
    pendingPromise = null;
    return fetch('/api/settings')
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        return d;
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (mountRef.current) return;
    mountRef.current = true;

    let mounted = true;
    fetchSettings().then((d) => {
      if (!mounted) return;
      setData(d);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [fetchSettings]);

  return { data, loading, refetch };
}