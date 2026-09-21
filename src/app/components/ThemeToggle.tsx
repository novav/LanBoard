// ThemeToggle.tsx — client component for light/dark theme switching.
// Persists preference to localStorage under key 'theme' ('dark' | 'light').
// Falls back to system preference when no preference is stored.
'use client';

import { useEffect, useState } from 'react';

const THEME_KEY = 'theme';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const root = document.documentElement;
    const stored = localStorage.getItem(THEME_KEY);

    if (stored) {
      const dark = stored === 'dark';
      setIsDark(dark);
      if (dark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } else {
      // Fallback to system preference.
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(dark);
      if (dark) {
        root.classList.add('dark');
      }
    }
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    const root = document.documentElement;
    if (next) {
      root.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  };

  if (!mounted) {
    return (
      <button
        className="h-8 w-8 rounded-lg"
        aria-label="Toggle theme"
        tabIndex={-1}
        type="button"
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="group flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      onClick={toggle}
    >
      {isDark ? (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
        </svg>
      )}
    </button>
  );
}
