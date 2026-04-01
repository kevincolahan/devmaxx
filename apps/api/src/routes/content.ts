import { Router } from 'express';
import { db } from '../lib/db';
import { ContentGenerationAgent } from '../agents/content-gen';
import { postTweet } from '../lib/twitter';

export const contentRouter = Router();

contentRouter.post('/generate', async (req, res) => {
  const { creatorId, gameId } = req.body as {
    creatorId?: string;
    gameId?: string;
  };

  if (creatorId && gameId) {
    const agent = new ContentGenerationAgent();
    try {
      const result = await agent.runFullPipeline(creatorId, gameId, db);
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

  const results: Array<{ gameId: string; status: string }> = [];

  for (const creator of creators) {
    for (const game of creator.games) {
      const agent = new ContentGenerationAgent();
      try {
        await agent.runFullPipeline(creator.id, game.id, db);
        results.push({ gameId: game.id, status: 'success' });
      } catch (err) {
        console.error(`Content gen failed for game ${game.id}:`, err);
        results.push({ gameId: game.id, status: 'failed' });
      }
    }
  }

  res.json({ success: true, results });
});

// ─── Post to X/Twitter via API v2 ───────────────────────────

contentRouter.post('/post-to-x', async (req, res) => {
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
    const result = await postTweet(piece.content);

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
          tweetId: result.tweetId,
          tweetUrl: result.tweetUrl,
          postedAt: new Date().toISOString(),
        },
      },
    });

    res.json({ success: true, tweetId: result.tweetId, tweetUrl: result.tweetUrl });
  } catch (err) {
    console.error('Failed to post to X:', err);
    res.status(500).json({ error: 'Failed to post tweet', details: String(err) });
  }
});
