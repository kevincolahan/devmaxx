export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { creatorId, autopilot } = (await req.json()) as {
    creatorId: string;
    autopilot: boolean;
  };

  const creator = await db.creator.findUnique({
    where: { id: creatorId },
  });

  if (!creator || creator.email !== session.user.email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['pro', 'studio'].includes(creator.plan)) {
    return NextResponse.json(
      { error: 'Autopilot requires Pro or Studio plan' },
      { status: 403 }
    );
  }

  await db.creator.update({
    where: { id: creatorId },
    data: { autopilot },
  });

  return NextResponse.json({ success: true, autopilot });
}
