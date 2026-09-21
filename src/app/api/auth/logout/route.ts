// POST /api/auth/logout — destroy session + clear cookie.
import { NextRequest, NextResponse } from "next/server";
import {
  getSessionIdFromCookie,
  verifySessionId,
  deleteSession,
  clearSession,
} from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  const sessionId = getSessionIdFromCookie(cookies());

  if (sessionId) {
    const session = await verifySessionId(sessionId);
    if (session) {
      await deleteSession(sessionId);
    }
  }

  const res = NextResponse.json({ success: true, redirect: "/admin/login" });
  clearSession(res);
  return res;
}
