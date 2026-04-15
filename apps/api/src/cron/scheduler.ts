import cron from 'node-cron';
import { db } from '../lib/db';
import { withTimeout, AGENT_RUN_TIMEOUT_MS, BATCH_JOB_TIMEOUT_MS } from '../lib/timeout';
import { MetricsMonitorAgent } from '../agents/metrics-monitor';
import { CompetitorIntelligenceAgent } from '../agents/competitor-intel';
import { PricingTestCreatorAgent, PricingTestEvaluatorAgent } from '../agents/pricing-opt';
import { ContentGenerationAgent } from '../agents/content-gen';
import { GrowthBriefAgent } from '../agents/growth-brief';
import { MonetizationAdvisorAgent } from '../agents/monetization';
import { RobloxNewsMonitorAgent } from '../agents/news-monitor';
import { postTweet } from '../lib/twitter';
import { postToLinkedIn } from '../lib/linkedin';
import { postToTikTok } from '../lib/tiktok';
import { createInstagramPost } from '../lib/instagram';
import { runMentionsResponsePipeline } from '../agents/mentions-response';
import { runCommunityOutreachPipeline } from '../agents/community-outreach';
import { runOutcomeTrackingPipeline } from '../agents/outcome-tracking';
import { checkSaleRestorations } from '../agents/command-executor';
import { runOnboardingEmails } from '../lib/onboarding-emails';
import { runRevenueForecastPipeline } from '../agents/revenue-forecast';
import { runEventImpactPipeline } from '../agents/event-impact';
import { runPlayerSentimentPipeline } from '../agents/player-sentiment';
import { runXOutreachPipeline } from '../agents/x-outreach';
import { runYouTubeOutreachPipeline } from '../agents/youtube-outreach';
import { runCreatorProspectingPipeline } from '../agents/creator-prospecting';
import { runTwitterFollowPipeline } from '../agents/twitter-follow';
import { runLinkedInGrowthPipeline } from '../agents/linkedin-growth';
import { runLeaderboardUpdaterPipeline } from '../agents/leaderboard-updater';
import { runCreatorEnrichmentPipeline } from '../agents/creator-enrichment';

// ─── Plan-based eligibility ──────────────────────────────────
// free    → GrowthBrief only
// creator → all agents (manual approval)
// pro     → all agents + competitor tracking + autopilot
// studio  → all agents + competitor tracking + autopilot

const PAID_PLANS = ['creator', 'pro', 'studio'];
const COMPETITOR_PLANS = ['pro', 'studio'];

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

    withTimeout(runner(), BATCH_JOB_TIMEOUT_MS, `${jobName} max runtime`)
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
          AGENT_RUN_TIMEOUT_MS,
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
          AGENT_RUN_TIMEOUT_MS,
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
          AGENT_RUN_TIMEOUT_MS,
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
      BATCH_JOB_TIMEOUT_MS,
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
          AGENT_RUN_TIMEOUT_MS,
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
          AGENT_RUN_TIMEOUT_MS,
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
          AGENT_RUN_TIMEOUT_MS,
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

// ─── News Monitor (weekly Roblox news → content) ─────────────

async function runNewsMonitor() {
  log('NewsMonitor', 'Starting weekly Roblox news scan');

  // Run as the Devmaxx system creator (kevin@devmaxx.app)
  const systemCreator = await db.creator.findFirst({
    where: { email: 'kevin@devmaxx.app' },
  });

  if (!systemCreator) {
    log('NewsMonitor', 'No system creator found (kevin@devmaxx.app) — skipping');
    return;
  }

  try {
    const agent = new RobloxNewsMonitorAgent();
    const result = await withTimeout(
      agent.runFullPipeline(systemCreator.id, db),
      BATCH_JOB_TIMEOUT_MS,
      'NewsMonitor'
    );
    const output = result.output as Record<string, unknown>;
    log('NewsMonitor', `${result.action} — scanned: ${output.articlesScanned}, high-scoring: ${output.highScoringCount}, pieces created: ${output.contentPiecesCreated}`);
  } catch (err) {
    log('NewsMonitor', `FAILED: ${err}`);
  }

  log('NewsMonitor', 'Complete');
}

// ─── Vercel Twitter Proxy (Railway IPs blocked by Twitter) ──

const VERCEL_BASE = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://www.devmaxx.app';

async function postTweetViaVercel(
  text: string
): Promise<{ success: boolean; postId?: string; postUrl?: string; tweetId?: string; tweetUrl?: string; error?: string }> {
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  if (!cronSecret) {
    log('SocialPoster', '[x] CRON_SECRET not set — cannot call Vercel');
    return { success: false, error: 'CRON_SECRET not configured' };
  }

  const url = `${VERCEL_BASE}/api/social/post-tweet`;
  log('SocialPoster', `[x] Posting via Vercel: ${url}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ text }),
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      return { success: false, error: `Vercel ${res.status}: ${JSON.stringify(data)}` };
    }

    return {
      success: true,
      tweetId: data.tweetId as string | undefined,
      tweetUrl: data.tweetUrl as string | undefined,
    };
  } catch (err) {
    return { success: false, error: `Vercel fetch error: ${String(err)}` };
  }
}

// ─── Social Poster (auto-post approved content, all platforms) ─

async function postOnePiece(
  platform: string,
  poster: (text: string) => Promise<{ success: boolean; postId?: string; postUrl?: string; tweetId?: string; tweetUrl?: string; error?: string }>
): Promise<boolean> {
  // Quiet hours check — never post between 11pm-7am UTC
  const hour = new Date().getUTCHours();
  if (hour >= 23 || hour < 7) {
    log('SocialPoster', `[${platform}] Skipping — quiet hours (${hour}:00 UTC)`);
    return false;
  }

  const pieces = await db.contentPiece.findMany({
    where: { platform, status: 'approved', publishedAt: null },
    orderBy: { createdAt: 'asc' },
    take: 5,
  });

  log('SocialPoster', `[${platform}] Found ${pieces.length} approved posts with publishedAt=null`);

  if (pieces.length === 0) {
    return false;
  }

  const piece = pieces[0];
  log('SocialPoster', `[${platform}] Attempting piece ${piece.id} (${piece.content.length} chars): "${piece.content.slice(0, 80)}..."`);

  if (platform === 'x' && piece.content.length > 280) {
    log('SocialPoster', `[${platform}] Skipping ${piece.id} — exceeds 280 chars (${piece.content.length})`);
    return false;
  }

  try {
    log('SocialPoster', `[${platform}] Calling poster function for ${piece.id}...`);
    const result = await withTimeout(
      poster(piece.content),
      AGENT_RUN_TIMEOUT_MS,
      `SocialPoster:${platform}:${piece.id}`
    );

    log('SocialPoster', `[${platform}] Poster returned: success=${result.success}, postId=${result.postId ?? result.tweetId ?? 'none'}, error=${result.error ?? 'none'}`);

    if (result.success) {
      // Normalize field names — postTweet returns tweetId/tweetUrl, others return postId/postUrl
      const postId = result.postId ?? result.tweetId;
      const postUrl = result.postUrl ?? result.tweetUrl;

      await db.contentPiece.update({
        where: { id: piece.id },
        data: {
          status: 'published',
          publishedAt: new Date(),
          performance: {
            postId,
            postUrl,
            platform,
            postedAt: new Date().toISOString(),
            autoPosted: true,
          },
        },
      });
      log('SocialPoster', `[${platform}] SUCCESS — posted ${piece.id}: ${postUrl ?? postId ?? 'ok'}`);
      return true;
    } else {
      log('SocialPoster', `[${platform}] FAILED ${piece.id}: ${result.error}`);
      return false;
    }
  } catch (err) {
    log('SocialPoster', `[${platform}] ERROR ${piece.id}: ${err}`);
    return false;
  }
}

async function runSocialPoster() {
  log('SocialPoster', 'Starting daily multi-platform auto-post');

  // Quiet hours moved into postOnePiece — each platform call checks independently

  const results: Record<string, boolean> = {};

  // 1. X/Twitter (routed through Vercel — Railway IPs blocked by Twitter)
  results.x = await postOnePiece('x', postTweetViaVercel);

  // 2. LinkedIn
  results.linkedin = await postOnePiece('linkedin', postToLinkedIn);

  // 3. TikTok (if token available)
  results.tiktok = await postOnePiece('tiktok', postToTikTok);

  // 4. Instagram (if token available)
  results.instagram = await postOnePiece('instagram', createInstagramPost);

  const posted = Object.values(results).filter(Boolean).length;
  log('SocialPoster', `Complete — ${posted}/4 platforms posted (${JSON.stringify(results)})`);
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

  // SocialPoster — staggered daily auto-posting per platform
  cron.schedule('0 10 * * *', guardedJob('SocialPoster:X', () => postOnePiece('x', postTweetViaVercel).then(() => {})), { timezone: 'UTC' });
  cron.schedule('0 11 * * *', guardedJob('SocialPoster:LinkedIn', () => postOnePiece('linkedin', postToLinkedIn).then(() => {})), { timezone: 'UTC' });
  cron.schedule('0 12 * * *', guardedJob('SocialPoster:Instagram', () => postOnePiece('instagram', createInstagramPost).then(() => {})), { timezone: 'UTC' });

  // RobloxNewsMonitor — 6am UTC Monday (weekly news scan → content)
  cron.schedule('0 6 * * 1', guardedJob('NewsMonitor', runNewsMonitor), { timezone: 'UTC' });

  // MentionsResponse — every 2 hours (monitor @devmaxxapp mentions)
  cron.schedule('0 */2 * * *', guardedJob('MentionsResponse', async () => {
    log('MentionsResponse', 'Starting mentions scan');
    try {
      const result = await withTimeout(
        runMentionsResponsePipeline(db),
        BATCH_JOB_TIMEOUT_MS,
        'MentionsResponse'
      );
      log('MentionsResponse', `Done — processed: ${result.mentionsProcessed}, replied: ${result.repliesPosted}, flagged: ${result.flaggedNegative}`);
    } catch (err) {
      log('MentionsResponse', `FAILED: ${err}`);
    }
  }), { timezone: 'UTC' });

  // CommunityOutreach — Wednesday 2pm UTC weekly
  cron.schedule('0 14 * * 3', guardedJob('CommunityOutreach', async () => {
    log('CommunityOutreach', 'Starting weekly community outreach');
    try {
      const result = await withTimeout(
        runCommunityOutreachPipeline(db),
        BATCH_JOB_TIMEOUT_MS,
        'CommunityOutreach'
      );
      log('CommunityOutreach', `Done — quality: ${result.qualityScore}, reddit: ${result.redditPosted}, devforum: ${result.devforumPosted}${result.skippedReason ? `, skipped: ${result.skippedReason}` : ''}`);
    } catch (err) {
      log('CommunityOutreach', `FAILED: ${err}`);
    }
  }), { timezone: 'UTC' });

  // PlayerSentiment — Tuesday 8am UTC (weekly feedback analysis)
  cron.schedule('0 8 * * 2', guardedJob('PlayerSentiment', async () => {
    log('PlayerSentiment', 'Starting weekly sentiment analysis');
    const creators = await getCreatorsWithGames(PAID_PLANS);
    for (const creator of creators) {
      for (const game of creator.games) {
        try {
          const result = await withTimeout(
            runPlayerSentimentPipeline(creator.id, game.id, db),
            AGENT_RUN_TIMEOUT_MS,
            `PlayerSentiment:${game.name}`
          );
          log('PlayerSentiment', `${game.name}: score=${result.overallScore}/10 (${result.weekOverWeekChange})`);
        } catch (err) {
          log('PlayerSentiment', `FAILED ${game.name}: ${err}`);
        }
      }
    }
    log('PlayerSentiment', 'Complete');
  }), { timezone: 'UTC' });

  // EventImpact — daily 7am UTC (detect updates, measure pending events)
  cron.schedule('30 7 * * *', guardedJob('EventImpact', async () => {
    log('EventImpact', 'Starting daily event impact analysis');
    try {
      const result = await withTimeout(
        runEventImpactPipeline(db),
        BATCH_JOB_TIMEOUT_MS,
        'EventImpact'
      );
      log('EventImpact', `Done — detected: ${result.eventsDetected}, measured: ${result.eventsMeasured}`);
    } catch (err) {
      log('EventImpact', `FAILED: ${err}`);
    }
  }), { timezone: 'UTC' });

  // RevenueForecast — Monday 10am UTC (after MetricsMonitor)
  cron.schedule('0 10 * * 1', guardedJob('RevenueForecast', async () => {
    log('RevenueForecast', 'Starting weekly revenue forecasts');
    const creators = await getCreatorsWithGames(PAID_PLANS);
    for (const creator of creators) {
      for (const game of creator.games) {
        try {
          const result = await withTimeout(
            runRevenueForecastPipeline(creator.id, game.id, db),
            AGENT_RUN_TIMEOUT_MS,
            `RevenueForecast:${game.name}`
          );
          log('RevenueForecast', `${game.name}: base=${result.forecast.next30DaysRobux} R$`);
        } catch (err) {
          log('RevenueForecast', `FAILED ${game.name}: ${err}`);
        }
      }
    }
    log('RevenueForecast', 'Complete');
  }), { timezone: 'UTC' });

  // OnboardingEmails — daily 9am UTC
  cron.schedule('0 9 * * *', guardedJob('OnboardingEmails', async () => {
    log('OnboardingEmails', 'Checking for day 3 + day 7 emails');
    try {
      const result = await runOnboardingEmails(db);
      log('OnboardingEmails', `Done — day3: ${result.day3Sent}, day7: ${result.day7Sent}`);
    } catch (err) {
      log('OnboardingEmails', `FAILED: ${err}`);
    }
  }), { timezone: 'UTC' });

  // SaleRestore — every hour (check for expired sales)
  cron.schedule('0 * * * *', guardedJob('SaleRestore', async () => {
    try {
      const restored = await checkSaleRestorations(db);
      if (restored > 0) log('SaleRestore', `Restored ${restored} expired sales`);
    } catch (err) {
      log('SaleRestore', `FAILED: ${err}`);
    }
  }), { timezone: 'UTC' });

  // OutcomeTracking — daily 7am UTC (check follow-ups)
  cron.schedule('0 7 * * *', guardedJob('OutcomeTracking', async () => {
    log('OutcomeTracking', 'Starting outcome follow-up checks');
    try {
      const result = await withTimeout(
        runOutcomeTrackingPipeline(db),
        BATCH_JOB_TIMEOUT_MS,
        'OutcomeTracking'
      );
      log('OutcomeTracking', `Done — checked: ${result.runsChecked}, updated: ${result.runsUpdated}, measured: ${result.totalMeasuredImpact} R$`);
    } catch (err) {
      log('OutcomeTracking', `FAILED: ${err}`);
    }
  }), { timezone: 'UTC' });

  // XOutreach — every 4 hours (proactive outreach to Roblox creators on X)
  cron.schedule('0 */4 * * *', guardedJob('XOutreach', async () => {
    log('XOutreach', 'Starting X outreach scan');
    try {
      const result = await withTimeout(
        runXOutreachPipeline(db),
        BATCH_JOB_TIMEOUT_MS,
        'XOutreach'
      );
      log('XOutreach', `Done — searched: ${result.tweetsSearched}, eligible: ${result.tweetsEligible}, replied: ${result.repliesPosted}, skipped: ${result.skipped}${result.errors.length > 0 ? `, errors: ${result.errors.length}` : ''}`);
    } catch (err) {
      log('XOutreach', `FAILED: ${err}`);
    }
  }), { timezone: 'UTC' });

  // YouTubeOutreach — Thursday 2pm UTC (weekly video comments)
  cron.schedule('0 14 * * 4', guardedJob('YouTubeOutreach', async () => {
    log('YouTubeOutreach', 'Starting weekly YouTube outreach');
    try {
      const result = await withTimeout(
        runYouTubeOutreachPipeline(db),
        BATCH_JOB_TIMEOUT_MS,
        'YouTubeOutreach'
      );
      log('YouTubeOutreach', `Done — searched: ${result.videosSearched}, eligible: ${result.videosEligible}, commented: ${result.commentsPosted}, skipped: ${result.skipped}${result.errors.length > 0 ? `, errors: ${result.errors.length}` : ''}`);
    } catch (err) {
      log('YouTubeOutreach', `FAILED: ${err}`);
    }
  }), { timezone: 'UTC' });

  // CreatorProspecting — 5am UTC daily (before other outreach jobs)
  cron.schedule('0 5 * * *', guardedJob('CreatorProspecting', async () => {
    log('CreatorProspecting', 'Starting daily creator prospecting scan');
    try {
      const result = await withTimeout(
        runCreatorProspectingPipeline(db),
        BATCH_JOB_TIMEOUT_MS,
        'CreatorProspecting'
      );
      log('CreatorProspecting', `Done — scanned: ${result.gamesScanned}, found: ${result.prospectsFound}, stored: ${result.prospectsStored}, outreach queued: ${result.outreachQueued}${result.errors.length > 0 ? `, errors: ${result.errors.length}` : ''}`);
    } catch (err) {
      log('CreatorProspecting', `FAILED: ${err}`);
    }
  }), { timezone: 'UTC' });

  // TwitterFollow — 2pm UTC daily (organic growth)
  cron.schedule('0 14 * * *', guardedJob('TwitterFollow', async () => {
    log('TwitterFollow', 'Starting daily Twitter follow pipeline');
    try {
      const result = await withTimeout(
        runTwitterFollowPipeline(db),
        BATCH_JOB_TIMEOUT_MS,
        'TwitterFollow'
      );
      log('TwitterFollow', `Done — followed: ${result.followed}, followed back: ${result.followedBack}, unfollowed: ${result.unfollowed}${result.errors.length > 0 ? `, errors: ${result.errors.length}` : ''}`);
    } catch (err) {
      log('TwitterFollow', `FAILED: ${err}`);
    }
  }), { timezone: 'UTC' });

  // LinkedInGrowth — 3pm UTC daily (engagement-based growth)
  cron.schedule('0 15 * * *', guardedJob('LinkedInGrowth', async () => {
    log('LinkedInGrowth', 'Starting daily LinkedIn growth pipeline');
    try {
      const result = await withTimeout(
        runLinkedInGrowthPipeline(db),
        BATCH_JOB_TIMEOUT_MS,
        'LinkedInGrowth'
      );
      log('LinkedInGrowth', `Done — comments: ${result.commentsPosted}, likes: ${result.likesGiven}, connections: ${result.connectionsSent}, scanned: ${result.postsScanned}${result.errors.length > 0 ? `, errors: ${result.errors.length}` : ''}`);
    } catch (err) {
      log('LinkedInGrowth', `FAILED: ${err}`);
    }
  }), { timezone: 'UTC' });

  // ─── LeaderboardUpdater — 0 8 * * * (8am UTC daily) ──────
  cron.schedule('0 8 * * *', guardedJob('LeaderboardUpdater', async () => {
    log('LeaderboardUpdater', 'Starting daily leaderboard update');
    try {
      const result = await withTimeout(
        runLeaderboardUpdaterPipeline(db),
        BATCH_JOB_TIMEOUT_MS,
        'LeaderboardUpdater'
      );
      log('LeaderboardUpdater', `Done — ${result.gamesUpdated} games updated, ${result.gamesScanned} scanned${result.errors.length > 0 ? `, errors: ${result.errors.length}` : ''}`);
    } catch (err) {
      log('LeaderboardUpdater', `FAILED: ${err}`);
    }
  }), { timezone: 'UTC' });

  // ─── CreatorEnrichment — 0 6 * * * (6am UTC daily) ──────
  cron.schedule('0 6 * * *', guardedJob('CreatorEnrichment', async () => {
    log('CreatorEnrichment', 'Starting daily creator enrichment pipeline');
    try {
      const result = await withTimeout(
        runCreatorEnrichmentPipeline(db),
        BATCH_JOB_TIMEOUT_MS,
        'CreatorEnrichment'
      );
      log('CreatorEnrichment', `Done — ${result.creatorsEnriched} enriched (${result.prospectsUpdated} prospects, ${result.leaderboardUpdated} leaderboard), ${result.outreachQueued} outreach queued${result.errors.length > 0 ? `, errors: ${result.errors.length}` : ''}`);
    } catch (err) {
      log('CreatorEnrichment', `FAILED: ${err}`);
    }
  }), { timezone: 'UTC' });

  console.log('[CRON] All jobs registered (with guards: 30s/game timeout, 5min max runtime, lock guard):');
  console.log('  MetricsMonitor       — 0 6 * * *    (6am UTC daily)');
  console.log('  NewsMonitor          — 0 6 * * 1    (6am UTC Monday)');
  console.log('  CompetitorIntel      — 0 8 * * *    (8am UTC daily)');
  console.log('  PricingTestCreator   — 0 9 * * 1    (9am UTC Monday)');
  console.log('  PricingEvaluator     — 0 */6 * * *  (every 6 hours)');
  console.log('  ContentGeneration    — 0 7 * * 1    (7am UTC Monday)');
  console.log('  GrowthBrief          — 0 18 * * 0   (6pm UTC Sunday)');
  console.log('  MonetizationAdvisor  — 0 9 1 * *    (9am UTC 1st of month)');
  console.log('  SocialPoster:X       — 0 10 * * *   (10am UTC daily)');
  console.log('  SocialPoster:LI      — 0 11 * * *   (11am UTC daily)');
  console.log('  SocialPoster:IG      — 0 12 * * *   (12pm UTC daily)');
  console.log('  MentionsResponse     — 0 */2 * * *  (every 2 hours)');
  console.log('  CommunityOutreach    — 0 14 * * 3  (2pm UTC Wednesday)');
  console.log('  PlayerSentiment      — 0 8 * * 2   (8am UTC Tuesday)');
  console.log('  EventImpact          — 30 7 * * *  (7:30am UTC daily)');
  console.log('  RevenueForecast      — 0 10 * * 1  (10am UTC Monday)');
  console.log('  OnboardingEmails     — 0 9 * * *   (9am UTC daily)');
  console.log('  SaleRestore          — 0 * * * *   (every hour)');
  console.log('  OutcomeTracking      — 0 7 * * *   (7am UTC daily)');
  console.log('  XOutreach            — 0 */4 * * *  (every 4 hours)');
  console.log('  YouTubeOutreach      — 0 14 * * 4  (2pm UTC Thursday)');
  console.log('  CreatorProspecting   — 0 5 * * *   (5am UTC daily)');
  console.log('  TwitterFollow        — 0 14 * * *  (2pm UTC daily)');
  console.log('  LinkedInGrowth       — 0 15 * * *  (3pm UTC daily)');
  console.log('  LeaderboardUpdater   — 0 8 * * *   (8am UTC daily)');
  console.log('  CreatorEnrichment    — 0 6 * * *   (6am UTC daily)');
}
