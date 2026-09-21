// T5 - Site settings: site title / logo / theme color / search engines,
// admin password change, and NAS host address (for T10 Docker scan).
// Client component — calls /api/settings.
//
// T4's /api/settings POST contract is a flat key-value map:
//   { "<setting-key>": "<value>", ... }
// so we POST settings that way directly.
"use client";

import { FormEvent, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/app/components/I18nProvider";

// Setting key names in the key-value store.
const KEYS = {
  TITLE: "siteName",
  LOGO: "siteLogo",
  THEME: "themeColor",
  SEARCH: "searchEngines",
  HOST: "nas:hostAddress",
  NGINX_CONF: "nginx:confPath",
};

type Theme = "indigo" | "emerald" | "amber" | "rose" | "slate";

const THEME_COLORS: { value: Theme; label: string; swatch: string }[] = [
  { value: "indigo", label: "Indigo", swatch: "bg-brand-600" },
  { value: "emerald", label: "Emerald", swatch: "bg-emerald-600" },
  { value: "amber", label: "Amber", swatch: "bg-amber-500" },
  { value: "rose", label: "Rose", swatch: "bg-rose-600" },
  { value: "slate", label: "Slate", swatch: "bg-slate-600" },
];

// A search engine entry.
type Engine = { name: string; url: string };

const DEFAULT_ENGINES: Engine[] = [
  { name: "Baidu", url: "https://www.baidu.com/s?wd={query}" },
  { name: "Google", url: "https://www.google.com/search?q={query}" },
  { name: "Bing", url: "https://www.bing.com/search?q={query}" },
  { name: "DuckDuckGo", url: "https://duckduckgo.com/?q={query}" },
];

function readEngines(raw: string | null): Engine[] {
  if (!raw) return [...DEFAULT_ENGINES];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // fall through
  }
  return [...DEFAULT_ENGINES];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Site
  const [title, setTitle] = useState("");
  const [logo, setLogo] = useState("");
  const [theme, setTheme] = useState<Theme>("indigo");
  const [savingSite, setSavingSite] = useState(false);

  // Search engines
  const [engines, setEngines] = useState<Engine[]>([...DEFAULT_ENGINES]);
  const [savingEngines, setSavingEngines] = useState(false);

  // NAS
  const [hostAddress, setHostAddress] = useState("");
  const [nginxConfPath, setNginxConfPath] = useState("/etc/nginx");
  const [savingNas, setSavingNas] = useState(false);

  // Password
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/settings");
    const json = await res.json().catch(() => ({ error: "unknown" }));
    if (!res.ok) {
      setError(json.error ?? t('settings.errors.loadFailed'));
    } else {
      const map = json as Record<string, string>;
      setTitle(map[KEYS.TITLE] ?? "");
      setLogo(map[KEYS.LOGO] ?? "");
      const t = map[KEYS.THEME];
      if (THEME_COLORS.find((x) => x.value === t)) setTheme(t as Theme);
      setEngines(readEngines(map[KEYS.SEARCH] ?? null));
      setHostAddress(map[KEYS.HOST] ?? "");
      setNginxConfPath(map[KEYS.NGINX_CONF] ?? "/etc/nginx");
    }
    setLoading(false);
  }

  // Clear dismissible banners after a moment.
  function clearBanners() {
    setSuccess(null);
    setError(null);
  }

  // ----- Save site settings -----
  async function saveSite(e: FormEvent) {
    e.preventDefault();
    clearBanners();
    if (!title.trim()) {
      setError(t('settings.errors.titleRequired'));
      return;
    }
    setSavingSite(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [KEYS.TITLE]: title,
        [KEYS.LOGO]: logo || "",
        [KEYS.THEME]: theme,
      }),
    });
    setSavingSite(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? t('settings.errors.saveFailed'));
    } else {
      setSuccess(t('settings.site.saved'));
    }
  }

  // ----- Save search engines -----
  async function saveEngines(e: FormEvent) {
    e.preventDefault();
    clearBanners();
    const trimmed = engines.map((e) => ({
      name: e.name.trim(),
      url: e.url.trim(),
    })).filter((e) => e.name && e.url);
    if (trimmed.length === 0) {
      setError(t('settings.errors.engineRequired'));
      return;
    }
    setSavingEngines(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [KEYS.SEARCH]: JSON.stringify(trimmed),
      }),
    });
    setSavingEngines(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? t('settings.errors.saveFailed'));
    } else {
      setSuccess(t('settings.search.saved'));
    }
  }

  // ----- Save NAS -----
  async function saveNas(e: FormEvent) {
    e.preventDefault();
    clearBanners();
    setSavingNas(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [KEYS.HOST]: hostAddress || "",
        [KEYS.NGINX_CONF]: nginxConfPath || "/etc/nginx",
      }),
    });
    setSavingNas(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? t('settings.errors.saveFailed'));
    } else {
      setSuccess(t('settings.nas.saved'));
    }
  }

  // ----- Change password -----
  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (!oldPassword || !newPassword || !confirm) {
      setPwError(t('settings.password.errorRequired'));
      return;
    }
    if (newPassword !== confirm) {
      setPwError(t('settings.password.errorMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setPwError(t('settings.password.errorLength'));
      return;
    }
    setSavingPw(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    setSavingPw(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setPwError(d.error ?? t('settings.password.errorFailed'));
    } else {
      setOldPassword("");
      setNewPassword("");
      setConfirm("");
      setPwSuccess(t('settings.password.changed'));
    }
  }

  // ----- Engine row helpers -----
  function addEngine() {
    setEngines((prev) => [...prev, { name: "", url: "" }]);
  }
  function removeEngine(i: number) {
    setEngines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function setEngine(i: number, field: keyof Engine, value: string) {
    setEngines((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)),
    );
  }

  // ----- Render -----
  const inputBase = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white";

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="mb-2 skeleton h-7 w-32" />
          <div className="skeleton h-4 w-72" />
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card">
              <div className="mb-4 skeleton h-5 w-36" />
              <div className="space-y-4">
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-1/2" />
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-slate-400">{t('settings.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('settings.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('settings.subtitle')}
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
          {error}
          <button className="ml-2 font-medium" onClick={clearBanners}>
            {t('settings.dismiss')}
          </button>
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300">
          {success}
          <button className="ml-2 font-medium" onClick={clearBanners}>
            {t('settings.dismiss')}
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Site settings */}
        <form onSubmit={saveSite} className="card">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <span className="h-6 w-6 rounded bg-brand-50 flex items-center justify-center dark:bg-brand-900/30">
              <svg className="h-4 w-4 text-brand-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
              </svg>
            </span>
            {t('settings.site.title')}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('settings.site.siteTitle')} <span className="text-red-500">*</span>
              </label>
              <input
                className={inputBase}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="NavBox"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('settings.site.logoUrl')}
              </label>
              <input
                className={inputBase}
                type="url"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              {logo && (
                <p className="mt-1 text-xs text-slate-500">
                  Preview:{" "}
                  <img
                    src={logo}
                    alt="logo preview"
                    className="inline-block h-6 w-6 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('settings.site.themeColor')}
              </label>
              <div className="flex flex-wrap gap-2">
                {THEME_COLORS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                      theme === t.value
                        ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700",
                    )}
                    onClick={() => setTheme(t.value)}
                  >
                    <span className={cn("h-4 w-4 rounded-full", t.swatch)} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingSite}
                className="btn-primary disabled:opacity-50"
              >
                {savingSite ? t('settings.site.saving') : t('settings.site.save')}
              </button>
            </div>
          </div>
        </form>

        {/* NAS settings */}
        <form onSubmit={saveNas} className="card">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <span className="h-6 w-6 rounded bg-brand-50 flex items-center justify-center dark:bg-brand-900/30">
              <svg className="h-4 w-4 text-brand-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 4a2 2 0 012-2h12a2 2 0 012 2v2H2V4zm0 4h16v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8zm4 3a1 1 0 011-1h1a1 1 0 110 2H7a1 1 0 01-1-1z" />
              </svg>
            </span>
            {t('settings.nas.title')}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('settings.nas.lanAddress')} <span className="text-red-500">*</span>
              </label>
              <input
                className={inputBase}
                value={hostAddress}
                onChange={(e) => setHostAddress(e.target.value)}
                placeholder="http://192.168.1.50:2375 or 192.168.1.50"
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                {t('settings.nas.lanAddressHelp')}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('settings.nas.nginxDir')}
              </label>
              <input
                className={inputBase}
                value={nginxConfPath}
                onChange={(e) => setNginxConfPath(e.target.value)}
                placeholder="/etc/nginx"
              />
              <p className="mt-1 text-xs text-slate-500">
                {t('settings.nas.nginxDirHelp')}
              </p>
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingNas}
                className="btn-primary disabled:opacity-50"
              >
                {savingNas ? t('settings.nas.saving') : t('settings.nas.save')}
              </button>
            </div>
          </div>
        </form>

        {/* Search engines */}
        <form onSubmit={saveEngines} className="card">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <span className="h-6 w-6 rounded bg-brand-50 flex items-center justify-center dark:bg-brand-900/30">
              <svg className="h-4 w-4 text-brand-600" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2.318 8.218a4.837 4.837 0 010-6.796l3.657 3.657A1.976 1.976 0 018 8h3.586l-1.293 1.293A1 1 0 019.414 10H8a1 1 0 01-.707-.293L3.707 5.985 2.318 7.384a4.837 4.837 0 010 6.796l-1.061-1.06a6.77 6.77 0 000-9.534L2.318 8.218z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            {t('settings.search.title')}
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            {t('settings.search.placeholder')}
          </p>
          <div className="space-y-3">
            {engines.map((e, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={cn(inputBase, "flex-1")}
                  value={e.name}
                  onChange={(ev) => setEngine(i, "name", ev.target.value)}
                  placeholder={t('settings.search.name')}
                />
                <input
                  className={cn(inputBase, "flex-[2]")}
                  value={e.url}
                  onChange={(ev) => setEngine(i, "url", ev.target.value)}
                  placeholder={t('settings.search.url')}
                />
                <button
                  type="button"
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                  onClick={() => removeEngine(i)}
                  disabled={engines.length <= 1}
                  aria-label={t('settings.search.remove')}
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
            ))}
            <button
              type="button"
              className="mt-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
              onClick={addEngine}
            >
              {t('settings.search.addEngine')}
            </button>
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingEngines}
                className="btn-primary disabled:opacity-50"
              >
                {savingEngines ? t('settings.search.saving') : t('settings.search.save')}
              </button>
            </div>
          </div>
        </form>

        {/* Change password */}
        <form onSubmit={changePassword} className="card">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <span className="h-6 w-6 rounded bg-brand-50 flex items-center justify-center dark:bg-brand-900/30">
              <svg className="h-4 w-4 text-brand-600" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            {t('settings.password.title')}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('settings.password.current')}
              </label>
              <input
                className={inputBase}
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('settings.password.new')}
              </label>
              <input
                className={inputBase}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('settings.password.confirm')}
              </label>
              <input
                className={inputBase}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            {pwError && (
              <p className="text-sm text-red-600">{pwError}</p>
            )}
            {pwSuccess && (
              <p className="text-sm text-emerald-600">{pwSuccess}</p>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingPw}
                className="btn-primary disabled:opacity-50"
              >
                {savingPw ? t('settings.password.changing') : t('settings.password.change')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
