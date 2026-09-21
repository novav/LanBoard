// Layout for /admin/login — intentionally skips the AdminLayout auth guard.
//
// The parent AdminLayout calls checkAuth() and redirects unauthenticated
// users to /admin/login. If /admin/login were rendered inside AdminLayout,
// this would become a self-redirect loop (login → login → login ...).
//
// This empty layout overrides AdminLayout for the login page only, so the
// login form renders without triggering the redirect.

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
