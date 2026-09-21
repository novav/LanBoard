// T7 - POST /api/favicons/upload  (multipart/form-data)
// Upload an icon image, validate, compress/resize to 64x64 PNG via sharp,
// and return it as a base64 data URL. Requires authentication.

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { requireAuth } from "@/lib/auth-guard";

const MAX_SIZE_BYTES = 500 * 1024; // 500KB
const TARGET_SIZE = 64;

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);

const ALLOWED_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  if (!req.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return NextResponse.json(
      { error: "multipart_form_required" },
      { status: 400, headers: CORS },
    );
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "file_required" }, { status: 400, headers: CORS });
  }

  // Size check.
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "file_too_large" },
      { status: 400, headers: CORS },
    );
  }

  // Type check (mime + extension).
  if (!ALLOWED_TYPES.has(file.type.toLowerCase())) {
    return NextResponse.json(
      { error: "unsupported_file_type" },
      { status: 400, headers: CORS },
    );
  }
  const ext = (file.name?.split(".").pop() ?? "").toLowerCase();
  if (ext && !ALLOWED_EXTS.has(`.${ext}`)) {
    return NextResponse.json(
      { error: "unsupported_file_type" },
      { status: 400, headers: CORS },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: "empty_file" }, { status: 400, headers: CORS });
    }

    // SVG files are converted to PNG by sharp's rasterization.
    const output = await sharp(buffer)
      .resize(TARGET_SIZE, TARGET_SIZE, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png({ compressionLevel: 6 })
      .toBuffer();

    const base64 = output.toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    return NextResponse.json(
      { dataUrl, mimeType: "image/png" },
      { status: 200, headers: CORS },
    );
  } catch {
    return NextResponse.json(
      { error: "image_process_failed" },
      { status: 400, headers: CORS },
    );
  }
}
