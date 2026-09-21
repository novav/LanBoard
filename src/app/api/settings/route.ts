// T4 - GET/POST /api/settings — read/update site settings.
// GET returns only public settings to unauthenticated visitors.
// POST updates one or more settings (admin only).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, checkAuth } from "@/lib/auth-guard";

// Setting keys that are safe to expose publicly.
const PUBLIC_KEYS = [
  "siteName",
  "siteLogo",
  "siteDescription",
  "themeColor",
  "searchEngines",
];

async function getAllSettings() {
  return db.setting.findMany().then((rows) =>
    rows.reduce<Record<string, string>>((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {}),
  );
}

export async function GET() {
  const session = await checkAuth();
  const all = await getAllSettings();

  if (session) {
    return NextResponse.json(all);
  }

  const publicSettings: Record<string, string> = {};
  for (const key of [...PUBLIC_KEYS]) {
    if (key in all) {
      publicSettings[key] = all[key];
    }
  }
  return NextResponse.json(publicSettings);
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const updates = Object.entries(body).map(([key, value]) => ({
    key: String(key),
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));

  if (updates.length === 0) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }

  const results: Record<string, string> = {};

  for (const u of updates) {
    const s = await db.setting.upsert({
      where: { key: u.key },
      create: { key: u.key, value: u.value },
      update: { value: u.value },
    });
    results[s.key] = s.value;
  }

  return NextResponse.json(results);
}
