// T3 - NavBox auth: bcrypt hashing, server-side Session (DB + HttpOnly Cookie),
// and login lockout bookkeeping (uses the Setting key-value store).

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BCRYPT_COST = 12;

// Cookie key (shared with middleware.ts).
export const SESSION_COOKIE_NAME = "navbox_session";

// Session lifetime.
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days (refresh window)

// Rate-limit / lockout constants.
const LOCKOUT_WINDOW_MS = 5 * 60 * 1000;   // 5 minutes
const LOCKOUT_FAIL_THRESHOLD = 5;           // 5 failures
const LOCKOUT_DURABLE_MS = 30 * 60 * 1000;  // 30 minutes

export interface Session {
  sessionId: string;
  userId: string;
  username: string;
  expiresAt: Date;
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------
function cookieSecure(req?: NextRequest): boolean {
  // Secure-only when actually served over HTTPS.
  // When behind a reverse proxy (NAS), check X-Forwarded-Proto header.
  const proto = req?.headers.get("x-forwarded-proto");
  if (proto) {
    return proto === "https";
  }
  return false;
}

/**
 * Set the session HttpOnly cookie. Value is the sessionId (from createSession).
 */
export function setSessionCookie(
  res: NextResponse,
  sessionId: string,
  req?: NextRequest,
): void {
  res.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: cookieSecure(req),
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: "/",
  });
}

/**
 * Read the sessionId from request cookies.
 */
export function getSessionIdFromCookie(
  cookieStore?: ReturnType<typeof cookies>
): string | null {
  const store = cookieStore ?? cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Clear the session cookie.
 */
export function clearSession(res: NextResponse): void {
  res.cookies.delete(SESSION_COOKIE_NAME);
}

// ---------------------------------------------------------------------------
// Session DB
// ---------------------------------------------------------------------------
export async function createSession(userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { id: sessionId, userId, expiresAt },
  });
  return sessionId;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.session.deleteMany({ where: { id: sessionId } });
}

/**
 * Verify a sessionId. Rejects expired sessions and removes them.
 */
export async function verifySessionId(
  sessionId: string
): Promise<Session | null> {
  const now = new Date();
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: { select: { username: true } } },
  });

  if (!session) return null;
  if (session.expiresAt < now) {
    await db.session.delete({ where: { id: sessionId } });
    return null;
  }

  return {
    sessionId: session.id,
    userId: session.userId,
    username: session.user.username,
    expiresAt: session.expiresAt,
  };
}

// ---------------------------------------------------------------------------
// Login lockout bookkeeping (Setting key-value store)
// ---------------------------------------------------------------------------
const LOCKOUT_KEY = "auth:lockout";

function parseLockout(raw: string | null): { lastFailTime: number; failCount: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { lastFailTime: number; failCount: number };
    if (typeof parsed.lastFailTime === "number" && typeof parsed.failCount === "number") {
      return parsed;
    }
  } catch {
    // ignore malformed
  }
  return null;
}

/**
 * Return true if the account is currently locked out.
 */
export async function isLockedOut(): Promise<boolean> {
  const s = await db.setting.findUnique({ where: { key: LOCKOUT_KEY } });
  const lo = parseLockout(s?.value ?? null);
  if (!lo) return false;

  const { lastFailTime, failCount } = lo;
  const windowEnd = lastFailTime + LOCKOUT_WINDOW_MS;

  if (failCount >= LOCKOUT_FAIL_THRESHOLD && Date.now() < windowEnd) {
    const lockoutEnd = lastFailTime + LOCKOUT_DURABLE_MS;
    return Date.now() < lockoutEnd;
  }

  return false;
}

/**
 * Record a failed login attempt. Returns { success: true } when not locked;
 * { locked: true } if this attempt crosses the threshold.
 */
export async function recordFailure(): Promise<{ success: boolean; locked: boolean }> {
  const s = await db.setting.findUnique({ where: { key: LOCKOUT_KEY } });
  let lo = parseLockout(s?.value ?? null);

  const now = Date.now();
  const windowEnd = (lo?.lastFailTime ?? 0) + LOCKOUT_WINDOW_MS;

  if (lo && now >= windowEnd) {
    lo = null;
  }

  const failCount = (lo?.failCount ?? 0) + 1;
  const lastFailTime = lo ? Math.max(lo.lastFailTime, now) : now;

  await db.setting.upsert({
    where: { key: LOCKOUT_KEY },
    create: { key: LOCKOUT_KEY, value: JSON.stringify({ lastFailTime, failCount }) },
    update: { value: JSON.stringify({ lastFailTime, failCount }) },
  });

  const locked =
    failCount >= LOCKOUT_FAIL_THRESHOLD && now < lastFailTime + LOCKOUT_DURABLE_MS;

  return { success: !locked, locked };
}

/**
 * Record a successful login — reset the failure counter.
 */
export async function recordSuccess(): Promise<void> {
  await db.setting.upsert({
    where: { key: LOCKOUT_KEY },
    create: { key: LOCKOUT_KEY, value: JSON.stringify({ lastFailTime: 0, failCount: 0 }) },
    update: { value: JSON.stringify({ lastFailTime: 0, failCount: 0 }) },
  });
}
