// T3 - First-run setup wizard. Creates the initial admin account.
//
// Server-side check: if a User already exists, 302 to /admin/login.
// Client-side: admin creation form posting to /api/auth/setup.
import { redirect } from "next/navigation";
import SetupForm from "./SetupForm";

// Render at runtime (not prerendered) so the DB is reachable in all deploy
// targets (standalone / docker).
export const dynamic = "force-dynamic";

async function hasAdmin(): Promise<boolean> {
  const { db } = await import("@/lib/db");
  const count = await db.user.count();
  return count > 0;
}

export default async function SetupPage() {
  const adminExists = await hasAdmin();
  if (adminExists) {
    redirect("/admin/login");
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
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-600">
            First run
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Set up your account
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create the admin account to get started.
          </p>

          <SetupForm />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          NavBox © 2026 — NAS Navigation Hub
        </p>
      </div>
    </div>
  );
}
