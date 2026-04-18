import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { AdminClient } from './admin-client';

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.email || session.user.email !== 'kevin@devmaxx.app') {
    redirect('/login');
  }

  // ─── Overview stats ──────────────────────────────────────
  const totalCreators = await db.creator.count();
  const creatorsByPlan = await db.creator.groupBy({
    by: ['plan'],
    _count: true,
  });

  const totalGames = await db.game.count();

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const agentRunsToday = await db.agentRun.count({
    where: { createdAt: { gte: todayStart } },
  });

  const totalAgentRuns = await db.agentRun.count();

  const robuxAgg = await db.agentRun.aggregate({
    _sum: { robuxImpact: true },
  });

  const failedRunsToday = await db.agentRun.count({
    where: { createdAt: { gte: todayStart }, status: 'failed' },
  });

  // ─── Users list ──────────────────────────────────────────
  const creators = await db.creator.findMany({
    include: {
      games: { select: { id: true, name: true } },
      _count: { select: { agentRuns: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // ─── Agent health ────────────────────────────────────────
  // Get last run for each agent name
  const allAgentNames = await db.agentRun.groupBy({
    by: ['agentName'],
  });

  const agentHealth: Array<{
    name: string;
    lastRun: string | null;
    totalRuns: number;
    successCount: number;
    failedCount: number;
    successRate: number;
  }> = [];

  for (const { agentName } of allAgentNames) {
    const lastRun = await db.agentRun.findFirst({
      where: { agentName },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const totalRuns = await db.agentRun.count({ where: { agentName } });
    const successCount = await db.agentRun.count({ where: { agentName, status: 'success' } });
    const failedCount = await db.agentRun.count({ where: { agentName, status: 'failed' } });

    agentHealth.push({
      name: agentName,
      lastRun: lastRun?.createdAt.toISOString() ?? null,
      totalRuns,
      successCount,
      failedCount,
      successRate: totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0,
    });
  }

  // Sort by last run (most recent first)
  agentHealth.sort((a, b) => {
    if (!a.lastRun) return 1;
    if (!b.lastRun) return -1;
    return new Date(b.lastRun).getTime() - new Date(a.lastRun).getTime();
  });

  // ─── Prospects ───────────────────────────────────────────
  const prospects = await db.prospectList.findMany({
    orderBy: [{ prospectScore: 'desc' }, { scannedAt: 'desc' }],
    take: 200,
  });

  // ─── Recent agent runs ──────────────────────────────────
  const recentRuns = await db.agentRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      agentName: true,
      action: true,
      robuxImpact: true,
      status: true,
      createdAt: true,
      creator: { select: { email: true } },
    },
  });

  // ─── Build data payload ─────────────────────────────────
  const data = {
    overview: {
      totalCreators,
      creatorsByPlan: creatorsByPlan.map((p) => ({ plan: p.plan, count: p._count })),
      totalGames,
      agentRunsToday,
      totalAgentRuns,
      totalRobuxImpact: robuxAgg._sum.robuxImpact ?? 0,
      failedRunsToday,
    },
    users: creators.map((c) => ({
      id: c.id,
      email: c.email,
      plan: c.plan,
      billingPeriod: c.billingPeriod,
      autopilot: c.autopilot,
      xp: c.xp,
      level: c.level,
      levelTitle: c.levelTitle,
      robloxUsername: c.robloxUsername,
      games: c.games.map((g) => ({ id: g.id, name: g.name })),
      agentRunCount: c._count.agentRuns,
      createdAt: c.createdAt.toISOString(),
    })),
    agentHealth,
    prospects: prospects.map((p) => ({
      id: p.id,
      robloxGameId: p.robloxGameId,
      gameName: p.gameName,
      creatorUsername: p.creatorUsername,
      concurrentPlayers: p.concurrentPlayers,
      visitCount: p.visitCount,
      prospectScore: p.prospectScore,
      outreachStatus: p.outreachStatus,
      outreachMessage: p.outreachMessage,
      signedUp: p.signedUp,
      twitterHandle: p.twitterHandle,
      socialScore: p.socialScore,
      enrichedAt: p.enrichedAt?.toISOString() ?? null,
      scannedAt: p.scannedAt.toISOString(),
    })),
    recentRuns: recentRuns.map((r) => ({
      id: r.id,
      agentName: r.agentName,
      action: r.action,
      robuxImpact: r.robuxImpact,
      status: r.status,
      creatorEmail: r.creator.email,
      createdAt: r.createdAt.toISOString(),
    })),
  };

  return <AdminClient data={data} />;
}
