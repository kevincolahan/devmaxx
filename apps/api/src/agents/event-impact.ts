import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

// ─── Event Impact Analyzer ──────────────────────────────────
// Detects game updates and measures their impact after 7 days.

interface EventImpactResult {
  eventsDetected: number;
  eventsMeasured: number;
  contentGenerated: number;
}

// ─── Register a new event to track ──────────────────────────

export async function registerEvent(
  db: PrismaClient,
  gameId: string,
  eventType: string,
  eventName: string
): Promise<string> {
  // Capture baseline metrics (7 days before)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const baselineSnapshots = await db.metricSnapshot.findMany({
    where: { gameId, date: { gte: sevenDaysAgo } },
  });

  const len = baselineSnapshots.length || 1;
  const dauBefore = Math.round(baselineSnapshots.reduce((s, m) => s + m.dau, 0) / len);
  const retentionBefore = baselineSnapshots.reduce((s, m) => s + m.retentionD7, 0) / len;
  const revenueBefore = baselineSnapshots.reduce((s, m) => s + m.robuxEarned, 0);
  const sessionBefore = Math.round(baselineSnapshots.reduce((s, m) => s + m.avgSessionSec, 0) / len);

  const event = await db.eventImpact.create({
    data: {
      gameId,
      eventType,
      eventName,
      startedAt: new Date(),
      dauBefore,
      retentionBefore: Math.round(retentionBefore * 10000) / 10000,
      revenueBefore,
      sessionBefore,
    },
  });

  console.log(`[EventImpact] Registered event: "${eventName}" (${eventType}) for game ${gameId}`);
  return event.id;
}

// ─── Measure pending events that are 7+ days old ────────────

async function measurePendingEvents(db: PrismaClient): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const pendingEvents = await db.eventImpact.findMany({
    where: {
      measured: false,
      startedAt: { lte: sevenDaysAgo },
    },
  });

  if (pendingEvents.length === 0) return 0;

  const client = new Anthropic();
  let measured = 0;

  for (const event of pendingEvents) {
    try {
      // Get 7 days of snapshots after the event
      const afterStart = event.startedAt;
      const afterEnd = new Date(afterStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      const afterSnapshots = await db.metricSnapshot.findMany({
        where: { gameId: event.gameId, date: { gte: afterStart, lte: afterEnd } },
      });

      if (afterSnapshots.length === 0) continue;

      const len = afterSnapshots.length;
      const dauAfter = Math.round(afterSnapshots.reduce((s, m) => s + m.dau, 0) / len);
      const retentionAfter = afterSnapshots.reduce((s, m) => s + m.retentionD7, 0) / len;
      const revenueAfter = afterSnapshots.reduce((s, m) => s + m.robuxEarned, 0);
      const sessionAfter = Math.round(afterSnapshots.reduce((s, m) => s + m.avgSessionSec, 0) / len);

      const dauChange = event.dauBefore > 0
        ? ((dauAfter - event.dauBefore) / event.dauBefore) * 100
        : 0;

      // Determine verdict
      let verdict: 'positive' | 'negative' | 'neutral';
      if (dauChange > 5 || revenueAfter > event.revenueBefore * 1.1) {
        verdict = 'positive';
      } else if (dauChange < -5 || revenueAfter < event.revenueBefore * 0.9) {
        verdict = 'negative';
      } else {
        verdict = 'neutral';
      }

      // Get Claude's summary
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 2048,
        system: 'You are a Roblox game analyst. Write a 2-3 sentence summary of the impact of a game event. Be specific with numbers. Be direct.',
        messages: [{
          role: 'user',
          content: `Event: "${event.eventName}" (${event.eventType})
Before (7-day avg): DAU=${event.dauBefore}, D7 Retention=${(event.retentionBefore * 100).toFixed(1)}%, Revenue=${event.revenueBefore} R$, Session=${event.sessionBefore}s
After (7-day avg): DAU=${dauAfter}, D7 Retention=${(retentionAfter * 100).toFixed(1)}%, Revenue=${revenueAfter} R$, Session=${sessionAfter}s
DAU change: ${dauChange.toFixed(1)}%
Verdict: ${verdict}

Write a brief, data-driven summary of this event's impact.`,
        }],
      });

      const summary = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');

      // Update the event
      await db.eventImpact.update({
        where: { id: event.id },
        data: {
          dauAfter,
          dauChangePercent: Math.round(dauChange * 100) / 100,
          retentionAfter: Math.round(retentionAfter * 10000) / 10000,
          revenueAfter,
          sessionAfter,
          verdict,
          claudeSummary: summary,
          measured: true,
          measuredAt: new Date(),
        },
      });

      measured++;
      console.log(`[EventImpact] Measured "${event.eventName}": ${verdict} (DAU ${dauChange.toFixed(1)}%)`);

      // Auto-generate social content for positive events
      if (verdict === 'positive' && dauChange > 10) {
        const game = await db.game.findUnique({ where: { id: event.gameId } });
        const gameCreator = game
          ? await db.creator.findFirst({ where: { games: { some: { id: game.id } } } })
          : null;

        if (gameCreator) {
          const dauPct = Math.round(dauChange);
          const revPct = event.revenueBefore > 0
            ? Math.round(((revenueAfter - event.revenueBefore) / event.revenueBefore) * 100)
            : 0;

          const tweetContent = `Our latest ${event.eventType} "${event.eventName}" just delivered:\n\n+${dauPct}% DAU${revPct > 0 ? `\n+${revPct}% revenue` : ''}\n\nData-driven game development works. Devmaxx tracks every update's impact automatically.\n\ndevmaxx.app`;

          if (tweetContent.length <= 280) {
            await db.contentPiece.create({
              data: {
                creatorId: gameCreator.id,
                gameId: event.gameId,
                type: 'social_post',
                platform: 'x',
                content: tweetContent,
                qualityScore: 8,
                status: 'approved',
                sourceData: {
                  agentName: 'EventImpactAnalyzer',
                  eventId: event.id,
                  eventName: event.eventName,
                  generatedAt: new Date().toISOString(),
                },
              },
            });
            console.log(`[EventImpact] Auto-generated social post for positive event "${event.eventName}"`);
          }
        }
      }
    } catch (err) {
      console.error(`[EventImpact] Failed to measure event ${event.id}:`, err);
    }
  }

  return measured;
}

// ─── Detect new game versions ───────────────────────────────

async function detectNewVersions(db: PrismaClient): Promise<number> {
  const games = await db.game.findMany();
  let detected = 0;

  for (const game of games) {
    const lastVersionKey = `game_version_${game.id}`;
    const lastVersionRow = await db.keyValue.findUnique({ where: { key: lastVersionKey } });

    // Check if there's a recent significant metric change that suggests an update
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

    const recentSnapshots = await db.metricSnapshot.findMany({
      where: { gameId: game.id, date: { gte: twoDaysAgo } },
    });
    const priorSnapshots = await db.metricSnapshot.findMany({
      where: { gameId: game.id, date: { gte: fourDaysAgo, lt: twoDaysAgo } },
    });

    if (recentSnapshots.length === 0 || priorSnapshots.length === 0) continue;

    const recentDau = recentSnapshots.reduce((s, m) => s + m.dau, 0) / recentSnapshots.length;
    const priorDau = priorSnapshots.reduce((s, m) => s + m.dau, 0) / priorSnapshots.length;
    const dauChange = priorDau > 0 ? ((recentDau - priorDau) / priorDau) * 100 : 0;

    // If DAU changed by >20%, likely a game update
    if (Math.abs(dauChange) > 20) {
      // Check if we already registered an event in the last 3 days
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const recentEvent = await db.eventImpact.findFirst({
        where: { gameId: game.id, startedAt: { gte: threeDaysAgo } },
      });

      if (!recentEvent) {
        const direction = dauChange > 0 ? 'spike' : 'drop';
        await registerEvent(db, game.id, 'update', `Detected DAU ${direction} (${Math.round(dauChange)}%)`);
        detected++;

        await db.keyValue.upsert({
          where: { key: lastVersionKey },
          update: { value: new Date().toISOString() },
          create: { key: lastVersionKey, value: new Date().toISOString() },
        });
      }
    }
  }

  return detected;
}

// ─── Main pipeline ──────────────────────────────────────────

export async function runEventImpactPipeline(db: PrismaClient): Promise<EventImpactResult> {
  console.log('[EventImpact] Starting daily event impact analysis');

  const eventsDetected = await detectNewVersions(db);
  const eventsMeasured = await measurePendingEvents(db);

  console.log(`[EventImpact] Done — detected: ${eventsDetected}, measured: ${eventsMeasured}`);

  return { eventsDetected, eventsMeasured, contentGenerated: 0 };
}
