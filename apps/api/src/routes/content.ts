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
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'Roblox paid $1B+ to creators last year. Most left 20-40% on the table with unoptimized pricing. Devmaxx fixes that automatically. devmaxx.app',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'Your Roblox game is a business. Treat it like one. Devmaxx gives you a weekly brief — DAU trends, revenue analysis, pricing wins. Free to start. devmaxx.app',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'The difference between $500/month and $5,000/month on Roblox is usually knowing which items to price higher. Devmaxx finds that automatically. devmaxx.app',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'Games using A/B price testing earn 23% more DevEx on average. Devmaxx runs those tests automatically every week. Free tier available. devmaxx.app',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'Most Roblox devs check analytics once a month. Devmaxx checks daily and tells you exactly what changed and why. Free tier available. devmaxx.app',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'linkedin', status: 'approved',
      content: 'The Roblox creator economy just hit a milestone most people missed.\n\nRoblox paid out over $1 billion to creators through DevEx last year — a 31% increase year over year. That\'s real money flowing to independent developers building games on a platform with 88 million daily active users.\n\nBut here\'s what the headline doesn\'t show: the vast majority of monetizing creators are leaving significant revenue on the table. Unoptimized item pricing, no A/B testing, manual analytics checks, and zero competitor awareness are the norm — not the exception.\n\nThe tools these creators need don\'t exist inside Roblox. They\'ve never existed. Until now.\n\nDevmaxx is an AI-powered business operations platform built specifically for Roblox creators. Autonomous agents handle pricing optimization, player support, competitor tracking, and weekly business briefs — automatically.\n\nCreators focus on building great games. Devmaxx handles the business.\n\nIf you know a Roblox developer who should be earning more from their game, send them to devmaxx.app.\n\nWhat do you think is the biggest gap in creator economy tooling right now?',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'linkedin', status: 'approved',
      content: 'Roblox is the most underrated creator economy platform in 2026. Here\'s why.\n\n88 million daily active users. $1 billion paid to creators annually. A 17-year-old platform that is somehow still growing faster than most social networks.\n\nAnd yet when you ask most people in tech about the creator economy, they mention YouTube, TikTok, Substack. Rarely Roblox.\n\nThe difference: Roblox creators don\'t have personal brands. They have games. And games are businesses — businesses with DAU metrics, retention cohorts, item catalogs, pricing strategies, and player support queues.\n\nThe creator economy conversation has focused entirely on content creators. The game creator economy is a completely different animal — and it\'s larger, more durable, and significantly more underserved by tooling.\n\nThat\'s exactly the gap Devmaxx is built to fill. AI-powered business operations for Roblox game creators — the operators who need a business layer on top of their creative layer.\n\ndevmaxx.app\n\nAre you paying attention to the game creator economy?',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'linkedin', status: 'approved',
      content: 'What separates top-earning Roblox creators from everyone else? After analyzing creator data, five behaviors stand out.\n\n1. They test prices constantly. Top creators run A/B tests on item pricing continuously. They know that a 25% price increase on a high-demand item can double revenue without affecting conversion. Most creators set a price once and never touch it.\n\n2. They watch competitors daily. Top creators know when a competing game surges or drops in player count — and they capitalize immediately with events or updates. Most creators have no visibility into their competitive landscape.\n\n3. They track D7 retention obsessively. Daily active users is a vanity metric. D7 retention — how many players return after 7 days — is the real signal. Top creators optimize for this above everything else.\n\n4. They respond to player support fast. Games with sub-24-hour support response times retain significantly more players. Top creators treat player support as a revenue function, not a nuisance.\n\n5. They ship on a schedule. Weekly updates, bi-weekly events, monthly major releases. Consistency drives algorithmic visibility on Roblox and keeps the player base engaged between sessions.\n\nDevmaxx automates all five of these for creators who don\'t have a full team behind them.\n\ndevmaxx.app',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'instagram', status: 'approved',
      content: 'Roblox paid $1B+ to creators last year. Most left 20-40% on the table. Devmaxx fixes that automatically. Free to start \u2192 devmaxx.app',
      creatorId: creator.id,
    },
    {
      type: 'social_post', platform: 'instagram', status: 'approved',
      content: 'The difference between $500/month and $5,000/month on Roblox is knowing which items to price higher. Devmaxx finds that automatically. devmaxx.app',
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
