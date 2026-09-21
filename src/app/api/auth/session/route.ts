// GET /api/auth/session — current logged-in user or {error}.
import { NextRequest, NextResponse } from "next/server";
import { getSessionIdFromCookie, verifySessionId } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET() {
  const sessionId =getSessionIdFromCookie(cookies());

  if (!sessionId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const session = await verifySessionId(sessionId);
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  return NextResponse.json({ username: session.username });
}
