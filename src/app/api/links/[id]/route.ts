// T4 - GET/PUT/DELETE /api/links/[id] — single link details, update, delete (admin for write).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAuth, requireAuth } from "@/lib/auth-guard";

function isValidUrl(value: string): boolean {
  if (!value.startsWith("http://") && !value.startsWith("https://")) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await checkAuth();
  const { id } = params;

  const link = await db.link.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, icon: true, isPrivate: true } },
    },
  });
  if (!link) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Unauthenticated: reject private links / links in private categories.
  if (!session && (link.isPrivate || link.category.isPrivate)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(link);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  const { id } = params;
  const existing = await db.link.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { categoryId, title, url, icon, description, isPrivate, source, containerId, sortOrder } = body;

  if (title !== undefined && (typeof title !== "string" || !title.trim())) {
    return NextResponse.json({ error: "title_must_be_string" }, { status: 400 });
  }
  if (url !== undefined && !isValidUrl(url as string)) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (categoryId !== undefined) {
    if (!categoryId || typeof categoryId !== "string") {
      return NextResponse.json({ error: "category_id_required" }, { status: 400 });
    }
    const cat = await db.category.findUnique({ where: { id: categoryId } });
    if (!cat) {
      return NextResponse.json({ error: "category_not_found" }, { status: 404 });
    }
    updateData.category = { connect: { id: categoryId } };
  }
  if (title !== undefined) updateData.title = (title as string).trim();
  if (url !== undefined) updateData.url = url;
  if (icon !== undefined) updateData.icon = typeof icon === "string" && icon.trim() ? icon.trim() : null;
  if (description !== undefined)
    updateData.description = typeof description === "string" && description.trim() ? description.trim() : null;
  if (isPrivate !== undefined) updateData.isPrivate = isPrivate === true;
  if (source !== undefined) updateData.source = source;
  if (containerId !== undefined)
    updateData.containerId = typeof containerId === "string" && containerId.trim() ? containerId.trim() : null;
  if (sortOrder !== undefined && typeof sortOrder === "number") updateData.sortOrder = sortOrder;

  const link = await db.link.update({
    where: { id },
    data: updateData,
    include: { category: { select: { id: true, name: true } } },
  });

  return NextResponse.json(link);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  const { id } = params;
  const existing = await db.link.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.link.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
