// T5 - Admin area layout: sidebar navigation + top nav + page content.
// Server component — verifies session against the DB (Node.js runtime) and
// redirects to login if the cookie is missing/stale/invalid.
//
// This is the real session guard.  Middleware only does a cookie-presence
// check because it always runs on Edge Runtime, which Prisma 6 doesn't
// support with SQLite.

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { checkAuth } from "@/lib/auth-guard";
import AdminSidebar from "./components/AdminSidebar";
import AdminTopNav from "./components/AdminTopNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Skip the auth guard for the login page to avoid a self-redirect loop.
  // In Next.js App Router, nested layouts compose — both the parent and child
  // layout render.  So /admin/login/layout.tsx cannot *replace* this layout;
  // we have to detect the login route here and let it through.
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "";
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login")) {
    // Login page is rendered inside this layout as the child — just pass it
    // through.  Its own layout.tsx keeps it out of the admin chrome.
    return <>{children}</>;
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  if (!sessionId) {
    redirect("/admin/login");
  }

  const session = await checkAuth();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar />
      <div className="ml-0 flex min-w-0 flex-1 flex-col md:ml-64">
        <AdminTopNav />
        <main className="flex-1 bg-slate-50 p-6 dark:bg-slate-900">{children}</main>
      </div>
    </div>
  );
}
