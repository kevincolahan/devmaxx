import { Router } from 'express';
import { db } from '@devmaxx/db';
import { CompetitorIntelligenceAgent } from '../agents/competitor-intel';

export const competitorRouter = Router();

competitorRouter.post('/run', async (req, res) => {
  const { creatorId, gameId } = req.body as {
    creatorId: string;
    gameId: string;
  };

  if (!creatorId || !gameId) {
    res.status(400).json({ error: 'creatorId and gameId are required' });
    return;
  }

  const game = await db.game.findUnique({ where: { id: gameId } });
  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }

  if (game.competitors.length === 0) {
    res.status(400).json({ error: 'No competitors configured for this game' });
    return;
  }

  const agent = new CompetitorIntelligenceAgent();

  try {
    const result = await agent.runFullPipeline(
      creatorId,
      gameId,
      {
        watchingGameId: gameId,
        watchingGameName: game.name,
        competitorUniverseIds: game.competitors,
      },
      db
    );

    res.json({ success: true, result });
  } catch (err) {
    console.error('CompetitorIntelligenceAgent failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});

competitorRouter.post('/run-all', async (_req, res) => {
  const games = await db.game.findMany({
    where: {
      competitors: { isEmpty: false },
      creator: { plan: { in: ['pro', 'studio'] } },
    },
    include: { creator: true },
  });

  const results: Array<{ gameId: string; status: string }> = [];

  for (const game of games) {
    const agent = new CompetitorIntelligenceAgent();
    try {
      await agent.runFullPipeline(
        game.creatorId,
        game.id,
        {
          watchingGameId: game.id,
          watchingGameName: game.name,
          competitorUniverseIds: game.competitors,
        },
        db
      );
      results.push({ gameId: game.id, status: 'success' });
    } catch (err) {
      console.error(`Competitor intel failed for game ${game.id}:`, err);
      results.push({ gameId: game.id, status: 'failed' });
    }
  }

  res.json({ success: true, results });
});
