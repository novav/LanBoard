// GET /api/search?q=<query>
// Search links by title, description, or URL.
// Returns matching links with their category information.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json([]);
  }

  try {
    const links = await db.link.findMany({
      where: {
        isPrivate: false,
        OR: [
          { title: { contains: query } },
          { description: { contains: query } },
          { url: { contains: query } },
        ],
      },
      include: {
        category: {
          select: { name: true },
        },
      },
      orderBy: [
        { clickCount: "desc" },
        { title: "asc" },
      ],
      take: 10,
    });

    return NextResponse.json(links);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json([]);
  }
}
