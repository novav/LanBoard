'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[NavBox] Page error:', error);
  }, [error]);

  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center justify-center px-6 py-20">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/30">
        <span className="text-4xl">⚠️</span>
      </div>
      <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-slate-100">
        Something went wrong
      </h2>
      <p className="mt-3 max-w-md text-center text-slate-500 dark:text-slate-400">
        {error.message ?? 'An unexpected error occurred.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        Try again
      </button>
    </section>
  );
}
