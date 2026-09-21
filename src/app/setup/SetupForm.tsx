// T3 - Setup form component (client).
"use client";

import { FormEvent, useState } from "react";

export default function SetupForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (username !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => ({ error: "unknown" }));
    setLoading(false);

    if (!res.ok) {
      const msgs: Record<string, string> = {
        invalid_request: "Please fill in all fields.",
        admin_exists: "An admin account already exists.",
        invalid_username: "Username must be 2-30 characters.",
        password_too_short: "Password must be at least 8 characters.",
      };
      setError(msgs[data.error] ?? "Something went wrong.");
      return;
    }

    if (data.success) {
      window.location.href = data.redirect ?? "/admin";
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="setup-username"
          className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Username
        </label>
        <input
          id="setup-username"
          type="text"
          required
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="admin"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
        />
      </div>

      <div>
        <label
          htmlFor="setup-password"
          className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Password
        </label>
        <input
          id="setup-password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
        />
      </div>

      <div>
        <label
          htmlFor="setup-confirm"
          className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Confirm Password
        </label>
        <input
          id="setup-confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
