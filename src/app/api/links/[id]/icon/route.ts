// GET /api/links/[id]/icon — return the icon field for a single link.
// This endpoint exists so that LinkCard (client component) can fetch the
// icon on-demand instead of having the entire base64 data-URL serialized
// through RSC into the home page HTML (which was ballooning it to 3.6MB).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = params.id;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
    }

    const link = await db.link.findUnique({
      where: { id },
      select: { icon: true },
    });

    if (!link) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({ icon: link.icon });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}