import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { DashboardClient } from './dashboard-client';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/login');
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
          priceTests: {
            orderBy: { startedAt: 'desc' },
            take: 20,
          },
          tickets: {
            orderBy: { createdAt: 'desc' },
            take: 30,
          },
        },
      },
      agentRuns: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  const totalRuns = creator
    ? await db.agentRun.count({ where: { creatorId: creator.id } })
    : 0;

  const robuxAgg = creator
    ? await db.agentRun.aggregate({
        where: { creatorId: creator.id },
        _sum: { robuxImpact: true },
      })
    : { _sum: { robuxImpact: 0 } };

  const recommendations = creator
    ? await db.contentPiece.findMany({
        where: {
          creatorId: creator.id,
          type: { in: ['monetization', 'pricing_recommendation'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
    : [];

  const contentPieces = creator
    ? await db.contentPiece.findMany({
        where: {
          creatorId: creator.id,
          type: { in: ['social_post', 'event_idea', 'item_desc', 'game_pass', 'email', 'ad_creative'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    : [];

  const lastBriefRun = creator
    ? await db.agentRun.findFirst({
        where: { creatorId: creator.id, agentName: 'GrowthBriefAgent', status: 'success' },
        orderBy: { createdAt: 'desc' },
      })
    : null;

  const dashboardData = {
    creator: creator
      ? {
          id: creator.id,
          email: creator.email,
          plan: creator.plan,
          autopilot: creator.autopilot,
          robloxUserId: creator.robloxUserId,
          robloxUsername: creator.robloxUsername,
          robloxDisplayName: creator.robloxDisplayName,
          hasApiKey: !!creator.robloxApiKey,
        }
      : null,
    games: (creator?.games ?? []).map((game) => ({
      id: game.id,
      name: game.name,
      robloxGameId: game.robloxGameId,
      healthScore: game.healthScore,
      genre: game.genre,
      competitors: game.competitors,
      snapshots: game.snapshots.map((s) => ({
        date: s.date.toISOString(),
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
      priceTests: game.priceTests.map((t) => ({
        id: t.id,
        itemName: t.itemName,
        priceA: t.priceA,
        priceB: t.priceB,
        exposuresA: t.exposuresA,
        exposuresB: t.exposuresB,
        revenueA: t.revenueA,
        revenueB: t.revenueB,
        status: t.status,
        winner: t.winner,
        startedAt: t.startedAt.toISOString(),
        completedAt: t.completedAt?.toISOString() ?? null,
      })),
      tickets: game.tickets.map((t) => ({
        id: t.id,
        playerId: t.playerId,
        category: t.category,
        message: t.message,
        response: t.response,
        status: t.status,
        robuxValue: t.robuxValue,
        autoResolved: t.autoResolved,
        createdAt: t.createdAt.toISOString(),
      })),
    })),
    recentRuns: (creator?.agentRuns ?? []).map((run) => ({
      id: run.id,
      agentName: run.agentName,
      action: run.action,
      robuxImpact: run.robuxImpact,
      status: run.status,
      createdAt: run.createdAt.toISOString(),
    })),
    recommendations: recommendations.map((r) => ({
      id: r.id,
      content: r.content,
      qualityScore: r.qualityScore,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    contentPieces: contentPieces.map((c) => ({
      id: c.id,
      type: c.type,
      platform: c.platform,
      content: c.content,
      qualityScore: c.qualityScore,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
    lastBrief: lastBriefRun
      ? {
          data: lastBriefRun.output as Record<string, unknown>,
          sentAt: lastBriefRun.createdAt.toISOString(),
        }
      : null,
    stats: {
      totalGames: creator?.games.length ?? 0,
      totalRuns,
      totalRobuxImpact: robuxAgg._sum.robuxImpact ?? 0,
    },
  };

  return <DashboardClient data={dashboardData} userEmail={session.user.email} />;
}
