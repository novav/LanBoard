// T14 - Nginx config scan & import page.
// Client component: scans /api/nginx/scan, previews results, bulk-imports via /api/nginx/import.
// Reads nginx:confPath and nas:hostAddress from /api/settings.
"use client";

import { FormEvent, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Shape returned by /api/nginx/scan (T13). We support whatever the API
// returns but give sane defaults so the UI never breaks.
type ScannedSite = {
  name: string;
  url: string;          // inferred full URL
  protocol: string;     // http | https
  host: string;         // server_name / hostname
  port: number;
  hasProxyPass: boolean;
  isDefaultServer: boolean;  // server_name was "_"
  rootPath: string;     // relative to the nginx root dir
  configPath: string;   // file + server block
  description: string;
  selected: boolean;    // client-side selection state
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSetting(key: string, fallback: string = ""): Promise<string> {
  return fetch("/api/settings")
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((map: Record<string, string>) => map[key] ?? fallback)
    .catch(() => fallback);
}

async function saveSettings(map: Record<string, string>) {
  return fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(map),
  });
}

async function fetchCategories(): Promise<{ id: string; name: string }[]> {
  return fetch("/api/categories")
    .then((r) => {
      if (!r.ok) return Promise.reject();
      return r.json();
    })
    .then((cats) => cats.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
    .catch(() => []);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NginxImportPage() {
  // Config
  const [confPath, setConfPath] = useState("/etc/nginx");
  const [confPathDefault, setConfPathDefault] = useState("/etc/nginx");
  const [hostAddress, setHostAddress] = useState("");
  const [hostAddressDefault, setHostAddressDefault] = useState("");

  // State
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [sites, setSites] = useState<ScannedSite[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [domainMode, setDomainMode] = useState<"keep" | "replace">("replace");
  const [formError, setFormError] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importSummary, setImportSummary] = useState<{ added: number; updated: number; skipped: number; errors: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(-1);
  const [editForm, setEditForm] = useState<ScannedSite | null>(null);

  const allSelected = sites.length > 0 && sites.every((s) => s.selected);
  const selectedCount = sites.filter((s) => s.selected).length;

  // Build a display URL that shows what the import will actually create.
  function displayUrl(s: ScannedSite): string {
    if (domainMode === "keep") return s.url;
    if (!hostAddress) return s.url;
    const host = hostAddress.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (s.isDefaultServer) {
      return `${s.protocol}://${host}:${s.port}`;
    }
    return `http://${host}/${s.name.replace(/^\/+/, "")}`;
  }

  useEffect(() => {
    loadConfig();
    loadCategories();
  }, []);

  async function loadConfig() {
    setLoadingConfig(true);
    const [conf, host] = await Promise.all([
      getSetting("nginx:confPath", "/etc/nginx"),
      getSetting("nas:hostAddress", ""),
    ]);
    setConfPath(conf);
    setConfPathDefault(conf);
    setHostAddress(host);
    setHostAddressDefault(host);
    setLoadingConfig(false);
  }

  async function loadCategories() {
    const cats = await fetchCategories();
    setCategories(cats);
    if (!selectedCategoryId && cats.length > 0) {
      setSelectedCategoryId(cats[0].id);
    }
  }

  // ----- Config save (nginx:confPath + nas:hostAddress) -----
  async function saveConfig(e: FormEvent) {
    e.preventDefault();
    setConfigError(null);
    setConfigSuccess(null);
    setSavingConfig(true);
    const res = await saveSettings({
      "nginx:confPath": confPath || "/etc/nginx",
      "nas:hostAddress": hostAddress || "",
    });
    setSavingConfig(false);
    if (!res.ok) {
      setConfigError("Save failed.");
    } else {
      setConfPathDefault(confPath);
      setHostAddressDefault(hostAddress);
      setConfigSuccess("Settings saved.");
    }
  }

  // ----- Scan -----
  async function runScan() {
    setScanLoading(true);
    setScanError(null);
    setSites([]);
    setImportSummary(null);
    setImportError(null);
    try {
      const res = await fetch("/api/nginx/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confPath: confPath || "/etc/nginx" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        let msg = data.error ?? "Scan failed.";
        if (res.status === 500) msg = "Server error during scan. Check the Nginx config path and permissions.";
        if (res.status === 501) msg = "The scan API is not implemented yet (T13). Configure your Nginx config directory in Settings.";
        if (res.status === 403) msg = "Permission denied reading the config directory. Make sure the app can access the Nginx config path.";
        setScanError(msg);
        setScanLoading(false);
        return;
      }
      const json = await res.json();
      const raw = json.sites ?? json.results ?? json.data ?? json ?? [];
      const arr = Array.isArray(raw) ? raw : [];
      const normalized = arr.map((s: Record<string, unknown>) => ({
        name: String(s.name ?? s.host ?? s.serverName ?? s.server_name ?? "Unnamed site"),
        url: String(s.url ?? s.proxyPass ?? ""),
        protocol: String(s.protocol ?? "http"),
        host: String(s.host ?? s.serverName ?? s.server_name ?? ""),
        port: Number(s.port ?? (s.protocol === "https" ? 443 : 80)),
        hasProxyPass: Boolean(s.hasProxyPass ?? s.proxyPass ?? false),
        isDefaultServer: Boolean(s.isDefaultServer),
        rootPath: String(s.rootPath ?? ""),
        configPath: String(s.configPath ?? s.filePath ?? ""),
        description: String(s.description ?? ""),
        selected: true,
      }));
      setSites(normalized);
    } catch {
      setScanError("Could not reach the scan API. Is the backend running?");
    }
    setScanLoading(false);
  }

  // ----- Row selection / editing -----
  function toggleSelect(i: number) {
    setSites((prev) => prev.map((s, idx) => idx === i ? { ...s, selected: !s.selected } : s));
  }
  function selectAll(v: boolean) {
    setSites((prev) => prev.map((s) => ({ ...s, selected: v })));
  }

  function openEdit(i: number) {
    setEditIndex(i);
    setEditForm(sites[i] ? { ...sites[i] } : null);
    setEditOpen(true);
  }
  function saveEdit() {
    if (!editForm) return;
    setSites((prev) => prev.map((s, idx) => idx === editIndex ? { ...editForm } : s));
    setEditOpen(false);
  }

  // ----- Import -----
  async function runImport() {
    setImportLoading(true);
    setFormError("");
    setImportSummary(null);
    setImportError(null);
    const selected = sites.filter((s) => s.selected);
    if (selected.length === 0) {
      setImportLoading(false);
      setFormError("Select at least one site to import.");
      return;
    }
    if (!selectedCategoryId) {
      setImportLoading(false);
      setFormError("Select a target category.");
      return;
    }
    try {
      const res = await fetch("/api/nginx/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sites: selected.map((s) => ({
            name: s.name,
            url: s.url,
            protocol: s.protocol,
            port: s.port,
            hasProxyPass: s.hasProxyPass,
            isDefaultServer: s.isDefaultServer,
          })),
          resolveMode: domainMode,
          targetCategoryId: selectedCategoryId,
          nasHost: hostAddress,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        let msg = data.error ?? "Import failed.";
        if (res.status === 501) msg = "The import API is not implemented yet (T13). Configure Settings and try again later.";
        if (res.status === 400) msg = "Bad request: " + (msg ?? "");
        setImportError(msg);
        setImportLoading(false);
        return;
      }
      setImportSummary({
        added: Number(data.created ?? data.added ?? 0),
        updated: Number(data.updated ?? 0),
        skipped: Number(data.skipped ?? 0),
        errors: Number(data.errors?.length ?? 0),
      });
      // Un-select successfully imported items
      setSites((prev) => prev.map((s) => ({ ...s, selected: !s.selected })));
    } catch {
      setImportError("Could not reach the import API.");
    }
    setImportLoading(false);
  }

  // ----- Skeleton -----
  if (loadingConfig) {
    return (
      <div className="space-y-6">
        <div>
          <div className="mb-2 skeleton h-7 w-48" />
          <div className="skeleton h-4 w-96" />
        </div>
        <div className="card">
          <div className="mb-4 skeleton h-5 w-40" />
          <div className="skeleton h-10 w-full" />
        </div>
      </div>
    );
  }

  // ----- Render -----
  const inputBase =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white";

  const selectBase =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Scan Nginx sites
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Scan your Nginx config directory, preview discovered server blocks, and import them as links.
        </p>
      </div>

      {configError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
          {configError}
          <button className="ml-2 font-medium" onClick={() => setConfigError(null)}>Dismiss</button>
        </div>
      )}
      {configSuccess && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300">
          {configSuccess}
          <button className="ml-2 font-medium" onClick={() => setConfigSuccess(null)}>Dismiss</button>
        </div>
      )}

      {/* ----- Config section ----- */}
      <form onSubmit={saveConfig} className="card">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <span className="h-6 w-6 rounded bg-brand-50 flex items-center justify-center dark:bg-brand-900/30">
            <svg className="h-4 w-4 text-brand-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm-2.5 3v4h1.5V5h2.5v4h1.5l.5-4h2v8h-2l-.5-4h-1.5v4H7.5V5H6z" />
            </svg>
          </span>
          Scan configuration
        </h2>
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nginx config directory <span className="text-red-500">*</span>
            </label>
            <input
              className={inputBase}
              value={confPath}
              onChange={(e) => setConfPath(e.target.value)}
              placeholder="/etc/nginx"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Root directory containing Nginx conf files (includes nested sites-enabled/conf.d).
            </p>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              NAS LAN address
            </label>
            <input
              className={inputBase}
              value={hostAddress}
              onChange={(e) => setHostAddress(e.target.value)}
              placeholder="192.168.1.50"
            />
            <p className="mt-1 text-xs text-slate-500">
              Used to build resolved URLs in replace mode.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={savingConfig}
              className="btn-secondary disabled:opacity-50"
            >
              {savingConfig ? "Saving…" : "Save settings"}
            </button>
            <button
              type="button"
              className={cn("btn-primary", scanLoading && "opacity-50 cursor-wait")}
              onClick={() => { saveConfig(new Event("submit") as any); runScan(); }}
              disabled={scanLoading || !confPath.trim()}
            >
              {scanLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Scanning…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8 4a4 4 0 100 8 4 4 0 000-8zM2.318 8.218a4.837 4.837 0 010-6.796l3.657 3.657A1.976 1.976 0 018 8h3.586l-1.293 1.293A1 1 0 019.414 10H8a1 1 0 01-.707-.293L3.707 5.985 2.318 7.384a4.837 4.837 0 010 6.796l-1.061-1.06a6.77 6.77 0 000-9.534L2.318 8.218z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Scan
                </span>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* ----- Scan error guidance ----- */}
      {scanError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/30">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            <span className="mr-2">⚠</span>Scan could not complete
          </h3>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{scanError}</p>
          <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3 text-xs text-amber-700 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-300">
            <p className="font-medium">Troubleshooting:</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Verify the config directory exists and is readable (e.g. <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">/etc/nginx</code>).</li>
              <li>Check the app process has permission to read Nginx config files.</li>
              <li>When running in Docker, mount the host Nginx config directory into the container.</li>
              <li>If the scan API is not yet deployed, import sites manually via the link manager.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ----- Results table ----- */}
      {sites.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Discovered sites <span className="ml-1 font-normal text-slate-500">({sites.length})</span>
            </h2>
            <button
              type="button"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
              onClick={() => selectAll(!allSelected)}
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="hidden grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
            <div className="col-span-1">Select</div>
            <div className="col-span-3">Site name</div>
            <div className="col-span-3">Inferred URL</div>
            <div className="col-span-1">Proto</div>
            <div className="col-span-1">Port</div>
            <div className="col-span-1">Proxy</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {sites.map((site, i) => (
            <div
              key={i}
              className={cn(
                "flex flex-wrap items-center gap-4 border-t border-slate-200 p-4 transition lg:grid lg:grid-cols-12",
                site.selected ? "bg-brand-50/40 dark:bg-brand-900/15" : "",
              )}
            >
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={site.selected}
                  onChange={() => toggleSelect(i)}
                  className="h-4 w-4 rounded border-slate-300 bg-white text-brand-600 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600"
                />
              </div>
              <div className="col-span-3 font-medium text-slate-900 dark:text-white">{site.name}</div>
              <div className="col-span-3 break-all text-sm text-slate-500">{displayUrl(site)}</div>
              <div className="col-span-1 text-sm text-slate-500">{site.protocol}</div>
              <div className="col-span-1 text-sm tabular-nums text-slate-500">{site.port}</div>
              <div className="col-span-1 text-sm">
                {site.hasProxyPass ? (
                  <span className="inline-flex rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    Proxy
                  </span>
                ) : (
                  <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    Static
                  </span>
                )}
              </div>
              <div className="flex w-full justify-end gap-2 lg:w-auto lg:col-span-2">
                <button
                  type="button"
                  className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/30"
                  onClick={() => openEdit(i)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                  onClick={() => setSites((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-400 dark:border-slate-700">
            {selectedCount} of {sites.length} selected.
          </div>
        </div>
      )}

      {/* ----- Bulk import bar ----- */}
      {sites.length > 0 && (
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Import settings</h2>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Domain resolution mode
              </label>
              <select
                className={selectBase}
                value={domainMode}
                onChange={(e) => setDomainMode(e.target.value as "keep" | "replace")}
              >
                <option value="keep">Keep original server_name (original URLs)</option>
                <option value="replace">Replace with NAS_HOST + path</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {"keep" === domainMode
                  ? "Links keep the original server_name URLs (e.g. media.example.com)."
                  : `Links become ${hostAddress}${domainMode === "replace" ? "" : ""} + relative path.`}
              </p>
            </div>
            {domainMode === "replace" && (
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  NAS host
                </label>
                <input
                  className={inputBase}
                  value={hostAddress}
                  onChange={(e) => setHostAddress(e.target.value)}
                  placeholder="192.168.1.50"
                />
              </div>
            )}
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Target category <span className="text-red-500">*</span>
              </label>
              <select
                className={selectBase}
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                required
              >
                <option value="">Select a category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <button
                type="button"
                disabled={importLoading}
                className="btn-primary disabled:opacity-50"
                onClick={runImport}
              >
                {importLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Importing…
                  </span>
                ) : (
                  `Import ${selectedCount} selected`
                )}
              </button>
            </div>
          </div>

          {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
          {importError && (
            <p className="mt-3 text-sm text-red-600">{importError}</p>
          )}
          {importSummary && (
            <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300">
              <span className="font-semibold">Import complete.</span>
              {" "}Added: <span className="font-medium">{importSummary.added}</span>
              {" · "}Updated: <span className="font-medium">{importSummary.updated}</span>
              {" · "}Skipped: <span className="font-medium">{importSummary.skipped}</span>
              {importSummary.errors > 0 && (
                <span>{" · "}Errors: <span className="font-medium">{importSummary.errors}</span></span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ----- Empty state (no scan yet / no sites) ----- */}
      {sites.length === 0 && !scanLoading && !scanError && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
          <svg className="mx-auto h-10 w-10 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm-2.5 3v4h1.5V5h2.5v4h1.5l.5-4h2v8h-2l-.5-4h-1.5v4H7.5V5H6z" />
          </svg>
          <p className="mt-2 font-medium">No sites scanned yet</p>
          <p className="mt-1">
            Set your Nginx config directory above and click <span className="font-medium text-brand-600 dark:text-brand-400">Scan</span>.
          </p>
        </div>
      )}

      {/* ----- Edit modal ----- */}
      <div
        className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", !editOpen && "hidden")}
        onClick={() => setEditOpen(false)}
        role="dialog"
        aria-modal="true"
      >
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
        {editForm && (
          <div
            className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit site</h2>
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                onClick={() => setEditOpen(false)}
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Name
                </label>
                <input
                  className={inputBase}
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  URL
                </label>
                <input
                  className={inputBase}
                  value={editForm.url}
                  onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Protocol
                  </label>
                  <select
                    className={selectBase}
                    value={editForm.protocol}
                    onChange={(e) => setEditForm({ ...editForm, protocol: e.target.value })}
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Port
                  </label>
                  <input
                    className={inputBase}
                    type="number"
                    value={editForm.port}
                    onChange={(e) => setEditForm({ ...editForm, port: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <input
                  className={inputBase}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              {editForm.configPath && (
                <p className="text-xs text-slate-400">
                  Source: <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">{editForm.configPath}</code>
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setEditOpen(false)}>Cancel</button>
                <button type="button" className="btn-primary" onClick={saveEdit}>Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
