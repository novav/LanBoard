// T8 - POST /api/bookmarks/parse — parse a Netscape Bookmark HTML file and
// return structured categories + links for client-side preview.
// Requires authentication. Accepts multipart/form-data with a single file field
// named "file".
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { parseBookmarks } from "@/lib/bookmark-parser";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["text/html", "text/plain", "application/x-extension-html"];
const ALLOWED_EXTS = [".html", ".htm"];

function isHtmlFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  const lastDot = lower.lastIndexOf(".");
  const ext = lastDot >= 0 ? lower.slice(lastDot) : "";
  if (ALLOWED_EXTS.includes(ext)) return true;
  if (file.type && ALLOWED_TYPES.includes(file.type)) return true;
  return false;
}

function isLikelyBookmarkHtml(text: string): boolean {
  // Netscape Bookmark files contain a NETSCAPE-Bookmark-file-1 DOCTYPE comment.
  if (text.includes("NETSCAPE-Bookmark-file-1")) return true;
  // Fallback: loose <DL>/<A> presence for hand-crafted HTML bookmark dumps.
  const lower = text.toLowerCase();
  return lower.includes("<dl") && lower.includes("<a ");
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  let body: FormData;
  try {
    body = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const file = body.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }

  if (!isHtmlFile(file)) {
    return NextResponse.json(
      { error: "invalid_file_type" },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large" },
      { status: 413 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "file_empty" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const html = buffer.toString("utf8");

  if (!isLikelyBookmarkHtml(html)) {
    return NextResponse.json(
      { error: "unrecognized_bookmark_format" },
      { status: 400 },
    );
  }

  let result;
  try {
    result = parseBookmarks(html);
  } catch (err: any) {
    return NextResponse.json(
      { error: "parse_failed", detail: err?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    fileName: file.name,
    fileSize: file.size,
    categories: result.categories,
    links: result.links,
  });
}
