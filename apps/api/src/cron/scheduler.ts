import cron from 'node-cron';
import { db } from '../lib/db';
import { MetricsMonitorAgent } from '../agents/metrics-monitor';
import { CompetitorIntelligenceAgent } from '../agents/competitor-intel';
import { PricingTestCreatorAgent, PricingTestEvaluatorAgent } from '../agents/pricing-opt';
import { ContentGenerationAgent } from '../agents/content-gen';
import { GrowthBriefAgent } from '../agents/growth-brief';
import { MonetizationAdvisorAgent } from '../agents/monetization';
import { postTweet } from '../lib/twitter';

// ─── Plan-based eligibility ──────────────────────────────────
// free    → GrowthBrief only
// creator → all agents (manual approval)
// pro     → all agents + competitor tracking + autopilot
// studio  → all agents + competitor tracking + autopilot

const PAID_PLANS = ['creator', 'pro', 'studio'];
const COMPETITOR_PLANS = ['pro', 'studio'];

// ─── Timeouts ────────────────────────────────────────────────

const PER_GAME_TIMEOUT_MS = 30_000;   // 30 seconds per agent run
const MAX_JOB_RUNTIME_MS = 300_000;   // 5 minutes per entire job

// ─── Job Lock Guard ──────────────────────────────────────────

const runningJobs = new Set<string>();

// ─── Helpers ─────────────────────────────────────────────────

function log(job: string, message: string) {
  console.log(`[CRON][${job}] ${new Date().toISOString()} — ${message}`);
}

async function getCreatorsWithGames(plans: string[]) {
  return db.creator.findMany({
    where: { plan: { in: plans } },
    include: { games: true },
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms: ${label}`));
    }, ms);

    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

async function logFailedAgentRun(
  agentName: string,
  creatorId: string,
  gameId: string,
  error: string
) {
  try {
    await db.agentRun.create({
      data: {
        creatorId,
        agentName,
        gameId,
        input: {},
        output: { error },
        action: 'timeout',
        robuxImpact: 0,
        status: 'failed',
      },
    });
  } catch (dbErr) {
    console.error(`[CRON] Failed to log timeout AgentRun:`, dbErr);
  }
}

/**
 * Wraps a job runner with:
 * 1. Lock guard — skip if already running
 * 2. Max runtime — kill after 5 minutes
 */
function guardedJob(jobName: string, runner: () => Promise<void>): () => void {
  return () => {
    if (runningJobs.has(jobName)) {
      log(jobName, 'SKIPPED — previous run still in progress');
      return;
    }

    runningJobs.add(jobName);

    withTimeout(runner(), MAX_JOB_RUNTIME_MS, `${jobName} max runtime`)
      .catch((err) => log(jobName, `Unhandled error: ${err}`))
      .finally(() => runningJobs.delete(jobName));
  };
}

// ─── Job Runners ─────────────────────────────────────────────

async function runMetricsMonitor() {
  log('MetricsMonitor', 'Starting daily metrics scan');
  const creators = await getCreatorsWithGames(PAID_PLANS);

  for (const creator of creators) {
    for (const game of creator.games) {
      try {
        const agent = new MetricsMonitorAgent();
        const result = await withTimeout(
          agent.runFullPipeline(
            creator.id,
            game.id,
            {
              robloxGameId: game.robloxGameId,
              universeId: game.robloxGameId,
              gameName: game.name,
            },
            db
          ),
          PER_GAME_TIMEOUT_MS,
          `MetricsMonitor:${game.name}`
        );
        log('MetricsMonitor', `${game.name}: ${result.action} (healthScore: ${(result.output as Record<string, unknown>).healthScore ?? 'N/A'})`);
      } catch (err) {
        log('MetricsMonitor', `FAILED ${game.name}: ${err}`);
        await logFailedAgentRun('MetricsMonitorAgent', creator.id, game.id, String(err));
      }
    }
  }

  log('MetricsMonitor', 'Complete');
}

async function runCompetitorIntelligence() {
  log('CompetitorIntel', 'Starting daily competitor scan');
  const creators = await getCreatorsWithGames(COMPETITOR_PLANS);

  for (const creator of creators) {
    for (const game of creator.games) {
      if (game.competitors.length === 0) continue;

      try {
        const agent = new CompetitorIntelligenceAgent();
        const result = await withTimeout(
          agent.runFullPipeline(
            creator.id,
            game.id,
            {
              watchingGameId: game.id,
              watchingGameName: game.name,
              competitorUniverseIds: game.competitors,
            },
            db
          ),
          PER_GAME_TIMEOUT_MS,
          `CompetitorIntel:${game.name}`
        );
        log('CompetitorIntel', `${game.name}: ${result.action} (${(result.output as Record<string, unknown>).materialChanges ? ((result.output as Record<string, unknown>).materialChanges as unknown[]).length : 0} changes)`);
      } catch (err) {
        log('CompetitorIntel', `FAILED ${game.name}: ${err}`);
        await logFailedAgentRun('CompetitorIntelligenceAgent', creator.id, game.id, String(err));
      }
    }
  }

  log('CompetitorIntel', 'Complete');
}

async function runPricingTestCreator() {
  log('PricingTestCreator', 'Starting weekly test creation');
  const creators = await getCreatorsWithGames(PAID_PLANS);

  for (const creator of creators) {
    for (const game of creator.games) {
      try {
        const agent = new PricingTestCreatorAgent();
        const result = await withTimeout(
          agent.runFullPipeline(creator.id, game.id, db),
          PER_GAME_TIMEOUT_MS,
          `PricingTestCreator:${game.name}`
        );
        log('PricingTestCreator', `${game.name}: ${result.action}`);
      } catch (err) {
        log('PricingTestCreator', `FAILED ${game.name}: ${err}`);
        await logFailedAgentRun('PricingOptimizationAgent', creator.id, game.id, String(err));
      }
    }
  }

  log('PricingTestCreator', 'Complete');
}

async function runPricingTestEvaluator() {
  log('PricingEvaluator', 'Starting test evaluation');

  try {
    const agent = new PricingTestEvaluatorAgent();
    const result = await withTimeout(
      agent.runFullPipeline(db),
      MAX_JOB_RUNTIME_MS,
      'PricingEvaluator'
    );
    const output = result.output as Record<string, unknown>;
    log('PricingEvaluator', `${result.action} (${output.testsEvaluated ?? 0} tests evaluated)`);
  } catch (err) {
    log('PricingEvaluator', `FAILED: ${err}`);
  }

  log('PricingEvaluator', 'Complete');
}

async function runContentGeneration() {
  log('ContentGeneration', 'Starting weekly content generation');
  const creators = await getCreatorsWithGames(PAID_PLANS);

  for (const creator of creators) {
    for (const game of creator.games) {
      try {
        const agent = new ContentGenerationAgent();
        const result = await withTimeout(
          agent.runFullPipeline(creator.id, game.id, db),
          PER_GAME_TIMEOUT_MS,
          `ContentGeneration:${game.name}`
        );
        const output = result.output as Record<string, unknown>;
        log('ContentGeneration', `${game.name}: ${result.action} (${output.qualityFiltered ?? 0} pieces)`);
      } catch (err) {
        log('ContentGeneration', `FAILED ${game.name}: ${err}`);
        await logFailedAgentRun('ContentGenerationAgent', creator.id, game.id, String(err));
      }
    }
  }

  log('ContentGeneration', 'Complete');
}

async function runGrowthBrief() {
  log('GrowthBrief', 'Starting weekly growth briefs');
  // All plans get GrowthBrief (including free)
  const creators = await getCreatorsWithGames(['free', ...PAID_PLANS]);

  for (const creator of creators) {
    for (const game of creator.games) {
      try {
        const agent = new GrowthBriefAgent();
        const result = await withTimeout(
          agent.runFullPipeline(creator.id, game.id, db),
          PER_GAME_TIMEOUT_MS,
          `GrowthBrief:${game.name}`
        );
        log('GrowthBrief', `${game.name}: ${result.action}`);
      } catch (err) {
        log('GrowthBrief', `FAILED ${game.name}: ${err}`);
        await logFailedAgentRun('GrowthBriefAgent', creator.id, game.id, String(err));
      }
    }
  }

  log('GrowthBrief', 'Complete');
}

async function runMonetizationAdvisor() {
  log('MonetizationAdvisor', 'Starting monthly catalog audit');
  const creators = await getCreatorsWithGames(PAID_PLANS);

  for (const creator of creators) {
    for (const game of creator.games) {
      try {
        const agent = new MonetizationAdvisorAgent();
        const result = await withTimeout(
          agent.runFullPipeline(creator.id, game.id, db),
          PER_GAME_TIMEOUT_MS,
          `MonetizationAdvisor:${game.name}`
        );
        log('MonetizationAdvisor', `${game.name}: ${result.action}`);
      } catch (err) {
        log('MonetizationAdvisor', `FAILED ${game.name}: ${err}`);
        await logFailedAgentRun('MonetizationAdvisorAgent', creator.id, game.id, String(err));
      }
    }
  }

  log('MonetizationAdvisor', 'Complete');
}

// ─── Social Poster (auto-post approved X content) ────────────

async function runSocialPoster() {
  log('SocialPoster', 'Starting auto-post for approved X content');

  const approvedXPosts = await db.contentPiece.findMany({
    where: {
      platform: 'x',
      status: 'approved',
    },
    orderBy: { createdAt: 'asc' },
  });

  if (approvedXPosts.length === 0) {
    log('SocialPoster', 'No approved X posts to publish');
    return;
  }

  let posted = 0;
  let failed = 0;

  for (const piece of approvedXPosts) {
    if (piece.content.length > 280) {
      log('SocialPoster', `Skipping ${piece.id} — exceeds 280 chars (${piece.content.length})`);
      continue;
    }

    try {
      const result = await withTimeout(
        postTweet(piece.content),
        PER_GAME_TIMEOUT_MS,
        `SocialPoster:${piece.id}`
      );

      if (result.success) {
        await db.contentPiece.update({
          where: { id: piece.id },
          data: {
            status: 'published',
            publishedAt: new Date(),
            performance: {
              tweetId: result.tweetId,
              tweetUrl: result.tweetUrl,
              postedAt: new Date().toISOString(),
              autoPosted: true,
            },
          },
        });
        posted++;
        log('SocialPoster', `Posted ${piece.id}: ${result.tweetUrl}`);
      } else {
        failed++;
        log('SocialPoster', `Failed ${piece.id}: ${result.error}`);
      }
    } catch (err) {
      failed++;
      log('SocialPoster', `Error posting ${piece.id}: ${err}`);
    }
  }

  log('SocialPoster', `Complete — posted: ${posted}, failed: ${failed}, skipped: ${approvedXPosts.length - posted - failed}`);
}

// ─── Schedule Registration ───────────────────────────────────

export function startScheduler() {
  console.log('[CRON] Registering cron jobs...');

  // MetricsMonitorAgent — 6am UTC daily
  cron.schedule('0 6 * * *', guardedJob('MetricsMonitor', runMetricsMonitor), { timezone: 'UTC' });

  // CompetitorIntelligenceAgent — 8am UTC daily
  cron.schedule('0 8 * * *', guardedJob('CompetitorIntel', runCompetitorIntelligence), { timezone: 'UTC' });

  // PricingTestCreator — 9am UTC Monday
  cron.schedule('0 9 * * 1', guardedJob('PricingTestCreator', runPricingTestCreator), { timezone: 'UTC' });

  // PricingTestEvaluator — every 6 hours
  cron.schedule('0 */6 * * *', guardedJob('PricingEvaluator', runPricingTestEvaluator), { timezone: 'UTC' });

  // ContentGeneration — 7am UTC Monday
  cron.schedule('0 7 * * 1', guardedJob('ContentGeneration', runContentGeneration), { timezone: 'UTC' });

  // GrowthBrief — 6pm UTC Sunday
  cron.schedule('0 18 * * 0', guardedJob('GrowthBrief', runGrowthBrief), { timezone: 'UTC' });

  // MonetizationAdvisor — 9am UTC 1st of month
  cron.schedule('0 9 1 * *', guardedJob('MonetizationAdvisor', runMonetizationAdvisor), { timezone: 'UTC' });

  // SocialPoster — 10am UTC daily (auto-posts approved X content)
  cron.schedule('0 10 * * *', guardedJob('SocialPoster', runSocialPoster), { timezone: 'UTC' });

  console.log('[CRON] All jobs registered (with guards: 30s/game timeout, 5min max runtime, lock guard):');
  console.log('  MetricsMonitor       — 0 6 * * *    (6am UTC daily)');
  console.log('  CompetitorIntel      — 0 8 * * *    (8am UTC daily)');
  console.log('  PricingTestCreator   — 0 9 * * 1    (9am UTC Monday)');
  console.log('  PricingEvaluator     — 0 */6 * * *  (every 6 hours)');
  console.log('  ContentGeneration    — 0 7 * * 1    (7am UTC Monday)');
  console.log('  GrowthBrief          — 0 18 * * 0   (6pm UTC Sunday)');
  console.log('  MonetizationAdvisor  — 0 9 1 * *    (9am UTC 1st of month)');
  console.log('  SocialPoster         — 0 10 * * *   (10am UTC daily)');
}
