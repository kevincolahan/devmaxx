import { Router } from 'express';
import { db } from '../lib/db';
import { GrowthBriefAgent } from '../agents/growth-brief';
import { withTimeout, AGENT_RUN_TIMEOUT_MS } from '../lib/timeout';

export const agentGrowthBriefRouter = Router();

agentGrowthBriefRouter.post('/', async (_req, res) => {
  try {
    const creators = await db.creator.findMany({
      where: { plan: { in: ['free', 'creator', 'pro', 'studio'] } },
      include: { games: true },
    });

    let briefsSent = 0;
    const errors: string[] = [];

    for (const creator of creators) {
      for (const game of creator.games) {
        try {
          const agent = new GrowthBriefAgent();
          const result = await withTimeout(
            agent.runFullPipeline(creator.id, game.id, db),
            AGENT_RUN_TIMEOUT_MS,
            `GrowthBrief:${game.name}`
          );
          briefsSent++;
          console.log(`[GrowthBrief:manual] ${game.name}: ${result.action}`);
        } catch (err) {
          errors.push(`${game.name}: ${String(err)}`);
        }
      }
    }

    res.json({ success: true, briefsSent, errors });
  } catch (err) {
    console.error('GrowthBriefAgent manual trigger failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});
