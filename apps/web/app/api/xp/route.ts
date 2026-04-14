export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getLevelForXP, XP_REWARDS } from '@/lib/levels';

type XPEventType = keyof typeof XP_REWARDS;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { event } = (await req.json()) as { event: string };

  if (!event || !(event in XP_REWARDS)) {
    return NextResponse.json({ error: `Invalid XP event: ${event}` }, { status: 400 });
  }

  const xpEvent = event as XPEventType;
  const xpAmount = XP_REWARDS[xpEvent];

  const creator = await db.creator.findUnique({
    where: { email: session.user.email },
  });

  if (!creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  }

  // Check for duplicate "first_*" events
  if (event.startsWith('first_') || event === 'connect_game') {
    const existing = await db.xPEvent.findFirst({
      where: { creatorId: creator.id, event },
    });
    if (existing) {
      return NextResponse.json({
        message: 'Already awarded',
        xp: creator.xp,
        level: creator.level,
        levelTitle: creator.levelTitle,
        leveledUp: false,
      });
    }
  }

  // Log the XP event
  await db.xPEvent.create({
    data: {
      creatorId: creator.id,
      event,
      xpAwarded: xpAmount,
    },
  });

  // Increment XP
  const updated = await db.creator.update({
    where: { id: creator.id },
    data: { xp: { increment: xpAmount } },
  });

  // Recalculate level
  const { level: newLevel, title: newTitle } = getLevelForXP(updated.xp);
  const leveledUp = newLevel !== updated.level;

  if (leveledUp) {
    await db.creator.update({
      where: { id: creator.id },
      data: { level: newLevel, levelTitle: newTitle },
    });
  }

  return NextResponse.json({
    xp: updated.xp,
    level: leveledUp ? newLevel : updated.level,
    levelTitle: leveledUp ? newTitle : updated.levelTitle,
    leveledUp,
    xpAwarded: xpAmount,
  });
}
