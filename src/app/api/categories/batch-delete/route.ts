// POST /api/categories/batch-delete  { ids: string[] }
// Deletes multiple categories by id. Requires authentication.
// Links inside each category are removed via Prisma onDelete: Cascade.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";

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

  const result = await db.category.deleteMany({ where: { id: { in: ids } } });

  return NextResponse.json({ success: result.count });
}
