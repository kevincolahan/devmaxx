import { Router } from 'express';
import { db } from '../lib/db';
import { ContentGenerationAgent } from '../agents/content-gen';
import { postTweet, checkTwitterCredentials } from '../lib/twitter';
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
