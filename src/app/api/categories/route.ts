// T4 - GET /api/categories — list categories (with link counts; unauthenticated visitors skip private).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAuth, requireAuth } from "@/lib/auth-guard";

// POST /api/categories — create a new category (admin only).
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  let body: { name?: unknown; icon?: unknown; isPrivate?: unknown; parentPath?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { name, icon, isPrivate, parentPath } = body;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  const path = typeof parentPath === "string" && parentPath.trim()
    ? `${parentPath.trim()}/${name.trim()}`
    : name.trim();

  // Check if path already exists
  const existing = await db.category.findUnique({ where: { path } });
  if (existing) {
    return NextResponse.json({ error: "path_exists" }, { status: 409 });
  }

  const maxOrder = await db.category.findFirst({
    select: { sortOrder: true },
    orderBy: { sortOrder: "desc" },
  });
  const sortOrder = (maxOrder?.sortOrder ?? -1) + 1;

  const category = await db.category.create({
    data: {
      name: name.trim(),
      path,
      icon: typeof icon === "string" && icon.trim() ? icon.trim() : null,
      isPrivate: isPrivate === true,
      sortOrder,
    },
  });

  return NextResponse.json(category, { status: 201 });
}

export async function GET() {
  const session = await checkAuth();

  const categories = await db.category.findMany({
    where: session ? undefined : { isPrivate: false },
    orderBy: { path: "asc" },
    include: {
      _count: { select: { links: true } },
    },
  });

  return NextResponse.json(
    categories.map((c) => {
      const depth = (c.path.match(/\//g) || []).length;
      const lastSlash = c.path.lastIndexOf("/");
      const parentPath = lastSlash > 0 ? c.path.substring(0, lastSlash) : null;

      return {
        id: c.id,
        name: c.name,
        path: c.path,
        depth,
        parentPath,
        icon: c.icon,
        sortOrder: c.sortOrder,
        isPrivate: c.isPrivate,
        linkCount: c._count.links,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    }),
  );
}
