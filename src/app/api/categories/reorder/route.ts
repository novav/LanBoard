// T4 - POST /api/categories/reorder — bulk re-order categories (admin only).
// Body: { ids: [id1, id2, ...] } sets sortOrder by position.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids_array_required" }, { status: 400 });
  }

  const idStrings = ids.map((v) => v as string).filter((id) => typeof id === "string" && id);
  if (idStrings.length !== ids.length) {
    return NextResponse.json({ error: "ids_must_be_strings" }, { status: 400 });
  }

  const updates = idStrings.map((id, index) =>
    db.category.update({ where: { id }, data: { sortOrder: index } }),
  );

  const existingIds = new Set(
    (await db.category.findMany({ select: { id: true } })).map((c) => c.id),
  );
  const missing = idStrings.filter((id) => !existingIds.has(id));
  if (missing.length > 0) {
    return NextResponse.json({ error: "category_not_found", missing }, { status: 404 });
  }

  await db.$transaction(updates);
  return NextResponse.json({ success: true });
}
