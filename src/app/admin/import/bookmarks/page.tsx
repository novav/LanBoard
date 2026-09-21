// T8 - Browser bookmark import page.
// Client component: upload .html, preview parsed categories/links, choose
// dedup/merge options, confirm import via /api/bookmarks/import.
// Mirrors the admin sidebar nav pattern of the nginx scan page.
"use client";

import { ChangeEvent, DragEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedCategory {
  name: string;
  path: string;
}

interface ParsedLink {
  title: string;
  url: string;
  categoryId: number;
  icon?: string;
}

interface ParseResponse {
  fileName: string;
  fileSize: number;
  categories: ParsedCategory[];
  links: ParsedLink[];
}

type DedupStrategy = "skip" | "overwrite";

interface ImportResult {
  createdCategories: { id: string; name: string }[];
  createdLinks: { id: string; title: string; url: string }[];
  skipped: { links: number; reasons: { duplicateUrl: number; invalidUrl: number } };
  errors: { index: number; title: string; url: string; reason: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtLinkUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// Browser exports always wrap everything in one or more root folders
// (e.g. "书签栏" / "Bookmarks bar", "其他书签" / "Other bookmarks"). These
// are organizational wrappers, not meaningful categories. When enabled,
// drop root-level folders and promote their children to the top level;
// any links that lived directly under a root folder fall back to an
// "Uncategorized" category instead of being dropped.
function stripRootFolders(
  categories: ParsedCategory[],
  links: ParsedLink[],
): { categories: ParsedCategory[]; links: ParsedLink[] } {
  const rootIndices = new Set<number>();
  categories.forEach((c, i) => {
    if (!c.path.includes("/")) rootIndices.add(i);
  });
  if (rootIndices.size === 0) return { categories, links };

  const newCategories: ParsedCategory[] = [];
  const oldIndexToNewIndex = new Map<number, number>();

  categories.forEach((c, i) => {
    if (rootIndices.has(i)) return;
    let newPath = c.path;
    for (const ri of Array.from(rootIndices)) {
      const rootPath = categories[ri].path;
      if (newPath.startsWith(rootPath + "/")) {
        newPath = newPath.slice(rootPath.length + 1);
        break;
      }
    }
    oldIndexToNewIndex.set(i, newCategories.length);
    newCategories.push({ name: c.name, path: newPath });
  });

  let uncategorizedIdx = -1;
  const ensureUncategorized = () => {
    if (uncategorizedIdx === -1) {
      uncategorizedIdx = newCategories.length;
      newCategories.push({ name: "Uncategorized", path: "Uncategorized" });
    }
    return uncategorizedIdx;
  };

  const newLinks: ParsedLink[] = links.map((l) => {
    if (rootIndices.has(l.categoryId)) {
      return { ...l, categoryId: ensureUncategorized() };
    }
    return { ...l, categoryId: oldIndexToNewIndex.get(l.categoryId)! };
  });

  return { categories: newCategories, links: newLinks };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BookmarksImportPage() {
  const router = useRouter();

  // State
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dedup, setDedup] = useState<DedupStrategy>("skip");
  const [mergeExisting, setMergeExisting] = useState(true);
  const [skipRootFolders, setSkipRootFolders] = useState(true);

  // UI state
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Categories/links actually shown & imported, after optionally stripping
  // root wrapper folders (e.g. "书签栏"). Recomputed whenever the toggle or
  // parse result changes.
  const displayResult = useMemo(() => {
    if (!parseResult) return null;
    if (!skipRootFolders) return parseResult;
    const { categories, links } = stripRootFolders(parseResult.categories, parseResult.links);
    return { ...parseResult, categories, links };
  }, [parseResult, skipRootFolders]);

  // Expand all categories in preview.
  const expandAll = useCallback(() => {
    if (!displayResult) return;
    setExpanded(Object.fromEntries(displayResult.categories.map((_, i) => [i, true])));
  }, [displayResult]);

  const collapseAll = useCallback(() => {
    setExpanded({});
  }, []);

  // Reset expansion state and expand the first category whenever the
  // displayed category list changes shape (new file, or toggling
  // skip-root-folders reindexes everything).
  useEffect(() => {
    if (displayResult && displayResult.categories.length > 0) {
      setExpanded({ 0: true });
    } else {
      setExpanded({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parseResult, skipRootFolders]);

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  const handleSelectFile = (f: File) => {
    setError(null);
    setResult(null);
    setParseResult(null);
    setFile(f);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f) handleSelectFile(f);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f) handleSelectFile(f);
  };

  const onDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // ---------------------------------------------------------------------------
  // Parse
  // ---------------------------------------------------------------------------

  const handleParse = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/bookmarks/parse", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          data.error === "file_too_large"
            ? "File too large (max 5 MB)."
            : data.error === "unrecognized_bookmark_html"
              ? "Could not recognize a Netscape Bookmark HTML file. Try a different export."
              : data.error === "invalid_file_type"
                ? "Please upload an .html / .htm bookmark file."
                : data.error === "file_empty"
                  ? "The file is empty."
                  : data.error === "unrecognized_bookmark_format"
                    ? "Could not recognize a Netscape Bookmark HTML file."
                    : data.detail || "Failed to parse the file.";
        setError(msg);
        return;
      }
      setParseResult(data);
    } catch {
      setError("Network error while parsing the file.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  const handleImport = async (e: FormEvent) => {
    e.preventDefault();
    if (!displayResult) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookmarks/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: displayResult.categories,
          links: displayResult.links,
          dedup,
          mergeExistingCategories: mergeExisting,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed.");
        return;
      }
      setResult(data);
    } catch {
      setError("Network error while importing.");
    } finally {
      setImporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Counts per category (keyed by category path, since names can repeat
  // across different parents).
  const categoryCounts = (() => {
    const counts: Record<string, number> = {};
    for (const cat of displayResult?.categories ?? []) counts[cat.path] = 0;
    for (const link of displayResult?.links ?? []) {
      const cat = displayResult!.categories[link.categoryId];
      const key = cat?.path ?? "Uncategorized";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  })();

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/admin/import")}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
              aria-label="Back to import menu"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Import Browser Bookmarks
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Import a Netscape Bookmark HTML file from Chrome, Edge, Firefox, or Safari.
          </p>
        </div>
      </div>

      {/* Step 1 — Upload */}
      {!parseResult && !result && (
        <section className="card">
          <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">
            1. Choose a bookmark file
          </h2>
          <label
            onDrop={onDrop}
            onDragOver={onDragOver}
            className={cn(
              "relative block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition-colors dark:border-slate-600 dark:bg-slate-900/50",
              file && "border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-900/20",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".html,.htm"
              className="hidden"
              onChange={handleFileInput}
              tabIndex={-1}
            />
            <svg
              className="mx-auto h-12 w-12 text-slate-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            {file ? (
              <p className="mt-3 font-medium text-brand-700 dark:text-brand-300">
                {file.name} <span className="text-slate-400">{fmtBytes(file.size)}</span>
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-brand-600 dark:text-brand-400">Click to browse</span>{" "}
                  or drag &amp; drop your bookmark <code className="text-slate-500">.html</code> file here.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Netscape Bookmark HTML &middot; max 5 MB
                </p>
              </>
            )}
          </label>

          <div className="mt-4 flex items-center justify-between">
            {file ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setError(null);
                  }}
                  className="btn-secondary"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={loading}
                  className={cn("btn-primary", loading && "opacity-60 pointer-events-none")}
                >
                  {loading ? "Parsing..." : "Parse & Preview"}
                </button>
              </div>
            ) : (
              <span className="text-xs text-slate-400">Select a file to continue</span>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}
        </section>
      )}

      {/* Step 2 — Preview */}
      {displayResult && !result && (
        <section className="space-y-5">
          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                2. Preview
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Collapse all
                </button>
              </div>
            </div>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">{displayResult.categories.length}</span> categories &middot;{" "}
              <span className="font-semibold">{displayResult.links.length}</span> links &middot; from{" "}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">{displayResult.fileName}</code>
            </p>

            <label className="mb-4 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={skipRootFolders}
                onChange={(e) => setSkipRootFolders(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Skip root folders (e.g. "书签栏", "Bookmarks bar") — don't import them as a category
            </label>

            <div className="max-h-96 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              {displayResult.categories.map((cat, i) => {
                const open = expanded[i];
                const count = categoryCounts[cat.path] ?? 0;
                const catLinks = displayResult.links.filter((l) => l.categoryId === i);
                const depth = (cat.path.match(/\//g) || []).length;
                const indent = depth * 24;
                return (
                  <div key={cat.path ?? cat.name}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between bg-white py-2 text-left hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/50"
                      style={{ paddingLeft: `${16 + indent}px`, paddingRight: "16px" }}
                      onClick={() =>
                        setExpanded((prev) => ({
                          ...prev,
                          [i]: !open,
                        }))
                      }
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                        {depth > 0 && (
                          <span className="text-slate-400 mr-1">
                            {"└ "}
                          </span>
                        )}
                        <svg
                          className={cn(
                            "h-4 w-4 text-slate-400 transition-transform flex-shrink-0",
                            open && "rotate-90",
                          )}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="truncate">{cat.name}</span>
                        {depth > 0 && (
                          <span className="text-xs text-slate-400 truncate">
                            ({cat.path.substring(0, cat.path.lastIndexOf('/'))})
                          </span>
                        )}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300 flex-shrink-0">
                        {count}
                      </span>
                    </button>
                    {open &&
                      catLinks.map((link, j) => (
                        <div
                          key={j}
                          className="flex items-center justify-between border-t border-slate-100 px-4 py-1.5 text-sm dark:border-slate-700"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-slate-800 dark:text-slate-200">
                              {link.title}
                            </span>
                          </div>
                          <span className="ml-3 flex-shrink-0 truncate text-xs text-slate-400">
                            {fmtLinkUrl(link.url)}
                          </span>
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={mergeExisting}
                  onChange={(e) => setMergeExisting(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Merge into existing categories (same name)
              </label>
            </div>

            <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              <span className="font-medium">On duplicate URL:</span>{" "}
              <label className="mr-4 inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="dedup"
                  checked={dedup === "skip"}
                  onChange={() => setDedup("skip")}
                  className="border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Skip
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="dedup"
                  checked={dedup === "overwrite"}
                  onChange={() => setDedup("overwrite")}
                  className="border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Overwrite title/icon
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setParseResult(null);
                  setFile(null);
                }}
                className="btn-secondary"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className={cn("btn-primary", importing && "opacity-60 pointer-events-none")}
              >
                {importing ? "Importing..." : "Import"}
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Step 3 — Result */}
      {result && (
        <section className="card">
          <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">
            Import complete
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-brand-50 p-4 dark:bg-brand-900/30">
              <p className="text-sm text-brand-700 dark:text-brand-300">Categories added</p>
              <p className="mt-1 text-2xl font-bold text-brand-600 dark:text-brand-400">
                {result.createdCategories.length}
              </p>
            </div>
            <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/30">
              <p className="text-sm text-green-700 dark:text-green-300">Links added</p>
              <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
                {result.createdLinks.length}
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/30">
              <p className="text-sm text-amber-700 dark:text-amber-300">Links skipped</p>
              <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                {result.skipped.links}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {result.skipped.reasons.duplicateUrl} duplicate &middot;{" "}
                {result.skipped.reasons.invalidUrl} invalid
              </p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-sm font-medium text-red-700 dark:text-red-300">
                Errors ({result.errors.length})
              </p>
              <ul className="max-h-48 overflow-auto rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    <span className="font-medium">{e.title || e.url}</span> &mdash; {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setParseResult(null);
                setFile(null);
                setResult(null);
                setError(null);
              }}
              className="btn-secondary"
            >
              Import another file
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/links")}
              className="btn-primary"
            >
              View links
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
