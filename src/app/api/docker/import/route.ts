// T10 - POST /api/docker/import — batch import scanned Docker containers as
// Links. Requires authentication.
//
// Request body:
//   {
//     containers: [{
//       id: string,           // container id
//       title: string,
//       url: string,
//       icon?: string | null,
//       category?: string,     // category name -> resolved to categoryId
//     }],
//     targetCategoryId?: string,
//     strategy?: "skip" | "create-per-category" | "create-category",
//   }
//
//   - `targetCategoryId` forces every link into a single existing category.
//   - `strategy`:
//     • "skip"             — only import containers not already imported.
//     • "create-category"  — create a new category named <category> if missing.
//     • "create-per-category" — default; create a category for each distinct
//       recommended category that does not yet exist.
//
// De-duplication: containers whose id already has a DOCKER_SCAN Link are skipped.

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

type ImportContainer = {
  id: string;
  title: string;
  url: string;
  icon?: string | null;
  category?: string | null;
  isPrivate?: boolean;
};

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const raw = body.containers;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "empty_containers" }, { status: 400 });
  }

  const containers: ImportContainer[] = raw
    .map((c: unknown) => {
      const o = c as Record<string, unknown>;
      const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : null;
      const url = typeof o.url === "string" && o.url.trim() ? o.url.trim() : null;
      const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : null;
      return {
        id: id ?? "",
        title: title ?? "",
        url: url ?? "",
        icon: typeof o.icon === "string" && o.icon.trim() ? o.icon.trim() : null,
        category: typeof o.category === "string" && o.category.trim() ? o.category.trim() : null,
        isPrivate: o.isPrivate === true,
      };
    })
    .filter((c) => c.id && c.title && c.url);

  const targetCategoryId =
    typeof body.targetCategoryId === "string" && body.targetCategoryId.trim()
      ? body.targetCategoryId.trim()
      : null;
  const strategy: string = typeof body.strategy === "string" ? body.strategy : "create-per-category";

  if (targetCategoryId) {
    const exists = await db.category.findUnique({ where: { id: targetCategoryId } });
    if (!exists) {
      return NextResponse.json({ error: "target_category_not_found" }, { status: 404 });
    }
  }

  // Pre-fetched lookup maps
  const existingLinks = await db.link.findMany({
    where: { source: "DOCKER_SCAN", containerId: { not: null } },
    select: { containerId: true },
  });
  const alreadyImported = new Set(existingLinks.map((l) => l.containerId!));

  const existingCategories = await db.category.findMany({
    select: { id: true, name: true, path: true },
  });
  const categoryByName = new Map(
    existingCategories.map((c) => [c.name.toLowerCase(), c.id]),
  );
  const categoryByPath = new Map(
    existingCategories.map((c) => [c.path.toLowerCase(), c.id]),
  );
  const categoryById = new Map(
    existingCategories.map((c) => [c.id, c.name]),
  );

  const created: Array<{
    id: string;
    title: string;
    url: string;
    categoryId: string;
    categoryName: string;
  }> = [];
  const skipped: Array<{ id: string; title: string; reason: string }> = [];
  const errors: Array<{ id: string; title: string; reason: string }> = [];

  // Build the set of category names we need (when not using targetCategoryId).
  const distinctCategoryNames = new Set<string>();
  for (const c of containers) {
    if (c.category) distinctCategoryNames.add(c.category);
  }

  // Resolve or create categories.
  const resolvedCategoryIds = new Map<string, string>();
  if (targetCategoryId) {
    for (const c of containers) {
      resolvedCategoryIds.set(c.id, targetCategoryId);
    }
  } else {
    for (const c of containers) {
      const name = c.category || "Uncategorized";
      const path = name; // Use name as path for flat hierarchy
      const key = name.toLowerCase();
      const existingId = categoryByName.get(key) || categoryByPath.get(path.toLowerCase());
      if (existingId) {
        resolvedCategoryIds.set(c.id, existingId);
        continue;
      }
      if (strategy === "create-per-category" || strategy === "create-category") {
        // Check if we already created this category in this batch
        if (!categoryByName.has(key)) {
          // Create the category with path field
          const cat = await db.category.create({
            data: { name, path, icon: name },
          });
          categoryByName.set(key, cat.id);
          categoryByPath.set(path.toLowerCase(), cat.id);
        }
        resolvedCategoryIds.set(c.id, categoryByName.get(key)!);
      } else {
        // "skip" strategy with no target: cannot place link, mark error.
        errors.push({ id: c.id, title: c.title, reason: "no_category" });
      }
    }
  }

  for (const c of containers) {
    const categoryId = resolvedCategoryIds.get(c.id);
    if (!categoryId) {
      continue; // already recorded as error or unreachable
    }

    if (alreadyImported.has(c.id)) {
      skipped.push({ id: c.id, title: c.title, reason: "already_imported" });
      continue;
    }

    if (!isValidUrl(c.url)) {
      errors.push({ id: c.id, title: c.title, reason: "invalid_url" });
      continue;
    }

    const data: Prisma.LinkCreateInput = {
      category: { connect: { id: categoryId } },
      title: c.title,
      url: c.url,
      source: "DOCKER_SCAN",
      containerId: c.id,
      isPrivate: c.isPrivate ?? false,
    };
    // Don't save icon slug - let batch-favicon fetch real icons instead
    // if (c.icon) data.icon = c.icon;

    const link = await db.link.create({ data });
    created.push({
      id: link.id,
      title: link.title,
      url: link.url,
      categoryId,
      categoryName: categoryById.get(categoryId) ?? c.category ?? "Uncategorized",
    });
    alreadyImported.add(c.id);
  }

  // Auto-fetch favicons for newly created links
  const createdIds = created.map((l) => l.id);
  if (createdIds.length > 0) {
    try {
      await fetch(new URL("/api/links/batch-favicon", req.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: createdIds }),
      });
    } catch {
      // Ignore favicon fetch errors - links are still imported
    }
  }

  return NextResponse.json({
    created: created.length,
    skipped: skipped.length,
    errors: errors.length,
    createdLinks: created,
    skippedDetails: skipped,
    errorDetails: errors,
  });
}
