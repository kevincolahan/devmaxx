import { Router } from 'express';
import { db } from '../lib/db';
import { MetricsMonitorAgent } from '../agents/metrics-monitor';
import { withTimeout, AGENT_RUN_TIMEOUT_MS } from '../lib/timeout';

export const metricsMonitorRouter = Router();

metricsMonitorRouter.post('/', async (_req, res) => {
  try {
    const creators = await db.creator.findMany({
      where: { plan: { in: ['creator', 'pro', 'studio'] } },
      include: { games: true },
    });

    let gamesProcessed = 0;
    const errors: string[] = [];

    for (const creator of creators) {
      for (const game of creator.games) {
        try {
          const agent = new MetricsMonitorAgent();
          const result = await withTimeout(
            agent.runFullPipeline(
              creator.id,
              game.id,
              {
                robloxGameId: game.robloxGameId,
                universeId: game.robloxGameId,
                gameName: game.name,
              },
              db
            ),
            AGENT_RUN_TIMEOUT_MS,
            `MetricsMonitor:${game.name}`
          );
          gamesProcessed++;
          console.log(`[MetricsMonitor:manual] ${game.name}: ${result.action}`);
        } catch (err) {
          errors.push(`${game.name}: ${String(err)}`);
        }
      }
    }

    res.json({ success: true, gamesProcessed, errors });
  } catch (err) {
    console.error('MetricsMonitorAgent manual trigger failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});
