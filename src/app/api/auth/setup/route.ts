// POST /api/auth/setup — create the initial admin (only when User table is empty).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Idempotency / single-admin guard.
  const count = await db.user.count();
  if (count > 0) {
    return NextResponse.json({ error: "admin_exists" }, { status: 403 });
  }

  if (username.trim().length < 2 || username.trim().length > 30) {
    return NextResponse.json({ error: "invalid_username" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: "password_too_short" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: { username: username.trim(), passwordHash },
  });

  const sessionId = await createSession(user.id);

  const res = NextResponse.json({ success: true, redirect: "/admin" });
  setSessionCookie(res, sessionId, req);
  return res;
}
