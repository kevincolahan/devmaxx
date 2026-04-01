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

// ─── Job Runners ─────────────────────────────────────────────

async function runMetricsMonitor() {
  log('MetricsMonitor', 'Starting daily metrics scan');
  const creators = await getCreatorsWithGames(PAID_PLANS);

  for (const creator of creators) {
    for (const game of creator.games) {
      try {
        const agent = new MetricsMonitorAgent();
        const result = await agent.runFullPipeline(
          creator.id,
          game.id,
          {
            robloxGameId: game.robloxGameId,
            universeId: game.robloxGameId,
            gameName: game.name,
          },
          db
        );
        log('MetricsMonitor', `${game.name}: ${result.action} (healthScore: ${(result.output as Record<string, unknown>).healthScore ?? 'N/A'})`);
      } catch (err) {
        log('MetricsMonitor', `FAILED ${game.name}: ${err}`);
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
        const result = await agent.runFullPipeline(
          creator.id,
          game.id,
          {
            watchingGameId: game.id,
            watchingGameName: game.name,
            competitorUniverseIds: game.competitors,
          },
          db
        );
        log('CompetitorIntel', `${game.name}: ${result.action} (${(result.output as Record<string, unknown>).materialChanges ? ((result.output as Record<string, unknown>).materialChanges as unknown[]).length : 0} changes)`);
      } catch (err) {
        log('CompetitorIntel', `FAILED ${game.name}: ${err}`);
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
        const result = await agent.runFullPipeline(creator.id, game.id, db);
        log('PricingTestCreator', `${game.name}: ${result.action}`);
      } catch (err) {
        log('PricingTestCreator', `FAILED ${game.name}: ${err}`);
      }
    }
  }

  log('PricingTestCreator', 'Complete');
}

async function runPricingTestEvaluator() {
  log('PricingEvaluator', 'Starting test evaluation');

  try {
    const agent = new PricingTestEvaluatorAgent();
    const result = await agent.runFullPipeline(db);
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
        const result = await agent.runFullPipeline(creator.id, game.id, db);
        const output = result.output as Record<string, unknown>;
        log('ContentGeneration', `${game.name}: ${result.action} (${output.qualityFiltered ?? 0} pieces)`);
      } catch (err) {
        log('ContentGeneration', `FAILED ${game.name}: ${err}`);
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
        const result = await agent.runFullPipeline(creator.id, game.id, db);
        log('GrowthBrief', `${game.name}: ${result.action}`);
      } catch (err) {
        log('GrowthBrief', `FAILED ${game.name}: ${err}`);
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
        const result = await agent.runFullPipeline(creator.id, game.id, db);
        log('MonetizationAdvisor', `${game.name}: ${result.action}`);
      } catch (err) {
        log('MonetizationAdvisor', `FAILED ${game.name}: ${err}`);
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
      const result = await postTweet(piece.content);

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
  cron.schedule('0 6 * * *', () => {
    runMetricsMonitor().catch((err) => log('MetricsMonitor', `Unhandled error: ${err}`));
  }, { timezone: 'UTC' });

  // CompetitorIntelligenceAgent — 8am UTC daily
  cron.schedule('0 8 * * *', () => {
    runCompetitorIntelligence().catch((err) => log('CompetitorIntel', `Unhandled error: ${err}`));
  }, { timezone: 'UTC' });

  // PricingTestCreator — 9am UTC Monday
  cron.schedule('0 9 * * 1', () => {
    runPricingTestCreator().catch((err) => log('PricingTestCreator', `Unhandled error: ${err}`));
  }, { timezone: 'UTC' });

  // PricingTestEvaluator — every 6 hours
  cron.schedule('0 */6 * * *', () => {
    runPricingTestEvaluator().catch((err) => log('PricingEvaluator', `Unhandled error: ${err}`));
  }, { timezone: 'UTC' });

  // ContentGeneration — 7am UTC Monday
  cron.schedule('0 7 * * 1', () => {
    runContentGeneration().catch((err) => log('ContentGeneration', `Unhandled error: ${err}`));
  }, { timezone: 'UTC' });

  // GrowthBrief — 6pm UTC Sunday
  cron.schedule('0 18 * * 0', () => {
    runGrowthBrief().catch((err) => log('GrowthBrief', `Unhandled error: ${err}`));
  }, { timezone: 'UTC' });

  // MonetizationAdvisor — 9am UTC 1st of month
  cron.schedule('0 9 1 * *', () => {
    runMonetizationAdvisor().catch((err) => log('MonetizationAdvisor', `Unhandled error: ${err}`));
  }, { timezone: 'UTC' });

  // SocialPoster — 10am UTC daily (auto-posts approved X content)
  cron.schedule('0 10 * * *', () => {
    runSocialPoster().catch((err) => log('SocialPoster', `Unhandled error: ${err}`));
  }, { timezone: 'UTC' });

  console.log('[CRON] All jobs registered:');
  console.log('  MetricsMonitor       — 0 6 * * *    (6am UTC daily)');
  console.log('  CompetitorIntel      — 0 8 * * *    (8am UTC daily)');
  console.log('  PricingTestCreator   — 0 9 * * 1    (9am UTC Monday)');
  console.log('  PricingEvaluator     — 0 */6 * * *  (every 6 hours)');
  console.log('  ContentGeneration    — 0 7 * * 1    (7am UTC Monday)');
  console.log('  GrowthBrief          — 0 18 * * 0   (6pm UTC Sunday)');
  console.log('  MonetizationAdvisor  — 0 9 1 * *    (9am UTC 1st of month)');
  console.log('  SocialPoster         — 0 10 * * *   (10am UTC daily)');
}
