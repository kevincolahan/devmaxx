import { Router } from 'express';
import { db } from '../lib/db';
import { CompetitorIntelligenceAgent } from '../agents/competitor-intel';
import { withTimeout, AGENT_RUN_TIMEOUT_MS } from '../lib/timeout';

export const competitorIntelRouter = Router();

competitorIntelRouter.post('/', async (_req, res) => {
  try {
    const creators = await db.creator.findMany({
      where: { plan: { in: ['pro', 'studio'] } },
      include: { games: true },
    });

    let gamesProcessed = 0;
    const errors: string[] = [];

    for (const creator of creators) {
      for (const game of creator.games) {
        if (game.competitors.length === 0) continue;

        try {
          const agent = new CompetitorIntelligenceAgent();
          const result = await withTimeout(
            agent.runFullPipeline(
              creator.id,
              game.id,
              {
                watchingGameId: game.id,
                watchingGameName: game.name,
                competitorUniverseIds: game.competitors,
              },
              db
            ),
            AGENT_RUN_TIMEOUT_MS,
            `CompetitorIntel:${game.name}`
          );
          gamesProcessed++;
          console.log(`[CompetitorIntel:manual] ${game.name}: ${result.action}`);
        } catch (err) {
          errors.push(`${game.name}: ${String(err)}`);
        }
      }
    }

    res.json({ success: true, gamesProcessed, errors });
  } catch (err) {
    console.error('CompetitorIntelAgent manual trigger failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});
