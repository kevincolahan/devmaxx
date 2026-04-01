import { Router } from 'express';
import { db } from '../lib/db';
import { GrowthBriefAgent } from '../agents/growth-brief';
import { withTimeout, AGENT_RUN_TIMEOUT_MS } from '../lib/timeout';

export const growthBriefRouter = Router();

growthBriefRouter.post('/send', async (req, res) => {
  const { creatorId, gameId } = req.body as {
    creatorId?: string;
    gameId?: string;
  };

  if (creatorId && gameId) {
    const agent = new GrowthBriefAgent();
    try {
      const result = await withTimeout(
        agent.runFullPipeline(creatorId, gameId, db),
        AGENT_RUN_TIMEOUT_MS,
        `GrowthBrief:${gameId}`
      );
      res.json({ success: true, result });
    } catch (err) {
      console.error('GrowthBriefAgent failed:', err);
      res.status(500).json({ error: 'Agent run failed', details: String(err) });
    }
    return;
  }

  const creators = await db.creator.findMany({
    where: { plan: { not: 'free' } },
    include: { games: true },
  });

  const results: Array<{ gameId: string; status: string; error?: string }> = [];

  for (const creator of creators) {
    for (const game of creator.games) {
      const agent = new GrowthBriefAgent();
      try {
        await withTimeout(
          agent.runFullPipeline(creator.id, game.id, db),
          AGENT_RUN_TIMEOUT_MS,
          `GrowthBrief:${game.name}`
        );
        results.push({ gameId: game.id, status: 'success' });
      } catch (err) {
        console.error(`Growth brief failed for game ${game.id}:`, err);
        results.push({ gameId: game.id, status: 'failed', error: String(err) });
      }
    }
  }

  res.json({ success: true, results });
});
