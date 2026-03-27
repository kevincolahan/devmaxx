import { Router } from 'express';
import { db } from '@devmaxx/db';
import { MonetizationAdvisorAgent } from '../agents/monetization';

export const monetizationRouter = Router();

monetizationRouter.post('/run', async (req, res) => {
  const { creatorId, gameId } = req.body as {
    creatorId?: string;
    gameId?: string;
  };

  if (creatorId && gameId) {
    const agent = new MonetizationAdvisorAgent();
    try {
      const result = await agent.runFullPipeline(creatorId, gameId, db);
      res.json({ success: true, result });
    } catch (err) {
      console.error('MonetizationAdvisorAgent failed:', err);
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
      const agent = new MonetizationAdvisorAgent();
      try {
        await agent.runFullPipeline(creator.id, game.id, db);
        results.push({ gameId: game.id, status: 'success' });
      } catch (err) {
        console.error(`Monetization audit failed for game ${game.id}:`, err);
        results.push({ gameId: game.id, status: 'failed' });
      }
    }
  }

  res.json({ success: true, results });
});
