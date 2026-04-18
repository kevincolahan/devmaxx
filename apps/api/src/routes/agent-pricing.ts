import { Router } from 'express';
import { db } from '../lib/db';
import { PricingTestCreatorAgent, PricingTestEvaluatorAgent } from '../agents/pricing-opt';
import { withTimeout, AGENT_RUN_TIMEOUT_MS, BATCH_JOB_TIMEOUT_MS } from '../lib/timeout';

export const agentPricingRouter = Router();

// Create new pricing tests
agentPricingRouter.post('/create', async (_req, res) => {
  try {
    const creators = await db.creator.findMany({
      where: { plan: { in: ['creator', 'pro', 'studio'] } },
      include: { games: true },
    });

    let testsCreated = 0;
    const errors: string[] = [];

    for (const creator of creators) {
      for (const game of creator.games) {
        try {
          const agent = new PricingTestCreatorAgent();
          const result = await withTimeout(
            agent.runFullPipeline(creator.id, game.id, db),
            AGENT_RUN_TIMEOUT_MS,
            `PricingCreate:${game.name}`
          );
          testsCreated++;
          console.log(`[PricingCreate:manual] ${game.name}: ${result.action}`);
        } catch (err) {
          errors.push(`${game.name}: ${String(err)}`);
        }
      }
    }

    res.json({ success: true, testsCreated, errors });
  } catch (err) {
    console.error('PricingTestCreator manual trigger failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});

// Evaluate existing pricing tests
agentPricingRouter.post('/evaluate', async (_req, res) => {
  try {
    const agent = new PricingTestEvaluatorAgent();
    const result = await withTimeout(
      agent.runFullPipeline(db),
      BATCH_JOB_TIMEOUT_MS,
      'PricingEvaluator:manual'
    );

    const output = result.output as Record<string, unknown>;
    res.json({
      success: true,
      testsEvaluated: output.testsEvaluated ?? 0,
      action: result.action,
    });
  } catch (err) {
    console.error('PricingTestEvaluator manual trigger failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});

// Default: run both evaluate + create
agentPricingRouter.post('/', async (_req, res) => {
  try {
    const errors: string[] = [];

    // Evaluate existing tests first
    let testsEvaluated = 0;
    try {
      const evalAgent = new PricingTestEvaluatorAgent();
      const evalResult = await withTimeout(
        evalAgent.runFullPipeline(db),
        BATCH_JOB_TIMEOUT_MS,
        'PricingEvaluator:manual'
      );
      testsEvaluated = (evalResult.output as Record<string, unknown>).testsEvaluated as number ?? 0;
    } catch (err) {
      errors.push(`Evaluator: ${String(err)}`);
    }

    // Then create new tests
    const creators = await db.creator.findMany({
      where: { plan: { in: ['creator', 'pro', 'studio'] } },
      include: { games: true },
    });

    let testsCreated = 0;
    for (const creator of creators) {
      for (const game of creator.games) {
        try {
          const agent = new PricingTestCreatorAgent();
          const result = await withTimeout(
            agent.runFullPipeline(creator.id, game.id, db),
            AGENT_RUN_TIMEOUT_MS,
            `PricingCreate:${game.name}`
          );
          testsCreated++;
          console.log(`[Pricing:manual] ${game.name}: ${result.action}`);
        } catch (err) {
          errors.push(`${game.name}: ${String(err)}`);
        }
      }
    }

    res.json({ success: true, testsEvaluated, testsCreated, errors });
  } catch (err) {
    console.error('Pricing agent manual trigger failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});
