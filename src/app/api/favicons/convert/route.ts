// T7 - POST /api/favicons/convert
// Download an icon from a given URL, convert it to a base64 data URL,
// and return it. Requires authentication.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";

const TIMEOUT_MS = 5000;
const MAX_BYTES = 2 * 1024 * 1024; // 2MB raw image limit

function isValidIconUrl(value: string): value is string {
  if (!value.startsWith("http://") && !value.startsWith("https://")) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isValidMime(mime: string): boolean {
  return /^image\/(png|jpg|jpeg|webp|gif|svg\+xml|x-icon)/.test(mime);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function fetchWithTimeout(
  url: string,
  timeout: number = TIMEOUT_MS,
): Promise<{ data: Uint8Array; mime?: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const contentLength = Number(res.headers.get("content-length")) || 0;
    if (contentLength > MAX_BYTES) return null;

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) return null;
    if (buffer.byteLength > MAX_BYTES) return null;

    return {
      data: new Uint8Array(buffer),
      mime: res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: CORS });
  }

  const iconUrl = body.iconUrl as string | undefined;
  if (!iconUrl || !isValidIconUrl(iconUrl)) {
    return NextResponse.json({ error: "invalid_icon_url" }, { status: 400, headers: CORS });
  }

  const result = await fetchWithTimeout(iconUrl.trim());
  if (!result) {
    return NextResponse.json({ error: "download_failed" }, { status: 400, headers: CORS });
  }

  const { data, mime } = result;
  // If the MIME isn't clearly an image, only accept if it looks like a known icon
  // (many favicon endpoints omit a clear Content-Type).
  if (mime !== undefined && !isValidMime(mime)) {
    return NextResponse.json({ error: "unsupported_mime_type" }, { status: 400, headers: CORS });
  }

  const base64 = Buffer.from(data).toString("base64");
  const mimeType = mime ?? "image/png";
  const dataUrl = `${mimeType.startsWith("data:") ? mimeType : `data:${mimeType};base64`},${base64}`;

  return NextResponse.json(
    { dataUrl, mimeType },
    { status: 200, headers: CORS },
  );
}
