import { Router } from 'express';
import { db } from '../lib/db';
import { PricingTestCreatorAgent, PricingTestEvaluatorAgent } from '../agents/pricing-opt';
import { withTimeout, AGENT_RUN_TIMEOUT_MS } from '../lib/timeout';

export const pricingRouter = Router();

pricingRouter.post('/create-tests', async (req, res) => {
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

  const agent = new PricingTestCreatorAgent();

  try {
    const result = await withTimeout(
      agent.runFullPipeline(creatorId, gameId, db),
      AGENT_RUN_TIMEOUT_MS,
      `PricingTestCreator:${game.name}`
    );
    res.json({ success: true, result });
  } catch (err) {
    console.error('PricingTestCreatorAgent failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});

pricingRouter.post('/evaluate-tests', async (_req, res) => {
  const agent = new PricingTestEvaluatorAgent();

  try {
    const result = await withTimeout(
      agent.runFullPipeline(db),
      AGENT_RUN_TIMEOUT_MS,
      'PricingTestEvaluator'
    );
    res.json({ success: true, result });
  } catch (err) {
    console.error('PricingTestEvaluatorAgent failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});

pricingRouter.post('/run-all', async (_req, res) => {
  const creators = await db.creator.findMany({
    where: { plan: { in: ['creator', 'pro', 'studio'] } },
    include: { games: true },
  });

  const results: Array<{ gameId: string; status: string; error?: string }> = [];

  for (const creator of creators) {
    for (const game of creator.games) {
      const agent = new PricingTestCreatorAgent();
      try {
        await withTimeout(
          agent.runFullPipeline(creator.id, game.id, db),
          AGENT_RUN_TIMEOUT_MS,
          `PricingTestCreator:${game.name}`
        );
        results.push({ gameId: game.id, status: 'success' });
      } catch (err) {
        console.error(`Pricing tests failed for game ${game.id}:`, err);
        results.push({ gameId: game.id, status: 'failed', error: String(err) });
      }
    }
  }

  res.json({ success: true, results });
});
