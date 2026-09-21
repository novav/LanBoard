// POST /api/auth/login — authenticate + issue session cookie.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyPassword,
  isLockedOut,
  recordFailure,
  recordSuccess,
  createSession,
  setSessionCookie,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { username, password } = body;
  if (!username || typeof username !== "string" || !password || typeof password !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const locked = await isLockedOut();
  if (locked) {
    return NextResponse.json({ error: "locked", locked: true }, { status: 429 });
  }

  const user = await db.user.findUnique({ where: { username } });
  if (!user) {
    await recordFailure();
    return NextResponse.json({ error: "invalid_credentials", locked: false }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const { success, locked } = await recordFailure();
    if (locked) {
      return NextResponse.json({ error: "locked", locked: true }, { status: 429 });
    }
    return NextResponse.json({ error: "invalid_credentials", locked: false }, { status: 401 });
  }

  // Success.
  await recordSuccess();
  const sessionId = await createSession(user.id);

  const res = NextResponse.json({ success: true, redirect: "/admin" });
  setSessionCookie(res, sessionId, req);
  return res;
}
