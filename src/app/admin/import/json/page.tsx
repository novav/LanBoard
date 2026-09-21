// T9 - JSON Import / Export page (client-side).
// Export: download all categories + links as a JSON backup file.
// Import: upload a .json file (NavBox export or OneNav-compatible), preview, and import.
'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

type ImportPreview = {
  source: 'lanboard' | 'onenav';
  categories: { name: string; linkCount: number }[];
  totalLinks: number;
};

type ImportResult = {
  createdCategories: number;
  createdLinks: number;
  skipped: number;
  errors: string[];
};

export default function JsonImportExportPage() {
  // Export state
  const [exporting, setExporting] = useState(false);

  // Import state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ---- Export ----
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/data/export');
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message ?? 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      // Derive filename from Content-Disposition header if present
      const cd = res.headers.get('Content-Disposition');
      const match = cd?.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : 'lanboard-export.json';
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Export failed';
      alert('Export failed: ' + msg);
    } finally {
      setExporting(false);
    }
  }, []);

  // ---- Import ----
  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }

  function loadFile(f: File) {
    setFile(f);
    setError(null);
    setResult(null);
    setPreview(null);
  }

  const handleImport = useCallback(async () => {
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/data/import', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? 'Import failed');
      }

      setResult({
        createdCategories: json.createdCategories ?? 0,
        createdLinks: json.createdLinks ?? 0,
        skipped: json.skipped ?? 0,
        errors: Array.isArray(json.errors) ? json.errors : [],
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      setError(msg);
    } finally {
      setImporting(false);
    }
  }, [file]);

  // ---- Preview (client-side parse to show counts before sending) ----
  const getPreview = useCallback(
    (json: Record<string, unknown>) => {
      let categories: { name: string; links?: unknown[] }[] = [];
      if (Array.isArray(json.categories)) {
        categories = json.categories as { name: string; links?: unknown[] }[];
      } else if (json.data && Array.isArray((json.data as Record<string, unknown>).categories)) {
        categories = (json.data as Record<string, unknown>).categories as { name: string; links?: unknown[] }[];
      }

      let totalLinks = 0;
      const out: { name: string; linkCount: number }[] = [];
      for (const c of categories) {
        const name = String((c as Record<string, unknown>).name ?? '');
        if (!name.trim()) continue;
        const rawLinks = (c as Record<string, unknown>).links;
        const linkCount = Array.isArray(rawLinks) ? rawLinks.length : 0;
        out.push({ name: name.trim(), linkCount });
        totalLinks += linkCount;
      }
      return {
        source: json.source === 'lanboard' ? ('lanboard' as const) : ('onenav' as const),
        categories: out,
        totalLinks,
      };
    },
    [],
  );

  // Generate preview as soon as file is selected
  if (file && !preview) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        setPreview(getPreview(json));
      } catch {
        setError('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          JSON Import / Export
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Back up your entire site as JSON, or restore from a NavBox export or a compatible OneNav JSON file.
        </p>
      </div>

      {/* Export section */}
      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Export all data
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Downloads a JSON file containing every category and link (including private ones).
        </p>
        <div className="mt-4">
          <button
            className={cn(
              'btn-primary',
              exporting && 'opacity-75 cursor-not-allowed',
            )}
            disabled={exporting}
            onClick={handleExport}
          >
            {exporting ? 'Exporting...' : 'Export all data'}
          </button>
        </div>
      </section>

      {/* Import section */}
      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Import JSON
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Upload a <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">.json</code> backup file.
          Supports NavBox exports and OneNav-compatible JSON.
        </p>

        {/* Drop zone */}
        <div
          className={cn(
            'mt-4 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
            isDragOver
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
              : 'border-slate-300 dark:border-slate-600',
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
        >
          <svg
            className="mx-auto h-10 w-10 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5V4.5a2.25 2.25 0 012.25-2.25H21m-3.75 11.25A2.25 2.25 0 0115 16.5V5.625m2.25-3v18"
            />
          </svg>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {file ? file.name : 'Drag & drop a JSON file here'}
          </p>
          <div className="mt-2">
            <label
              className="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400"
              htmlFor="json-upload"
            >
              Browse files
            </label>
            <input
              id="json-upload"
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleSelect}
            />
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="mt-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-700/40">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Preview — detected source: <span className="font-semibold">{preview.source}</span>
            </p>
            <ul className="mt-2 space-y-1">
              {preview.categories.map((c) => (
                <li
                  key={c.name}
                  className="text-sm text-slate-600 dark:text-slate-300"
                >
                  <span className="font-medium">{c.name}</span>{' '}
                  <span className="text-slate-400">({c.linkCount} link{c.linkCount !== 1 ? 's' : ''})</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              {preview.categories.length} categor{preview.categories.length !== 1 ? 'ies' : 'y'} ·{' '}
              {preview.totalLinks} link{preview.totalLinks !== 1 ? 's' : ''}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Links with URLs already existing in your site will be skipped (duplicate detection).
            </p>
          </div>
        )}

        {/* Import button */}
        {file && (
          <div className="mt-4">
            <button
              className={cn('btn-primary', importing && 'opacity-75 cursor-not-allowed')}
              disabled={importing || !preview}
              onClick={handleImport}
            >
              {importing ? 'Importing...' : 'Confirm import'}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Result summary */}
        {result && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Import complete
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              <li>
                Categories created: <span className="font-medium">{result.createdCategories}</span>
              </li>
              <li>
                Links created: <span className="font-medium">{result.createdLinks}</span>
              </li>
              <li>
                Skipped (duplicates): <span className="font-medium">{result.skipped}</span>
              </li>
            </ul>
            {result.errors.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400">
                  {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
