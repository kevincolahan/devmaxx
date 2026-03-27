export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, status } = (await req.json()) as {
    id: string;
    status: 'approved' | 'rejected' | 'published';
  };

  if (!id || !['approved', 'rejected', 'published'].includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  await db.contentPiece.update({
    where: { id },
    data: {
      status,
      publishedAt: status === 'published' ? new Date() : undefined,
    },
  });

  return NextResponse.json({ success: true });
}
