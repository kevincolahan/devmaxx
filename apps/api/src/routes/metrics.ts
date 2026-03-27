import { Router } from 'express';
import { db } from '../lib/db';
import { MetricsMonitorAgent } from '../agents/metrics-monitor';

export const metricsRouter = Router();

metricsRouter.post('/run', async (req, res) => {
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

  const agent = new MetricsMonitorAgent();

  try {
    const result = await agent.runFullPipeline(
      creatorId,
      gameId,
      {
        robloxGameId: game.robloxGameId,
        universeId: game.robloxGameId,
        gameName: game.name,
      },
      db
    );

    res.json({ success: true, result });
  } catch (err) {
    console.error('MetricsMonitorAgent failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});

metricsRouter.post('/run-all', async (_req, res) => {
  const creators = await db.creator.findMany({
    where: { plan: { not: 'free' } },
    include: { games: true },
  });

  const results: Array<{ gameId: string; status: string }> = [];

  for (const creator of creators) {
    for (const game of creator.games) {
      const agent = new MetricsMonitorAgent();
      try {
        await agent.runFullPipeline(
          creator.id,
          game.id,
          {
            robloxGameId: game.robloxGameId,
            universeId: game.robloxGameId,
            gameName: game.name,
          },
          db
        );
        results.push({ gameId: game.id, status: 'success' });
      } catch (err) {
        console.error(`Metrics failed for game ${game.id}:`, err);
        results.push({ gameId: game.id, status: 'failed' });
      }
    }
  }

  res.json({ success: true, results });
});
