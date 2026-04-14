import { PrismaClient } from '@prisma/client';

const LEVEL_THRESHOLDS = [
  { level: 1, title: 'Rookie Creator', xp: 0 },
  { level: 2, title: 'Rising Dev', xp: 500 },
  { level: 3, title: 'Game Builder', xp: 1_500 },
  { level: 4, title: 'Studio Founder', xp: 3_000 },
  { level: 5, title: 'DevEx Earner', xp: 5_000 },
  { level: 6, title: 'Top Creator', xp: 10_000 },
  { level: 7, title: 'Elite Developer', xp: 20_000 },
  { level: 8, title: 'Legendary Studio', xp: 50_000 },
];

function getLevelForXP(xp: number): { level: number; title: string } {
  let current = LEVEL_THRESHOLDS[0];
  for (const threshold of LEVEL_THRESHOLDS) {
    if (xp >= threshold.xp) current = threshold;
    else break;
  }
  return { level: current.level, title: current.title };
}

export const XP_REWARDS = {
  connect_game: 500,
  first_agent_run: 200,
  agent_run: 50,
  first_pricing_test: 300,
  first_devex: 500,
  upgrade_creator: 1000,
  upgrade_pro: 2000,
  refer_creator: 500,
  seven_day_streak: 250,
  first_tweet: 150,
} as const;

export type XPEventType = keyof typeof XP_REWARDS;

export async function awardXP(
  db: PrismaClient,
  creatorId: string,
  event: XPEventType,
  amount?: number
): Promise<{ newXP: number; newLevel: number; newTitle: string; leveledUp: boolean }> {
  const xpAmount = amount ?? XP_REWARDS[event];

  // Log the XP event
  await db.xPEvent.create({
    data: {
      creatorId,
      event,
      xpAwarded: xpAmount,
    },
  });

  // Increment XP
  const creator = await db.creator.update({
    where: { id: creatorId },
    data: { xp: { increment: xpAmount } },
  });

  // Recalculate level
  const { level: newLevel, title: newTitle } = getLevelForXP(creator.xp);
  const leveledUp = newLevel !== creator.level;

  // Update level if changed
  if (leveledUp) {
    await db.creator.update({
      where: { id: creatorId },
      data: { level: newLevel, levelTitle: newTitle },
    });
  }

  return { newXP: creator.xp, newLevel, newTitle, leveledUp };
}
