export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only kevin@devmaxx.app can see prospects (founder-only feature)
  if (session.user.email !== 'kevin@devmaxx.app') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const prospects = await db.prospectList.findMany({
    orderBy: [{ prospectScore: 'desc' }, { scannedAt: 'desc' }],
    take: 100,
  });

  return NextResponse.json({ prospects });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.email !== 'kevin@devmaxx.app') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { id, outreachStatus } = body;

  if (!id || !outreachStatus) {
    return NextResponse.json({ error: 'Missing id or outreachStatus' }, { status: 400 });
  }

  const allowed = ['pending', 'queued', 'contacted', 'replied'];
  if (!allowed.includes(outreachStatus)) {
    return NextResponse.json({ error: 'Invalid outreachStatus' }, { status: 400 });
  }

  const updated = await db.prospectList.update({
    where: { id },
    data: { outreachStatus },
  });

  return NextResponse.json({ prospect: updated });
}
