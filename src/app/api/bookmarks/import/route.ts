// T8 - POST /api/bookmarks/import — import parsed bookmarks into the database.
// Body:
//   categories: { name: string, path: string }[]
//   links:      { title, url, categoryId, icon? }[]
//   dedup:      "skip" | "overwrite"
//   mergeExistingCategories: boolean  // if a category path already exists, put
//                                     // links into it rather than creating a
//                                     // duplicate (e.g. "书签栏/NAS" →
//                                     // existing "书签栏/NAS").
// Returns a summary of what was created/skipped/errors.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
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

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const categories = Array.isArray(body.categories) ? body.categories : [];
  const links = Array.isArray(body.links) ? body.links : [];
  const dedup = body.dedup === "overwrite" ? "overwrite" : "skip";
  const mergeExisting = body.mergeExistingCategories === true;

  if (categories.length === 0 && links.length > 0) {
    return NextResponse.json({ error: "categories_required" }, { status: 400 });
  }

  // Fetch existing state once for efficient lookups.
  const [existingCategories, existingLinks] = await Promise.all([
    db.category.findMany(),
    db.link.findMany(),
  ]);
  const urlSet = new Set(existingLinks.map((l) => l.url.toLowerCase()));
  const pathMap = new Map(existingCategories.map((c) => [c.path, c]));

  const createdCategories: { id: string; name: string; path: string }[] = [];
  const createdLinks: { id: string; title: string; url: string }[] = [];
  const skipped = { links: 0, reasons: { duplicateUrl: 0, invalidUrl: 0 } };
  const errors: { index: number; title: string; url: string; reason: string }[] = [];

  // Build category path -> db id
  const catIdMap = new Map<string, string>();
  for (const cat of categories) {
    const name = typeof cat?.name === "string" && cat.name.trim() ? cat.name.trim() : "Uncategorized";
    const path = typeof cat?.path === "string" && cat.path.trim() ? cat.path.trim() : name;

    if (mergeExisting && pathMap.has(path)) {
      catIdMap.set(path, pathMap.get(path)!.id);
    } else if (!catIdMap.has(path)) {
      const created = await db.category.create({
        data: { name, path, sortOrder: existingCategories.length + createdCategories.length },
      });
      catIdMap.set(path, created.id);
      createdCategories.push({ id: created.id, name, path });
    }
  }

  for (let i = 0; i < links.length; i++) {
    const link = links[i] as Record<string, unknown>;
    const title = typeof link.title === "string" && link.title.trim() ? link.title.trim() : "";
    const url = typeof link.url === "string" ? link.url.trim() : "";
    const categoryId = typeof link.categoryId === "number" ? link.categoryId : 0;
    const icon = typeof link.icon === "string" && link.icon.trim() ? link.icon.trim() : undefined;

    const cat = categories[categoryId];
    const categoryPath = typeof cat?.path === "string" && cat.path.trim() ? cat.path.trim() : (typeof cat?.name === "string" ? cat.name.trim() : "Uncategorized");
    const targetId = catIdMap.get(categoryPath);

    if (!url || !isValidUrl(url)) {
      skipped.reasons.invalidUrl += 1;
      skipped.links += 1;
      continue;
    }

    const lowerUrl = url.toLowerCase();
    if (urlSet.has(lowerUrl)) {
      if (dedup === "overwrite") {
        // Update the existing link's title/description in its current category
        // rather than duplicating. Keep the original category (merge semantics
        // could re-assign, but overwriting the record in place is safest).
        const existing = existingLinks.find((l) => l.url.toLowerCase() === lowerUrl);
        if (existing) {
          await db.link.update({
            where: { id: existing.id },
            data: {
              title: title || undefined,
              icon: icon || undefined,
            },
          });
        }
        continue;
      }
      skipped.reasons.duplicateUrl += 1;
      skipped.links += 1;
      continue;
    }

    if (!targetId) {
      errors.push({ index: i, title, url, reason: "category_missing" });
      continue;
    }

    const data: Prisma.LinkCreateInput = {
      category: { connect: { id: targetId } },
      title: title || url,
      url,
      isPrivate: false,
      source: "BOOKMARK_IMPORT",
      ...(icon ? { icon } : {}),
    };

    try {
      const created = await db.link.create({ data });
      createdLinks.push({ id: created.id, title, url });
      urlSet.add(lowerUrl);
    } catch (err: any) {
      errors.push({ index: i, title, url, reason: err?.message || "db_error" });
    }
  }

  return NextResponse.json({
    createdCategories,
    createdLinks,
    skipped,
    errors,
  });
}
