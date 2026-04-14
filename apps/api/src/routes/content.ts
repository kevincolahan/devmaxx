import { Router } from 'express';
import { db } from '../lib/db';
import { ContentGenerationAgent } from '../agents/content-gen';
import { postTweet, checkTwitterCredentials, testTwitterCredentials } from '../lib/twitter';
import { postToLinkedIn } from '../lib/linkedin';
import { postToTikTok } from '../lib/tiktok';
import { createInstagramPost } from '../lib/instagram';
import { withTimeout, AGENT_RUN_TIMEOUT_MS } from '../lib/timeout';

export const contentRouter = Router();

contentRouter.post('/generate', async (req, res) => {
  const { creatorId, gameId } = req.body as {
    creatorId?: string;
    gameId?: string;
  };

  if (creatorId && gameId) {
    const agent = new ContentGenerationAgent();
    try {
      const result = await withTimeout(
        agent.runFullPipeline(creatorId, gameId, db),
        AGENT_RUN_TIMEOUT_MS,
        `ContentGeneration:${gameId}`
      );
      res.json({ success: true, result });
    } catch (err) {
      console.error('ContentGenerationAgent failed:', err);
      res.status(500).json({ error: 'Agent run failed', details: String(err) });
    }
    return;
  }

  const creators = await db.creator.findMany({
    where: { plan: { in: ['creator', 'pro', 'studio'] } },
    include: { games: true },
  });

  const results: Array<{ gameId: string; status: string; error?: string }> = [];

  for (const creator of creators) {
    for (const game of creator.games) {
      const agent = new ContentGenerationAgent();
      try {
        await withTimeout(
          agent.runFullPipeline(creator.id, game.id, db),
          AGENT_RUN_TIMEOUT_MS,
          `ContentGeneration:${game.name}`
        );
        results.push({ gameId: game.id, status: 'success' });
      } catch (err) {
        console.error(`Content gen failed for game ${game.id}:`, err);
        results.push({ gameId: game.id, status: 'failed', error: String(err) });
      }
    }
  }

  res.json({ success: true, results });
});

// ─── Test Twitter credentials ────────────────────────────────

contentRouter.post('/test-twitter', async (_req, res) => {
  try {
    const result = await testTwitterCredentials();
    const status = result.credentialsConfigured && result.apiReachable && result.userId ? 200 : 502;
    res.status(status).json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Seed content pieces ─────────────────────────────────────

contentRouter.post('/generate-seed', async (_req, res) => {
  const creator = await db.creator.findFirst();
  if (!creator) {
    res.status(404).json({ error: 'No creator found in database' });
    return;
  }

  const posts = [
    // X posts — pure value (no product mention)
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'Most Roblox devs have never looked at their D7 retention. That one number tells you more about your game\'s future than DAU ever will.',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'The creators earning $5K+/month on Roblox all do one thing differently: they treat their game pass catalog like a product lineup, not an afterthought.',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'What\'s your D1 retention right now? Be honest. If you don\'t know the number off the top of your head, that\'s the problem.',
      creatorId: creator.id,
    },
    // X posts — industry insight (soft mention)
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'A/B tested item prices across a few games this week. Average revenue increase: 18%. Most creators set a price once and never touch it again.',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'Roblox paid $1B+ to creators last year. The gap between the top 10% and everyone else isn\'t talent. It\'s whether they optimize or guess.',
      creatorId: creator.id,
    },
    // X posts — product (with link)
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'Built a free DevEx calculator. Plug in your DAU and retention, see what you should be earning vs what you are. devmaxx.app/devex-calculator',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'I got tired of checking Roblox analytics manually so I built something that does it daily and tells me exactly what changed. devmaxx.app',
      creatorId: creator.id,
    },
    // X posts — engagement
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'Hot take: DAU is a vanity metric. A game with 500 DAU and 40% D7 retention will outperform a game with 5000 DAU and 8% retention every time.',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'Unpopular opinion: most Roblox games are underpriced. Creators are scared to charge more because they\'ve never tested it.',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'A creator went from $300/month to $2,100/month by doing one thing: raising the price of their most popular game pass by 40%. Nobody complained.',
      creatorId: creator.id,
    },
    // LinkedIn posts
    {
      type: 'social_post', platform: 'linkedin', status: 'approved',
      content: 'Nobody talks about this in the creator economy:\n\nRoblox creators are running businesses with real revenue, real customers, and real operational complexity — but zero business tooling.\n\nI spent the last few months talking to Roblox devs earning $1K-$20K/month through DevEx. Every single one of them was doing the same things manually: checking analytics once a week (if that), setting item prices based on gut feeling, responding to player support when they remembered, and having zero visibility into what competitors were doing.\n\nThese aren\'t hobbyists. These are operators running games with thousands of daily active users. They just don\'t have the tools that every other digital business takes for granted.\n\nSo I built it. Devmaxx runs AI agents that handle the business side automatically — daily metrics monitoring, A/B price testing, competitor tracking, weekly growth briefs. The creator focuses on making a great game. The agents handle the spreadsheet work.\n\nStill early, still building. But the response from creators who\'ve tried it has been wild. Turns out when you actually show someone their D7 retention for the first time, they immediately know what to fix.\n\ndevmaxx.app if you\'re curious.\n\nWhat business tools do you wish existed for the work you do?',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'linkedin', status: 'approved',
      content: 'Hot take: the Roblox creator economy is bigger and more durable than most of the creator economy platforms people obsess over.\n\n$1B+ paid to creators annually. 88M daily active users. Games that generate consistent recurring revenue for years — not viral spikes that fade in a week.\n\nBut here\'s the thing nobody in tech is talking about: Roblox creators aren\'t "creators" in the influencer sense. They\'re game developers running businesses. They have DAU metrics, retention cohorts, item catalogs, and player support queues.\n\nThe entire creator economy conversation has been about content creators — YouTubers, TikTokers, newsletter writers. The game creator economy is a completely different animal. And it\'s significantly more underserved by tooling.\n\nI\'ve been building in this space for a few months now and the gap is staggering. Most creators are doing everything manually that could be automated. Price testing? Manual. Competitor tracking? Nonexistent. Analytics review? Monthly at best.\n\nThat\'s why I\'m building Devmaxx — AI agents that handle the business operations so creators can focus on making great games.\n\nAre you paying attention to the game creator economy? I think it\'s about to have its moment.',
      creatorId: creator.id,
    },
    // Instagram posts
    {
      type: 'social_post', platform: 'instagram', status: 'approved',
      content: 'The gap between top Roblox earners and everyone else isn\'t talent. It\'s knowing your numbers. D7 retention > DAU. Every time. #RobloxDev #DevEx #GameDev',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'instagram', status: 'approved',
      content: 'Built a free tool to see how much your Roblox game should be earning. Plug in your DAU, see the gap. Link in bio. #RobloxCreator #DevEx #GameDev',
      creatorId: creator.id,
    },
  ];

  let count = 0;
  for (const post of posts) {
    await db.contentPiece.create({ data: post });
    count++;
  }

  console.log(`[generate-seed] Seeded ${count} content pieces for creator ${creator.id}`);
  res.json({ success: true, count, creatorId: creator.id });
});

// ─── Post to X/Twitter via API v2 ───────────────────────────

contentRouter.post('/post-to-x', async (req, res) => {
  // Pre-flight check — are credentials configured?
  const creds = checkTwitterCredentials();
  if (!creds.configured) {
    console.error(`[post-to-x] Twitter credentials not configured. Missing: ${creds.missing.join(', ')}`);
    res.status(503).json({
      error: `Twitter credentials not configured. Missing: ${creds.missing.join(', ')}`,
    });
    return;
  }

  const { contentPieceId } = req.body as { contentPieceId: string };

  if (!contentPieceId) {
    res.status(400).json({ error: 'contentPieceId is required' });
    return;
  }

  const piece = await db.contentPiece.findUnique({ where: { id: contentPieceId } });

  if (!piece) {
    res.status(404).json({ error: 'Content piece not found' });
    return;
  }

  if (piece.platform !== 'x') {
    res.status(400).json({ error: 'Content piece is not an X/Twitter post' });
    return;
  }

  if (piece.content.length > 280) {
    res.status(400).json({ error: `Tweet exceeds 280 characters (${piece.content.length})` });
    return;
  }

  try {
    console.log(`[post-to-x] Posting piece ${contentPieceId} (${piece.content.length} chars)`);

    const result = await withTimeout(
      postTweet(piece.content),
      AGENT_RUN_TIMEOUT_MS,
      `PostToX:${contentPieceId}`
    );

    if (!result.success) {
      console.error(`[post-to-x] Twitter API rejected: ${result.error}`);
      res.status(502).json({ error: result.error });
      return;
    }

    await db.contentPiece.update({
      where: { id: contentPieceId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        performance: {
          tweetId: result.tweetId,
          tweetUrl: result.tweetUrl,
          postedAt: new Date().toISOString(),
        },
      },
    });

    console.log(`[post-to-x] Success — ${result.tweetUrl}`);
    res.json({ success: true, postId: result.tweetId, postUrl: result.tweetUrl });
  } catch (err) {
    console.error('[post-to-x] Unhandled error:', err);
    res.status(500).json({ error: String(err) });
  }
});

// ─── Post to LinkedIn ────────────────────────────────────────

contentRouter.post('/post-to-linkedin', async (req, res) => {
  const { contentPieceId } = req.body as { contentPieceId: string };

  if (!contentPieceId) {
    res.status(400).json({ error: 'contentPieceId is required' });
    return;
  }

  const piece = await db.contentPiece.findUnique({ where: { id: contentPieceId } });

  if (!piece) {
    res.status(404).json({ error: 'Content piece not found' });
    return;
  }

  if (piece.platform !== 'linkedin') {
    res.status(400).json({ error: 'Content piece is not a LinkedIn post' });
    return;
  }

  try {
    const result = await withTimeout(
      postToLinkedIn(piece.content),
      AGENT_RUN_TIMEOUT_MS,
      `PostToLinkedIn:${contentPieceId}`
    );

    if (!result.success) {
      res.status(502).json({ error: result.error });
      return;
    }

    await db.contentPiece.update({
      where: { id: contentPieceId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        performance: {
          postId: result.postId,
          postUrl: result.postUrl,
          platform: 'linkedin',
          postedAt: new Date().toISOString(),
        },
      },
    });

    res.json({ success: true, postId: result.postId, postUrl: result.postUrl });
  } catch (err) {
    console.error('Failed to post to LinkedIn:', err);
    res.status(500).json({ error: 'Failed to post to LinkedIn', details: String(err) });
  }
});

// ─── Post to TikTok ─────────────────────────────────────────

contentRouter.post('/post-to-tiktok', async (req, res) => {
  const { contentPieceId } = req.body as { contentPieceId: string };

  if (!contentPieceId) {
    res.status(400).json({ error: 'contentPieceId is required' });
    return;
  }

  const piece = await db.contentPiece.findUnique({ where: { id: contentPieceId } });

  if (!piece) {
    res.status(404).json({ error: 'Content piece not found' });
    return;
  }

  if (piece.platform !== 'tiktok') {
    res.status(400).json({ error: 'Content piece is not a TikTok post' });
    return;
  }

  try {
    const result = await withTimeout(
      postToTikTok(piece.content),
      AGENT_RUN_TIMEOUT_MS,
      `PostToTikTok:${contentPieceId}`
    );

    if (!result.success) {
      res.status(502).json({ error: result.error });
      return;
    }

    await db.contentPiece.update({
      where: { id: contentPieceId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        performance: {
          postId: result.postId,
          platform: 'tiktok',
          postedAt: new Date().toISOString(),
        },
      },
    });

    res.json({ success: true, postId: result.postId });
  } catch (err) {
    console.error('Failed to post to TikTok:', err);
    res.status(500).json({ error: 'Failed to post to TikTok', details: String(err) });
  }
});

// ─── Post to Instagram ──────────────────────────────────────

contentRouter.post('/post-to-instagram', async (req, res) => {
  const { contentPieceId } = req.body as { contentPieceId: string };

  if (!contentPieceId) {
    res.status(400).json({ error: 'contentPieceId is required' });
    return;
  }

  const piece = await db.contentPiece.findUnique({ where: { id: contentPieceId } });

  if (!piece) {
    res.status(404).json({ error: 'Content piece not found' });
    return;
  }

  if (piece.platform !== 'instagram') {
    res.status(400).json({ error: 'Content piece is not an Instagram post' });
    return;
  }

  try {
    const result = await withTimeout(
      createInstagramPost(piece.content),
      AGENT_RUN_TIMEOUT_MS,
      `PostToInstagram:${contentPieceId}`
    );

    if (!result.success) {
      res.status(502).json({ error: result.error });
      return;
    }

    await db.contentPiece.update({
      where: { id: contentPieceId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        performance: {
          postId: result.postId,
          postUrl: result.postUrl,
          platform: 'instagram',
          postedAt: new Date().toISOString(),
        },
      },
    });

    res.json({ success: true, postId: result.postId, postUrl: result.postUrl });
  } catch (err) {
    console.error('Failed to post to Instagram:', err);
    res.status(500).json({ error: 'Failed to post to Instagram', details: String(err) });
  }
});

// ─── Debug: manually trigger X posting ──────────────────────

contentRouter.post('/trigger-x', async (_req, res) => {
  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // 1. Check Twitter credentials
  const creds = checkTwitterCredentials();
  debug.credentialsConfigured = creds.configured;
  debug.credentialsMissing = creds.missing;

  // Add key lengths for debugging without exposing secrets
  debug.keyLengths = {
    apiKey: (process.env.TWITTER_API_KEY || '').trim().length,
    apiSecret: (process.env.TWITTER_API_SECRET || '').trim().length,
    accessToken: (process.env.TWITTER_ACCESS_TOKEN || '').trim().length,
    accessSecret: (process.env.TWITTER_ACCESS_SECRET || '').trim().length,
  };

  if (!creds.configured) {
    res.json({ success: false, debug, error: 'Twitter credentials not configured' });
    return;
  }

  // 2. Query for approved X posts
  const allApproved = await db.contentPiece.findMany({
    where: { platform: 'x', status: 'approved', publishedAt: null },
    orderBy: { createdAt: 'asc' },
    take: 5,
    select: { id: true, content: true, status: true, platform: true, publishedAt: true, createdAt: true },
  });

  debug.approvedXPosts = allApproved.length;
  debug.posts = allApproved.map((p) => ({
    id: p.id,
    chars: p.content.length,
    preview: p.content.slice(0, 100),
    status: p.status,
    platform: p.platform,
    publishedAt: p.publishedAt,
    createdAt: p.createdAt,
  }));

  // Also check if there are posts with platform='twitter' instead of 'x'
  const twitterPlatform = await db.contentPiece.count({
    where: { platform: 'twitter', status: 'approved', publishedAt: null },
  });
  debug.postsWithPlatformTwitter = twitterPlatform;

  if (allApproved.length === 0) {
    res.json({ success: false, debug, error: 'No approved X posts with publishedAt=null found' });
    return;
  }

  const piece = allApproved[0];
  debug.attemptingPost = { id: piece.id, chars: piece.content.length };

  if (piece.content.length > 280) {
    res.json({ success: false, debug, error: `Post exceeds 280 chars (${piece.content.length})` });
    return;
  }

  // 3. Attempt to post via Vercel (Railway IPs blocked by Twitter)
  const vercelBase = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://www.devmaxx.app';
  const cronSecret = (process.env.CRON_SECRET || '').trim();

  debug.vercelBase = vercelBase;
  debug.cronSecretConfigured = !!cronSecret;

  if (!cronSecret) {
    res.json({ success: false, debug, error: 'CRON_SECRET not configured — cannot call Vercel' });
    return;
  }

  try {
    console.log(`[trigger-x] Posting piece ${piece.id} via Vercel: ${vercelBase}/api/social/post-tweet`);

    const vercelRes = await fetch(`${vercelBase}/api/social/post-tweet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ text: piece.content, contentPieceId: piece.id }),
    });

    const vercelData = (await vercelRes.json()) as Record<string, unknown>;

    debug.vercelStatus = vercelRes.status;
    debug.vercelResponse = vercelData;

    if (vercelRes.ok && vercelData.success) {
      debug.dbUpdated = true;
      res.json({ success: true, debug });
    } else {
      res.json({ success: false, debug, error: vercelData.error ?? `Vercel returned ${vercelRes.status}` });
    }
  } catch (err) {
    debug.error = String(err);
    console.error('[trigger-x] Error:', err);
    res.json({ success: false, debug });
  }
});

// ─── Cleanup test game content ──────────────────────────────

contentRouter.post('/cleanup-test-content', async (_req, res) => {
  const testPatterns = [
    "DevmaxxHQ's Place",
    'DevmaxxHQ',
    'Silent Storm Protocol',
    'Innovation Lab',
    'Mystery Genre',
  ];

  let totalDeleted = 0;
  const details: Array<{ pattern: string; count: number }> = [];

  for (const pattern of testPatterns) {
    const result = await db.contentPiece.deleteMany({
      where: {
        content: { contains: pattern },
      },
    });
    details.push({ pattern, count: result.count });
    totalDeleted += result.count;
  }

  console.log(`[cleanup] Deleted ${totalDeleted} test content pieces:`, details);
  res.json({ success: true, totalDeleted, details });
});
