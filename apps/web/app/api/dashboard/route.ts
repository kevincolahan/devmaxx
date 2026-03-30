export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const creator = await db.creator.findUnique({
    where: { email: session.user.email },
    include: {
      games: {
        include: {
          snapshots: {
            orderBy: { date: 'desc' },
            take: 7,
          },
        },
      },
      agentRuns: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!creator) {
    return NextResponse.json({
      creator: null,
      games: [],
      recentRuns: [],
      stats: { totalGames: 0, totalRuns: 0, totalRobuxImpact: 0 },
    });
  }

  const totalRuns = await db.agentRun.count({
    where: { creatorId: creator.id },
  });

  const robuxAgg = await db.agentRun.aggregate({
    where: { creatorId: creator.id },
    _sum: { robuxImpact: true },
  });

  return NextResponse.json({
    creator: {
      id: creator.id,
      email: creator.email,
      plan: creator.plan,
      autopilot: creator.autopilot,
      robloxUserId: creator.robloxUserId,
    },
    games: creator.games.map((game: any) => ({
      id: game.id,
      name: game.name,
      robloxGameId: game.robloxGameId,
      healthScore: game.healthScore,
      genre: game.genre,
      competitors: game.competitors,
      snapshots: game.snapshots.map((s: any) => ({
        date: s.date,
        dau: s.dau,
        mau: s.mau,
        concurrentPeak: s.concurrentPeak,
        avgSessionSec: s.avgSessionSec,
        retentionD1: s.retentionD1,
        retentionD7: s.retentionD7,
        retentionD30: s.retentionD30,
        robuxEarned: s.robuxEarned,
        newPlayers: s.newPlayers,
        returningPlayers: s.returningPlayers,
      })),
    })),
    recentRuns: creator.agentRuns.map((run: any) => ({
      id: run.id,
      agentName: run.agentName,
      action: run.action,
      robuxImpact: run.robuxImpact,
      status: run.status,
      createdAt: run.createdAt,
    })),
    stats: {
      totalGames: creator.games.length,
      totalRuns,
      totalRobuxImpact: robuxAgg._sum.robuxImpact ?? 0,
    },
  });
}
