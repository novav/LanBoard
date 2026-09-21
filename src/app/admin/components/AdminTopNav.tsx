// Top nav bar shared across admin pages: shows current user + logout.
// Renders on every /admin page (except /admin/login) via the layout.
// Uses the public GET /api/auth/session endpoint to resolve the username client-side.

"use client";

import { useEffect, useState } from "react";

export default function AdminTopNav() {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        setUsername(data.username ?? null);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <header className="border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-800/80">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {loading ? "Loading…" : username ? `Signed in as ${username}` : "Admin"}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleLogout}
          >
            <svg
              className="mr-1.5 h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-2 0V5H6v10h10v-1a1 1 0 012 0v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
              <path d="M8 7h8M8 10h8" stroke="currentColor" strokeWidth="0" />
              <path
                fillRule="evenodd"
                d="M7 3a1 1 0 011 1v1h10a1 1 0 110 2H8V8a1 1 0 01-2 0V4a1 1 0 011-1zM3 8a1 1 0 011-1h6a1 1 0 010 2H4a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
              <path d="M11 9l4 1-4 1V9z" fill="currentColor" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
