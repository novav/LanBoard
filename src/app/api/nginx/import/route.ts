// T13 - POST /api/nginx/import — bulk import scanned nginx sites as Links.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import type { NginxSite } from "@/lib/nginx-parser";

function isValidUrl(value: string): boolean {
  if (!value.startsWith("http://") && !value.startsWith("https://")) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** Derive the final URL for a site depending on resolveMode. */
function resolveUrl(site: NginxSite, mode: "keep" | "replace", nasHost?: string): string {
  if (mode === "keep") return site.url;
  if (!nasHost) return site.url;

  const host = nasHost.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  // Default/catch-all server (server_name _): build http://<nasHost>:<port>.
  // No path — this server matches any unmatched Host header.
  if (site.isDefaultServer) {
    const port = site.port;
    return `${site.protocol}://${host}:${port}`;
  }

  // Normal server: build http://<nasHost>/<serverName>.
  // Docker/OpenResty reverse-proxy setups map /<name> to the real service.
  const path = site.name.replace(/^\/+/, "");
  return `http://${host}/${path}`;
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

  const sites = Array.isArray(body.sites) ? body.sites : [];
  if (sites.length === 0) {
    return NextResponse.json({ error: "no_sites" }, { status: 400 });
  }

  const resolveMode = typeof body.resolveMode === "string" && body.resolveMode === "replace"
    ? "replace" as const
    : "keep" as const;
  const targetCategoryId = typeof body.targetCategoryId === "string" && body.targetCategoryId.trim()
    ? body.targetCategoryId.trim()
    : null;
  const nasHost = typeof body.nasHost === "string" && body.nasHost.trim()
    ? body.nasHost.trim()
    : undefined;

  // Validate target category exists.
  if (targetCategoryId) {
    const cat = await db.category.findUnique({ where: { id: targetCategoryId } });
    if (!cat) {
      return NextResponse.json({ error: "category_not_found" }, { status: 404 });
    }
  }

  let created: number = 0;
  let updated: number = 0;
  let skipped: number = 0;
  const errors: Array<{ index: number; siteName: string; message: string }> = [];

  for (let i = 0; i < sites.length; i++) {
    const raw = sites[i] as unknown as Partial<NginxSite>;
    const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "";
    if (!name) {
      skipped++;
      continue;
    }
    const site: NginxSite = {
      name,
      url: typeof raw.url === "string" ? raw.url : "",
      protocol: (raw.protocol as "http" | "https") ?? "http",
      port: typeof raw.port === "number" ? raw.port : 80,
      hasProxyPass: Boolean(raw.hasProxyPass),
      proxyPassTarget: typeof raw.proxyPassTarget === "string" ? raw.proxyPassTarget : undefined,
      fallbackReason: typeof raw.fallbackReason === "string" ? raw.fallbackReason : undefined,
    };

    const finalUrl = resolveUrl(site, resolveMode, nasHost);
    if (!isValidUrl(finalUrl)) {
      errors.push({ index: i, siteName: name, message: "unresolvable URL" });
      continue;
    }

    const categoryId = targetCategoryId;
    if (!categoryId) {
      errors.push({ index: i, siteName: name, message: "no target category" });
      continue;
    }

    try {
      // Upsert by matching an existing link in the target category with the same URL.
      const existing = await db.link.findFirst({
        where: { categoryId, url: finalUrl },
      });
      if (existing) {
        await db.link.update({
          where: { id: existing.id },
          data: { title: name, source: "NGINX_SCAN" },
        });
        updated++;
      } else {
        await db.link.create({
          data: {
            category: { connect: { id: categoryId } },
            title: name,
            url: finalUrl,
            description: site.fallbackReason ? `Nginx scan ${site.fallbackReason}` : "Imported from Nginx scan",
            source: "NGINX_SCAN",
          },
        });
        created++;
      }
    } catch (err) {
      const msg = (err as Error).message ?? "database error";
      errors.push({ index: i, siteName: name, message: msg });
    }
  }

  return NextResponse.json({ created, updated, skipped, errors }, { status: 200 });
}
