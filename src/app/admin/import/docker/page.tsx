// T10 - Docker container scan & import page (client-side).
//
// Steps:
//   1. Show a socket-mount guidance banner when the Docker socket is unavailable.
//   2. Scan button -> POST /api/docker/scan, showing loading state.
//   3. Render an editable, selectable container table.
//   4. Import options: target category, de-dup strategy.
//   5. Batch import button -> POST /api/docker/import, show result summary.

"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types (mirror the scan API response)
// ---------------------------------------------------------------------------

interface LanboardLabels {
  enable: boolean | null;
  name: string | null;
  icon: string | null;
  category: string | null;
  url: string | null;
}

interface ScannedContainer {
  id: string;
  shortId: string;
  name: string;
  image: string;
  status: string;
  url: string | null;
  publicPort: number | null;
  hasPortMapping: boolean;
  labels: Record<string, string>;
  lanboard: LanboardLabels;
  title: string;
  icon: string | null;
  category: string;
  recommendedUrl: string | null;
  alreadyImported: boolean;
  existingLinkId: string | null;
}

interface ScanResponse {
  containers: ScannedContainer[];
  dockerAvailable: boolean;
  hostAddress: string | null;
  error?: string;
}

interface Category {
  id: string;
  name: string;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: number;
  createdLinks: Array<{ id: string; title: string; url: string; categoryName: string }>;
  skippedDetails: Array<{ id: string; title: string; reason: string }>;
  errorDetails: Array<{ id: string; title: string; reason: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DockerImportPage() {

  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // Row-level edits
  const [edited, setEdited] = useState<Record<string, Partial<ScannedContainer>>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [targetCategoryId, setTargetCategoryId] = useState<string>("");
  const [strategy, setStrategy] = useState<"skip" | "create-per-category" | "create-category">("create-per-category");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const containers = scanResult?.containers ?? [];

  const inputBase =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white";

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const json = await res.json();
        setCategories(Array.isArray(json) ? json : []);
      }
    } catch {
      // non-fatal: the import API can create categories when no target is chosen
    }
  }

  async function handleScan() {
    setScanning(true);
    setError(null);
    setSuccess(null);
    setImportResult(null);
    setSelected({});
    setEdited({});

    try {
      const res = await fetch("/api/docker/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Scan failed");
      }
      setScanResult(json as ScanResponse);
      if (json.containers.length > 0) {
        setSuccess(`Found ${json.containers.length} running container${json.containers.length > 1 ? "s" : ""}.`);
      } else if (json.dockerAvailable) {
        setSuccess("Docker is reachable, but no running containers found.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Scan failed";
      setError(msg);
      setScanResult({ containers: [], dockerAvailable: false, hostAddress: null, error: msg });
    } finally {
      setScanning(false);
    }
  }

  function getCellValue(c: ScannedContainer, field: keyof ScannedContainer) {
    return edited[c.id]?.[field] ?? (c[field] ?? "");
  }

  function editField(c: ScannedContainer, field: keyof ScannedContainer, value: string) {
    setEdited((prev) => ({
      ...prev,
      [c.id]: { ...(prev[c.id] ?? {}), [field]: value },
    }));
  }

  function toggleSelect(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }));
  }

  function selectAll() {
    const allSelected = containers.length > 0 && containers.every((c) => selected[c.id] ?? false);
    const next: Record<string, boolean> = {};
    for (const c of containers) next[c.id] = !allSelected;
    setSelected(next);
  }

  async function handleImport() {
    const selectedContainers = containers.filter((c) => selected[c.id] ?? false);
    if (selectedContainers.length === 0) {
      setError("Select at least one container to import.");
      return;
    }

    setImporting(true);
    setError(null);
    setSuccess(null);
    setImportResult(null);

    const payloadContainers = selectedContainers.map((c) => ({
      id: c.id,
      title: String(getCellValue(c, "title") || c.title),
      url: String(getCellValue(c, "recommendedUrl") || c.recommendedUrl || c.url || ""),
      icon: (getCellValue(c, "icon") || c.icon || null) as string | null,
      category: String(getCellValue(c, "category") || c.category),
    }));

    try {
      const res = await fetch("/api/docker/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          containers: payloadContainers,
          targetCategoryId: targetCategoryId || undefined,
          strategy,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Import failed");
      }
      setImportResult(json as ImportResult);
      setSuccess("Import completed.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Import failed";
      setError(msg);
    } finally {
      setImporting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const dockerUnavailable = scanResult && !scanResult.dockerAvailable;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Docker scan
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Discover services running on your NAS by querying the Docker Engine API.
          </p>
        </div>
        <a
          href="/admin"
          className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          ← Back to overview
        </a>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
          {error}
          <button className="ml-2 font-medium" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300">
          {success}
          <button className="ml-2 font-medium" onClick={() => setSuccess(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Socket guidance */}
      <section className="card">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <span className="h-6 w-6 rounded bg-brand-50 flex items-center justify-center dark:bg-brand-900/30">
            <svg className="h-4 w-4 text-brand-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 4a2 2 0 012-2h12a2 2 0 012 2v2H2V4zm0 4h16v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8zm4 3a1 1 0 011-1h1a1 1 0 110 2H7a1 1 0 01-1-1z" />
            </svg>
          </span>
          Docker socket access
        </h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          The scanner needs a live Docker Engine connection at <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">/var/run/docker.sock</code>.
        </p>

        {dockerUnavailable && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            <p className="font-medium">Docker is not reachable — {scanResult?.error || "socket unavailable"}</p>
            <p className="mt-1">
              When running NavBox inside Docker, mount the socket into the container (read-only):
            </p>
            <pre className="mt-2 rounded bg-slate-900 px-3 py-2 text-xs text-slate-200 dark:bg-slate-100 dark:text-slate-900">
              volumes:<br />
              &nbsp;&nbsp;- /var/run/docker.sock:/var/run/docker.sock:ro
            </pre>
            <p className="mt-1">
              Also make sure your <a href="/admin/settings" className="font-medium underline">LAN address</a> is set in
              Settings so URLs can be generated.
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            className={cn(
              "btn-primary",
              scanning && "opacity-75 cursor-not-allowed",
              dockerUnavailable && "cursor-default",
            )}
            disabled={scanning || (dockerUnavailable ?? false)}
            onClick={handleScan}
          >
            {scanning ? "Scanning…" : "Scan for containers"}
          </button>
          {scanResult?.hostAddress && (
            <span className="text-xs text-slate-400">
              host: <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">{scanResult.hostAddress}</code>
            </span>
          )}
        </div>
      </section>

      {/* Container list */}
      {containers.length > 0 && (
        <section className="card">
          <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-white">
            <span>Running containers</span>
            <span className="text-xs font-normal text-slate-400">
              {containers.length} found · {Object.values(selected).filter(Boolean).length} selected
            </span>
          </h2>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={containers.length > 0 && containers.every((c) => selected[c.id] ?? false)}
                      onChange={selectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Name</th>
                  <th className="px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Image</th>
                  <th className="px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Inferred URL</th>
                  <th className="px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Labels</th>
                  <th className="px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Status</th>
                  <th className="px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Imported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {containers.map((c) => {
                  const imported = c.alreadyImported || false;
                  const lbKeys = Object.keys(c.labels ?? {}).filter((k) => k.startsWith("lanboard"));
                  const editTitle = String(getCellValue(c, "title"));
                  const editUrl = String(getCellValue(c, "recommendedUrl"));
                  const editIcon = String(getCellValue(c, "icon") ?? c.icon ?? "");
                  const editCategory = String(getCellValue(c, "category"));

                  return (
                    <tr
                      key={c.id}
                      className={cn(
                        "group bg-white dark:bg-slate-900",
                        (selected[c.id] ?? false) && "bg-brand-50 dark:bg-brand-900/20",
                      )}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected[c.id] ?? false}
                          onChange={() => toggleSelect(c.id)}
                          aria-label={`Select ${c.name}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="min-w-[140px] rounded border border-transparent px-1 py-0.5 text-sm bg-transparent hover:border-slate-200 focus:border-brand-500 focus:outline-none dark:hover:border-slate-600"
                          value={editTitle}
                          onChange={(e) => editField(c, "title", e.target.value)}
                        />
                        <p className="mt-0.5 text-xs text-slate-400">{c.shortId}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        <input
                          className="min-w-[100px] rounded border border-transparent px-1 py-0.5 text-sm bg-transparent hover:border-slate-200 focus:border-brand-500 focus:outline-none dark:hover:border-slate-600"
                          value={c.image}
                          readOnly
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="min-w-[200px] rounded border border-transparent px-1 py-0.5 text-sm font-mono text-slate-600 bg-transparent hover:border-slate-200 focus:border-brand-500 focus:outline-none dark:hover:border-slate-600"
                          value={editUrl}
                          onChange={(e) => editField(c, "recommendedUrl", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {editIcon && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            icon={editIcon}
                          </span>
                        )}
                        {lbKeys.length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                              {lbKeys.length} lanboard label{lbKeys.length > 1 ? "s" : ""}
                            </summary>
                            <ul className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {lbKeys.map((k) => (
                                <li key={k}>
                                  {k}: <span className="font-mono">{c.labels[k]}</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                        {lbKeys.length === 0 && <span className="text-xs text-slate-400">none</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-xs",
                            c.status?.toLowerCase().startsWith("up")
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
                          )}
                        >
                          {c.status}
                        </span>
                        {c.hasPortMapping ? (
                          <span className="ml-1 inline-block rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                            port
                          </span>
                        ) : (
                          <span className="ml-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                            no port
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {imported ? (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            imported
                          </span>
                        ) : (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                            pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Row edit: title / url / icon / category */}
          <p className="mt-2 text-xs text-slate-400">
            Click any cell to edit the recommended title, URL, icon, or category before importing.
          </p>
        </section>
      )}

      {/* Import options */}
      {containers.length > 0 && (
        <section className="card">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <span className="h-6 w-6 rounded bg-brand-50 flex items-center justify-center dark:bg-brand-900/30">
              <svg className="h-4 w-4 text-brand-600" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            Import options
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Target category
              </label>
              <select
                className={cn(inputBase, "cursor-pointer")}
                value={targetCategoryId}
                onChange={(e) => setTargetCategoryId(e.target.value)}
              >
                <option value="">Create per-category (default)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Leave blank to group links by their recommended category.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                De-dup strategy
              </label>
              <select
                className={cn(inputBase, "cursor-pointer")}
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as typeof strategy)}
              >
                <option value="create-per-category">Create missing categories</option>
                <option value="create-category">Create single "Docker" category</option>
                <option value="skip">Skip if no matching category</option>
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Containers already imported are always skipped.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              className={cn("btn-primary", importing && "opacity-75 cursor-not-allowed")}
              disabled={importing || Object.values(selected).filter(Boolean).length === 0}
              onClick={handleImport}
            >
              {importing ? "Importing…" : "Import selected"}
            </button>
          </div>
        </section>
      )}

      {/* Import result */}
      {importResult && (
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Import result</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-emerald-50 px-4 py-3 dark:bg-emerald-900/20">
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Created</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{importResult.created}</p>
            </div>
            <div className="rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-900/20">
              <p className="text-xs text-amber-600 dark:text-amber-400">Skipped</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{importResult.skipped}</p>
            </div>
            <div className="rounded-lg bg-red-50 px-4 py-3 dark:bg-red-900/20">
              <p className="text-xs text-red-600 dark:text-red-400">Errors</p>
              <p className="text-lg font-bold text-red-700 dark:text-red-300">{importResult.errors}</p>
            </div>
          </div>

          {importResult.createdLinks.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                Created links
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                {importResult.createdLinks.map((l) => (
                  <li key={l.id}>
                    {l.title} → <span className="font-mono">{l.url}</span> <span className="text-slate-400">({l.categoryName})</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {(importResult.skippedDetails.length > 0 || importResult.errorDetails.length > 0) && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400">
                Skipped & errors
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                {importResult.skippedDetails.map((s) => (
                  <li key={"s-" + s.id}>{s.title} — skipped ({s.reason})</li>
                ))}
                {importResult.errorDetails.map((e) => (
                  <li key={"e-" + e.id}>{e.title} — error ({e.reason})</li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-3 text-xs text-slate-400">
            Reload the page or rescan to refresh the import status.
          </div>
        </section>
      )}
    </div>
  );
}
