// T4 - GET/POST /api/links — list/create links (admin for write).
// GET supports ?q=xxx fuzzy search on title/description/url; unauthenticated visitors
// see only links in non-private categories (isPrivate category or link filtered).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAuth, requireAuth } from "@/lib/auth-guard";
import type { Prisma } from "@prisma/client";

function isValidUrl(value: string): boolean {
  if (!value.startsWith("http://") && !value.startsWith("https://")) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const session = await checkAuth();
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? undefined;

  const where: Record<string, unknown> = {};

  if (q) {
    const term = `%${q}%`;
    where.OR = [
      { title: { contains: term } },
      { description: { contains: term } },
      { url: { contains: term } },
    ];
  }

  // Unauthenticated: hide private links and links in private categories.
  if (!session) {
    where.isPrivate = false;
    where.category = { isPrivate: false };
  }

  const links = await db.link.findMany({
    where,
    orderBy: [
      { category: { sortOrder: "asc" } },
      { sortOrder: "desc" },
    ],
    include: {
      category: { select: { id: true, name: true, icon: true, isPrivate: true } },
    },
  });

  return NextResponse.json(links);
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

  const { categoryId, title, url, icon, description, isPrivate, source, containerId, sortOrder } = body;

  if (!categoryId || typeof categoryId !== "string") {
    return NextResponse.json({ error: "category_id_required" }, { status: 400 });
  }
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }
  if (!url || typeof url !== "string" || !isValidUrl(url)) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  const categoryExists = await db.category.findUnique({ where: { id: categoryId } });
  if (!categoryExists) {
    return NextResponse.json({ error: "category_not_found" }, { status: 404 });
  }

  const data: Prisma.LinkCreateInput = {
    category: { connect: { id: categoryId } },
    title: title.trim(),
    url,
    isPrivate: isPrivate === true,
    source: typeof source === "string" ? source : "MANUAL",
    ...(typeof icon === "string" && icon.trim() ? { icon: icon.trim() } : {}),
    ...(typeof description === "string" && description.trim() ? { description: description.trim() } : {}),
    ...(typeof containerId === "string" && containerId.trim() ? { containerId: containerId.trim() } : {}),
    ...(typeof sortOrder === "number" ? { sortOrder } : {}),
  };

  const link = await db.link.create({
    data,
    include: { category: { select: { id: true, name: true } } },
  });

  return NextResponse.json(link, { status: 201 });
}
