// T9 - GET /api/data/export — Export all categories + links as JSON (admin only).
// Format:
//   { version, source: "lanboard", exportedAt, categories: [{ name, icon, sortOrder, links }] }
// Returned as downloadable attachment: Content-Disposition attachment.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";

export async function GET() {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  // Query all categories (including private — this is a full backup).
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      links: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const payload = {
    version: "1.0",
    source: "lanboard",
    exportedAt: new Date().toISOString(),
    categories: categories.map((c) => ({
      name: c.name,
      icon: c.icon ?? undefined,
      sortOrder: c.sortOrder,
      links: c.links.map((l) => ({
        title: l.title,
        url: l.url,
        icon: l.icon ?? undefined,
        description: l.description ?? undefined,
        sortOrder: l.sortOrder,
      })),
    })),
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `lanboard-export-${dateStr}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
