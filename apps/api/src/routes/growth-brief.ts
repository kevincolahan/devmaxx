import { Router } from 'express';
import { db } from '../lib/db';
import { GrowthBriefAgent } from '../agents/growth-brief';

export const growthBriefRouter = Router();

growthBriefRouter.post('/send', async (req, res) => {
  const { creatorId, gameId } = req.body as {
    creatorId?: string;
    gameId?: string;
  };

  if (creatorId && gameId) {
    const agent = new GrowthBriefAgent();
    try {
      const result = await agent.runFullPipeline(creatorId, gameId, db);
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

  const results: Array<{ gameId: string; status: string }> = [];

  for (const creator of creators) {
    for (const game of creator.games) {
      const agent = new GrowthBriefAgent();
      try {
        await agent.runFullPipeline(creator.id, game.id, db);
        results.push({ gameId: game.id, status: 'success' });
      } catch (err) {
        console.error(`Growth brief failed for game ${game.id}:`, err);
        results.push({ gameId: game.id, status: 'failed' });
      }
    }
  }

  res.json({ success: true, results });
});
