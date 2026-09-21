// T7 - GET /api/favicons/extract?url=<site>
// Auto-extract a website favicon and return it as a base64 data URL.
// Priority: 1) site's own favicon.ico (https, then http fallback)
//            2) Google Favicon API fallback
// Timeout capped at 5s to avoid blocking.

import { NextRequest, NextResponse } from "next/server";

const TIMEOUT_MS = 5000;
const ICON_SIZE = 64;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function fetchWithinTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<Blob | null> {
  const timeout = options.timeout ?? TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0) return null;
    return blob;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function blobToBase64DataUrl(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = Buffer.from(buffer);
    const mime = blob.type || "image/png";
    const base64 = bytes.toString("base64");
    return `data:${mime};base64,${base64}`;
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawUrl = searchParams.get("url");
  if (!rawUrl || !rawUrl.trim()) {
    return NextResponse.json({ error: "url_query_required" }, { status: 400, headers: CORS });
  }

  let domain: string;
  let origin: string;
  try {
    const parsed = new URL(rawUrl.trim());
    // Require http(s) scheme (reject internal / data URLs).
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "invalid_url" }, { status: 400, headers: CORS });
    }
    domain = parsed.hostname;
    origin = parsed.origin; // e.g. "http://192.168.1.100:3002"
  } catch {
    return NextResponse.json({ error: "invalid_url" }, { status: 400, headers: CORS });
  }

  if (!domain) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400, headers: CORS });
  }

  // Priority A: Parse HTML <link rel="icon"> tags
  try {
    const htmlRes = await fetchWithinTimeout(origin, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (htmlRes) {
      const html = await htmlRes.text();
      const iconMatch = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i);
      if (iconMatch) {
        const iconHref = iconMatch[1];
        const iconUrl = iconHref.startsWith("http") ? iconHref : `${origin}${iconHref.startsWith("/") ? "" : "/"}${iconHref}`;
        const iconBlob = await fetchWithinTimeout(iconUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          },
        });
        if (iconBlob) {
          const dataUrl = await blobToBase64DataUrl(iconBlob);
          return NextResponse.json(
            { dataUrl, source: "html_link" },
            { status: 200, headers: CORS },
          );
        }
      }
    }
  } catch {
    // Continue to fallback methods
  }

  // Priority B: the site's own favicon.ico — use origin (with port)
  const candidates = [
    `${origin}/favicon.ico`,
  ];

  for (const candidate of candidates) {
    const blob = await fetchWithinTimeout(candidate, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Referer": rawUrl.trim(),
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
    if (blob) {
      const dataUrl = await blobToBase64DataUrl(blob);
      return NextResponse.json(
        { dataUrl, source: "favicon.ico" },
        { status: 200, headers: CORS },
      );
    }
  }

  // Priority C: Try web manifest.json (used by PWA-style apps like Jellyfin).
  try {
    const manifestUrl = new URL(`${origin}/web/manifest.json`).href;
    const manifestBlob = await fetchWithinTimeout(manifestUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/manifest+json,application/json,*/*",
      },
    });
    if (manifestBlob) {
      const text = await manifestBlob.text();
      const match = text.match(/"icons"\s*:\s*\[(.*?)\]/is);
      if (match) {
        const srcMatch = match[1].match(/"src"\s*:\s*"([^"]+)"/i);
        if (srcMatch) {
          // Resolve relative to the manifest URL (e.g. manifest at /web/manifest.json
          // -> icon "touchicon72.png" resolves to /web/touchicon72.png)
          const iconHref = srcMatch[1];
          const iconUrl = iconHref.startsWith("http")
            ? iconHref
            : new URL(iconHref, manifestUrl).href;
          const iconBlob = await fetchWithinTimeout(iconUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
              Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            },
          });
          if (iconBlob) {
            const dataUrl = await blobToBase64DataUrl(iconBlob);
            return NextResponse.json(
              { dataUrl, source: "web_manifest" },
              { status: 200, headers: CORS },
            );
          }
        }
      }
    }
  } catch {
    // Continue to fallback methods
  }

  // Priority D: Google Favicon API fallback.
  const googleUrl =
    `https://www.google.com/s2/favicons?domain=${domain}&sz=${ICON_SIZE}`;
  const googleBlob = await fetchWithinTimeout(googleUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  });
  if (googleBlob) {
    const dataUrl = await blobToBase64DataUrl(googleBlob);
    return NextResponse.json(
      { dataUrl, source: "google_api" },
      { status: 200, headers: CORS },
    );
  }

  return NextResponse.json(
    { error: "favicon_not_found" },
    { status: 404, headers: CORS },
  );
}
