// T7 - POST /api/links/batch-favicon  { ids: string[] }
// Traverse each link, auto-extract its favicon, and update Link.icon.
// Returns { success, failed }. Requires authentication.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";

const TIMEOUT_MS = 5000;

export async function OPTIONS() {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  return new NextResponse(null, { status: 204, headers });
}

async function fetchFaviconForUrl(url: string): Promise<string | null> {
  let domain: string;
  let origin: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    domain = parsed.hostname;
    origin = parsed.origin; // e.g. "http://192.168.1.10:8096"
    if (!domain) return null;
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  async function tryFetch(u: string, accept?: string): Promise<Response | null> {
    try {
      const res = await fetch(u, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          Accept: accept || "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      });
      return res.ok ? res : null;
    } catch {
      return null;
    }
  }

  try {
    // Priority A: Parse HTML <link rel="icon"> tags
    const htmlRes = await tryFetch(origin, "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
    if (htmlRes) {
      const html = await htmlRes.text();
      const iconMatch = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i);
      if (iconMatch) {
        const iconHref = iconMatch[1];
        const iconUrl = iconHref.startsWith("http") ? iconHref : `${origin}${iconHref.startsWith("/") ? "" : "/"}${iconHref}`;
        const iconRes = await tryFetch(iconUrl);
        if (iconRes) {
          const blob = await iconRes.blob();
          if (blob.size > 0) return await blobToBase64(blob);
        }
      }
    }

    // Priority B: Try /favicon.ico
    const faviconRes = await tryFetch(`${origin}/favicon.ico`);
    if (faviconRes) {
      const blob = await faviconRes.blob();
      if (blob.size > 0) return await blobToBase64(blob);
    }

    // Priority C: Try web manifest.json (PWA-style apps like Jellyfin).
    const manifestUrl = new URL(`${origin}/web/manifest.json`).href;
    const manifestRes = await tryFetch(manifestUrl, "application/manifest+json,application/json,*/*");
    if (manifestRes) {
      const manifestText = await manifestRes.text();
      const manifestMatch = manifestText.match(/"icons"\s*:\s*\[(.*?)\]/is);
      if (manifestMatch) {
        const srcMatch = manifestMatch[1].match(/"src"\s*:\s*"([^"]+)"/i);
        if (srcMatch) {
          // Resolve relative to manifest URL (e.g. /web/manifest.json -> /web/touchicon72.png)
          const iconHref = srcMatch[1];
          const iconUrl = iconHref.startsWith("http") ? iconHref : new URL(iconHref, manifestUrl).href;
          const iconRes = await tryFetch(iconUrl);
          if (iconRes) {
            const blob = await iconRes.blob();
            if (blob.size > 0) return await blobToBase64(blob);
          }
        }
      }
    }

    // Priority D: Google favicon API (uses hostname without port)
    const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    const googleRes = await tryFetch(googleUrl);
    if (googleRes) {
      const blob = await googleRes.blob();
      if (blob.size > 0) return await blobToBase64(blob);
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
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

  const ids = body.ids as unknown;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids_array_required" }, { status: 400 });
  }
  if (!ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "ids_must_be_strings" }, { status: 400 });
  }

  const existing = await db.link.findMany({
    where: { id: { in: ids } },
    select: { id: true, url: true },
  });
  const lookup = new Map(existing.map((l) => [l.id, l.url]));

  const headers = { "Access-Control-Allow-Origin": "*" };
  let success = 0;
  let failed = 0;

  for (const id of ids) {
    const url = lookup.get(id);
    if (!url) {
      failed++;
      continue;
    }
    try {
      const dataUrl = await fetchFaviconForUrl(url);
      if (dataUrl) {
        await db.link.update({
          where: { id },
          data: { icon: dataUrl },
        });
        success++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ success, failed }, { headers });
}
