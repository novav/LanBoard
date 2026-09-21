// T4 - Reusable session authentication guard for API routes.
// Reads sessionId from cookies, verifies it, and returns a helper object
// with an unauthenticated check. Used by Category/Link/Setting write routes.
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionId, type Session } from "@/lib/auth";

/**
 * Verify the session from the request cookies.
 * @returns { authenticated: true, session } when logged in
 *          { authenticated: false, response } to send back 401
 */
export async function requireAuth(): Promise<
  { authenticated: true; session: Session } | { authenticated: false; response: NextResponse }
> {
  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;

  if (!sessionId) {
    return {
      authenticated: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const session = await verifySessionId(sessionId);
  if (!session) {
    return {
      authenticated: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  return { authenticated: true, session };
}

/**
 * Check whether the user is logged in (no 401; caller decides behavior).
 * Used by GET routes that return filtered data for unauthenticated visitors.
 * @returns session object when logged in, or null
 */
export async function checkAuth(): Promise<Session | null> {
  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;

  if (!sessionId) return null;

  const session = await verifySessionId(sessionId);
  return session ?? null;
}
