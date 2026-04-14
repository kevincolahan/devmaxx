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
