import { PrismaClient } from '@prisma/client';

// ─── Outcome Tracking Agent ─────────────────────────────────
// Closes the feedback loop on agent recommendations by
// comparing predicted vs actual impact after 7 days.

interface OutcomeResult {
  runsChecked: number;
  runsUpdated: number;
  totalMeasuredImpact: number;
}

export async function runOutcomeTrackingPipeline(
  db: PrismaClient
): Promise<OutcomeResult> {
  console.log('[OutcomeTracking] Starting follow-up checks');

  // Find all runs that have a followUpAt in the past and haven't been completed
  const pendingFollowUps = await db.agentRun.findMany({
    where: {
      followUpAt: { lte: new Date() },
      followUpCompleted: false,
      gameId: { not: null },
      robuxImpact: { not: null },
    },
    include: { creator: true },
  });

  if (pendingFollowUps.length === 0) {
    console.log('[OutcomeTracking] No pending follow-ups');
    return { runsChecked: 0, runsUpdated: 0, totalMeasuredImpact: 0 };
  }

  console.log(`[OutcomeTracking] Found ${pendingFollowUps.length} pending follow-ups`);

  let runsUpdated = 0;
  let totalMeasuredImpact = 0;

  for (const run of pendingFollowUps) {
    if (!run.gameId) continue;

    try {
      const baseline = run.baselineMetrics as {
        robuxEarned7d?: number;
        dau?: number;
        retentionD7?: number;
      } | null;

      if (!baseline) {
        // No baseline stored — mark as completed with no measurement
        await db.agentRun.update({
          where: { id: run.id },
          data: { followUpCompleted: true },
        });
        continue;
      }

      // Get the last 7 days of snapshots for this game
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentSnapshots = await db.metricSnapshot.findMany({
        where: {
          gameId: run.gameId,
          date: { gte: sevenDaysAgo },
        },
        orderBy: { date: 'desc' },
      });

      if (recentSnapshots.length === 0) {
        // No recent data — skip but don't mark complete (might get data later)
        console.log(`[OutcomeTracking] No recent snapshots for game ${run.gameId}, skipping`);
        continue;
      }

      // Calculate actual metrics
      const totalRobux = recentSnapshots.reduce((sum, s) => sum + s.robuxEarned, 0);
      const avgDau = Math.round(recentSnapshots.reduce((sum, s) => sum + s.dau, 0) / recentSnapshots.length);
      const avgRetention = recentSnapshots.reduce((sum, s) => sum + s.retentionD7, 0) / recentSnapshots.length;

      // Calculate actual impact
      let actualImpact = 0;

      if (baseline.robuxEarned7d && baseline.robuxEarned7d > 0) {
        actualImpact = totalRobux - baseline.robuxEarned7d;
      }

      // Build outcome details
      const outcomeDetails = {
        baseline: {
          robuxEarned7d: baseline.robuxEarned7d ?? 0,
          dau: baseline.dau ?? 0,
          retentionD7: baseline.retentionD7 ?? 0,
        },
        measured: {
          robuxEarned7d: totalRobux,
          dau: avgDau,
          retentionD7: Math.round(avgRetention * 100) / 100,
        },
        changes: {
          robuxDelta: actualImpact,
          dauDelta: avgDau - (baseline.dau ?? 0),
          retentionDelta: Math.round((avgRetention - (baseline.retentionD7 ?? 0)) * 100) / 100,
        },
        measuredAt: new Date().toISOString(),
        snapshotCount: recentSnapshots.length,
      };

      // Update the AgentRun with actual results
      const existingOutput = run.output as Record<string, unknown>;
      await db.agentRun.update({
        where: { id: run.id },
        data: {
          actualRobuxImpact: actualImpact,
          followUpCompleted: true,
          output: {
            ...existingOutput,
            outcomeTracking: outcomeDetails,
          },
        },
      });

      runsUpdated++;
      totalMeasuredImpact += actualImpact;

      const estimated = run.robuxImpact ?? 0;
      const accuracy = estimated !== 0 ? Math.round((actualImpact / estimated) * 100) : 0;
      console.log(
        `[OutcomeTracking] ${run.agentName} — estimated: ${estimated} R$, actual: ${actualImpact} R$, accuracy: ${accuracy}%`
      );
    } catch (err) {
      console.error(`[OutcomeTracking] Error processing run ${run.id}:`, err);
    }
  }

  console.log(`[OutcomeTracking] Done — checked: ${pendingFollowUps.length}, updated: ${runsUpdated}, measured impact: ${totalMeasuredImpact} R$`);

  return {
    runsChecked: pendingFollowUps.length,
    runsUpdated,
    totalMeasuredImpact,
  };
}

// ─── Baseline capture helper ────────────────────────────────
// Call this when an agent makes a recommendation with robuxImpact > 0

export async function scheduleOutcomeFollowUp(
  db: PrismaClient,
  agentRunId: string,
  gameId: string
): Promise<void> {
  // Get current metrics as baseline
  const latestSnapshot = await db.metricSnapshot.findFirst({
    where: { gameId },
    orderBy: { date: 'desc' },
  });

  // Get last 7 days of revenue
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentSnapshots = await db.metricSnapshot.findMany({
    where: { gameId, date: { gte: sevenDaysAgo } },
  });

  const robuxEarned7d = recentSnapshots.reduce((sum, s) => sum + s.robuxEarned, 0);

  const baseline = {
    robuxEarned7d,
    dau: latestSnapshot?.dau ?? 0,
    retentionD7: latestSnapshot?.retentionD7 ?? 0,
    retentionD1: latestSnapshot?.retentionD1 ?? 0,
    concurrentPeak: latestSnapshot?.concurrentPeak ?? 0,
    capturedAt: new Date().toISOString(),
  };

  // Schedule follow-up in 7 days
  const followUpAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.agentRun.update({
    where: { id: agentRunId },
    data: {
      baselineMetrics: baseline,
      followUpAt,
    },
  });

  console.log(`[OutcomeTracking] Scheduled follow-up for run ${agentRunId} at ${followUpAt.toISOString()}`);
}
