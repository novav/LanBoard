// T4 - PUT/DELETE /api/categories/[id] — update or delete a category (admin only).
// DELETE cascades: links under the category are removed by Prisma onDelete: Cascade.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";

async function getCategory(id: string) {
  return db.category.findUnique({ where: { id } });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  const { id } = params;
  const existing = await getCategory(id);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: { name?: unknown; icon?: unknown; isPrivate?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { name, icon, isPrivate } = body;
  const updateData: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name_must_be_string" }, { status: 400 });
    }
    updateData.name = name.trim();
  }
  if (icon !== undefined) {
    updateData.icon = typeof icon === "string" && icon.trim() ? icon.trim() : null;
  }
  if (isPrivate !== undefined) {
    updateData.isPrivate = isPrivate === true;
  }

  const category = await db.category.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(category);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  const { id } = params;
  const existing = await getCategory(id);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.category.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
