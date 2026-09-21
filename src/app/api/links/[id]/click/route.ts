// POST /api/links/[id]/click — increment click count for a link.
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const id = params.id;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
    }

    const link = await db.link.findUnique({ where: { id } });
    if (!link) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // Don't count clicks on links hidden from the public.
    if (link.isPrivate) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    await db.link.update({
      where: { id },
      data: { clickCount: { increment: 1 } },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
