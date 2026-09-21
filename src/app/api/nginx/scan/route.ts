// T13 - POST /api/nginx/scan — scan nginx config directory for sites.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { parseNginxConf } from "@/lib/nginx-parser";

const DEFAULT_NGINX_CONF_PATH = "/etc/nginx";

export async function POST(_req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  // Read config path from settings, default to /etc/nginx.
  const settings = await db.setting.findMany();
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  let confPath: string | null = null;
  if ("nginx:confPath" in settingsMap) {
    confPath = settingsMap["nginx:confPath"] || null;
  }

  const resolvedRoot = confPath || DEFAULT_NGINX_CONF_PATH;

  // Pre-flight directory existence / readability.
  const fs = await import("node:fs");
  let dirReachable = false;
  try {
    const st = fs.statSync(resolvedRoot);
    dirReachable = st.isDirectory();
  } catch {
    dirReachable = false;
  }

  if (!dirReachable) {
    return NextResponse.json(
      {
        error: "conf_dir_unreachable",
        hint: `Nginx config directory "${resolvedRoot}" does not exist or is not readable from this process. ` +
          "Run NavBox on the same host as Nginx, or set nginx:confPath in Settings to the config root " +
          "and mount that directory into the NavBox container.",
      },
      { status: 400 },
    );
  }

  const result = await parseNginxConf(resolvedRoot);

  const errors = result.errors.length > 0
    ? `Partial parse errors: ${result.errors.map((e) => `${e.file}: ${e.message}`).join("; ")}`
    : null;

  return NextResponse.json({
    sites: result.sites,
    errors,
  });
}
