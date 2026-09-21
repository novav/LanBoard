// T9 - POST /api/data/import — Import JSON backup (multipart/form-data).
// Source detection:
//   - source === "lanboard"  → NavBox native format
//   - otherwise              → OneNav-compatible fallback
// OneNav mapping:
//   category.name | logo/icon
//   link.title | url | logo/icon | desc/description | sort
//
// Returns: { createdCategories, createdLinks, skipped, errors }

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";

// ---------------------------------------------------------------------------
// Normalized internal shapes
// ---------------------------------------------------------------------------
type ImportLink = {
  title: string;
  url: string;
  icon?: string;
  description?: string;
  sortOrder: number;
};
type ImportCategory = {
  name: string;
  icon?: string;
  sortOrder: number;
  links: ImportLink[];
};

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------
function parseNavBox(raw: Record<string, unknown>): ImportCategory[] {
  const categories = Array.isArray(raw.categories) ? raw.categories : [];
  return categories
    .map((c: Record<string, unknown>) => ({
      name: String(c.name ?? "").trim(),
      icon: pickStr(c.icon),
      sortOrder: num(c.sortOrder, 0),
      links: (Array.isArray(c.links) ? c.links : [])
        .map((l: Record<string, unknown>) => ({
          title: String(l.title ?? "").trim(),
          url: String(l.url ?? "").trim(),
          icon: pickStr(l.icon),
          description: pickStr(l.description),
          sortOrder: num(l.sortOrder, 0),
        }))
        .filter((l) => l.title && l.url),
    }))
    .filter((c) => c.name);
}

function parseOneNav(raw: Record<string, unknown>): ImportCategory[] {
  const cats: unknown[] = [];

  // Top-level `categories` or wrapped `data.categories`
  if (Array.isArray(raw.categories)) {
    cats.push(...raw.categories);
  } else if (raw.data && Array.isArray((raw.data as Record<string, unknown>).categories)) {
    cats.push(...((raw.data as Record<string, unknown>).categories as unknown[]));
  }

  return (cats as Record<string, unknown>[])
    .map((c: Record<string, unknown>) => ({
      name: String(c.name ?? "").trim(),
      icon: pickStr(c.icon) ?? pickStr(c.logo),
      sortOrder: num(c.sort, 0),
      links: (Array.isArray(c.links) ? c.links : [])
        .map((l: Record<string, unknown>) => ({
          title: String(l.title ?? "").trim(),
          url: String(l.url ?? "").trim(),
          icon: pickStr(l.icon) ?? pickStr(l.logo),
          description: pickStr(l.description) ?? pickStr(l.desc),
          sortOrder: num(l.sort, 0),
        }))
        .filter((l) => l.title && l.url),
    }))
    .filter((c) => c.name);
}

function pickStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function num(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function isValidUrl(u: string): boolean {
  return /^https?:\/\//.test(u);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  const strategy: "skip" | "overwrite" = "skip";

  let raw: Record<string, unknown> | null = null;
  let parseError: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "file_required", message: "Please upload a JSON file (form field 'file')." }, { status: 400 });
    }

    const text = await file.text();
    raw = JSON.parse(text);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ error: "invalid_json", message: "JSON root must be an object." }, { status: 400 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: "parse_failed", message: msg }, { status: 400 });
  }

  // Source detection
  const categories = raw.source === "lanboard" ? parseNavBox(raw) : parseOneNav(raw);

  if (categories.length === 0) {
    return NextResponse.json({
      error: "no_categories",
      message: "No categories found. The file may not be in a supported format.",
    }, { status: 400 });
  }

  const result = {
    createdCategories: 0 as number,
    createdLinks: 0 as number,
    skipped: 0 as number,
    errors: [] as string[],
  };

  // Collect existing links (by normalized URL) and categories (by normalized name) for dedup.
  const existingCategories = new Map<string, string>(); // name -> id
  for (const c of await db.category.findMany()) {
    existingCategories.set(c.name.toLowerCase(), c.id);
  }
  const existingLinks = new Map<string, string>(); // url -> id
  for (const l of await db.link.findMany()) {
    existingLinks.set(normalizeUrl(l.url), l.id);
  }

  for (const c of categories) {
    let categoryId: string | undefined;

    // Match or create category
    const existingCatId = existingCategories.get(c.name.toLowerCase());
    if (existingCatId) {
      categoryId = existingCatId;
    } else {
      const newCat = await db.category.create({
        data: {
          name: c.name,
          icon: c.icon ?? undefined,
          sortOrder: c.sortOrder,
        },
      });
      categoryId = newCat.id;
      existingCategories.set(c.name.toLowerCase(), categoryId);
      result.createdCategories++;
    }

    // Sort links by sortOrder
    const sortedLinks = [...c.links].sort((a, b) => a.sortOrder - b.sortOrder);

    for (const link of sortedLinks) {
      const u = normalizeUrl(link.url);
      if (!isValidUrl(link.url)) {
        result.errors.push(`Skipped link "${link.title}": invalid URL "${link.url}"`);
        result.skipped++;
        continue;
      }

      if (existingLinks.has(u)) {
        result.skipped++;
        continue;
      }

      try {
        await db.link.create({
          data: {
            category: { connect: { id: categoryId } },
            title: link.title,
            url: link.url,
            icon: link.icon ?? undefined,
            description: link.description ?? undefined,
            source: "BOOKMARK_IMPORT",
          },
        });
        existingLinks.set(u, "new");
        result.createdLinks++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        result.errors.push(`Failed to create link "${link.title}": ${msg}`);
      }
    }
  }

  return NextResponse.json({
    message: "import_complete",
    ...result,
  }, { status: 200 });
}

function normalizeUrl(u: string): string {
  try {
    return new URL(u).toString().replace(/\/$/, "");
  } catch {
    return u.replace(/\/$/, "");
  }
}
