// T3 - Admin login page.
"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLocked(false);
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => ({ error: "unknown" }));
    setLoading(false);

    if (!res.ok) {
      if (data.locked) {
        setLocked(true);
        setError("Too many failed attempts. Please wait 30 minutes.");
      } else {
        setError("Invalid username or password.");
      }
      return;
    }

    if (data.success) {
      window.location.href = data.redirect ?? "/admin";
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-grid p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2 text-2xl font-bold tracking-tight">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-lg shadow-brand-600/25">
            L
          </span>
          <span className="gradient-text">NavBox</span>
        </div>

        <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-2xl p-8 shadow-xl dark:bg-slate-800/80 dark:border-slate-700">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Sign in to Admin
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Your NAS navigation hub
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="username"
                className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={locked}
                placeholder="admin"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={locked}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
              />
            </div>

            {(error || locked) && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || locked}
              className="w-full btn-primary disabled:opacity-50"
            >
              {loading ? "Signing in…" : locked ? "Locked out" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          NavBox © 2026 — NAS Navigation Hub
        </p>
      </div>
    </div>
  );
}
