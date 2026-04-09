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
          type: { in: ['social_post', 'event_idea', 'item_desc', 'game_pass', 'email', 'ad_creative', 'news_response'] },
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

  const latestSentiment = creator?.games[0]
    ? await db.playerSentiment.findFirst({
        where: { gameId: creator.games[0].id },
        orderBy: { analyzedAt: 'desc' },
      })
    : null;

  const recentEvents = creator?.games[0]
    ? await db.eventImpact.findMany({
        where: { gameId: creator.games[0].id },
        orderBy: { startedAt: 'desc' },
        take: 10,
      })
    : [];

  const latestForecast = creator?.games[0]
    ? await db.revenueForecast.findFirst({
        where: { gameId: creator.games[0].id },
        orderBy: { forecastDate: 'desc' },
      })
    : null;

  const communityLastPostRow = await db.keyValue.findUnique({ where: { key: 'community_last_post' } });
  const communityHistoryRow = await db.keyValue.findUnique({ where: { key: 'community_post_history' } });

  const mentionLogs = await db.mentionLog.findMany({
    orderBy: { processedAt: 'desc' },
    take: 50,
  });

  const referrals = creator
    ? await db.referral.findMany({
        where: { referrerId: creator.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    : [];

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
      actualRobuxImpact: run.actualRobuxImpact,
      followUpCompleted: run.followUpCompleted,
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
      sourceData: c.sourceData as Record<string, unknown> | null,
      createdAt: c.createdAt.toISOString(),
    })),
    lastBrief: lastBriefRun
      ? {
          data: lastBriefRun.output as Record<string, unknown>,
          sentAt: lastBriefRun.createdAt.toISOString(),
        }
      : null,
    sentiment: latestSentiment ? {
      overallScore: latestSentiment.overallScore,
      weekOverWeekChange: latestSentiment.weekOverWeekChange,
      claudeSummary: latestSentiment.claudeSummary,
      topBugs: latestSentiment.topBugs as unknown[],
      topRequests: latestSentiment.topRequests as unknown[],
      topPraise: latestSentiment.topPraise as unknown[],
      topFrustrations: latestSentiment.topFrustrations as unknown[],
      ticketsAnalyzed: latestSentiment.ticketsAnalyzed,
      analyzedAt: latestSentiment.analyzedAt.toISOString(),
    } : null,
    events: recentEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      eventName: e.eventName,
      startedAt: e.startedAt.toISOString(),
      measuredAt: e.measuredAt?.toISOString() ?? null,
      dauBefore: e.dauBefore,
      dauAfter: e.dauAfter,
      dauChangePercent: e.dauChangePercent,
      revenueBefore: e.revenueBefore,
      revenueAfter: e.revenueAfter,
      verdict: e.verdict,
      claudeSummary: e.claudeSummary,
      measured: e.measured,
    })),
    forecast: latestForecast ? {
      next30DaysRobux: latestForecast.next30DaysRobux,
      next90DaysRobux: latestForecast.next90DaysRobux,
      projectedDevExUSD: latestForecast.projectedDevExUSD,
      upsideRobux: latestForecast.upsideRobux,
      downsideRobux: latestForecast.downsideRobux,
      assumptions: latestForecast.assumptions as Record<string, unknown>,
      seasonalFactors: latestForecast.seasonalFactors as Record<string, unknown>,
      forecastDate: latestForecast.forecastDate.toISOString(),
    } : null,
    communityLastPost: communityLastPostRow ? JSON.parse(communityLastPostRow.value) : null,
    communityPostHistory: communityHistoryRow ? JSON.parse(communityHistoryRow.value) : [],
    mentions: mentionLogs.map((m) => ({
      id: m.id,
      mentionId: m.mentionId,
      authorUsername: m.authorUsername,
      authorFollowers: m.authorFollowers,
      content: m.content,
      category: m.category,
      replyDrafted: m.replyDrafted,
      replyPosted: m.replyPosted,
      replyTweetId: m.replyTweetId,
      processedAt: m.processedAt.toISOString(),
    })),
    referral: {
      referralCode: creator?.referralCode ?? '',
      referralCredits: creator?.referralCredits ?? 0,
      referrals: referrals.map((r) => ({
        id: r.id,
        referredEmail: r.referredEmail,
        status: r.status,
        convertedAt: r.convertedAt?.toISOString() ?? null,
        creditedAt: r.creditedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    stats: {
      totalGames: creator?.games.length ?? 0,
      totalRuns,
      totalRobuxImpact: robuxAgg._sum.robuxImpact ?? 0,
    },
  };

  return <DashboardClient data={dashboardData} userEmail={session.user.email} />;
}
