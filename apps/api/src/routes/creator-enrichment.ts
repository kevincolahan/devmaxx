import { Router } from 'express';
import { db } from '../lib/db';
import { runCreatorEnrichmentPipeline } from '../agents/creator-enrichment';
import { withTimeout, BATCH_JOB_TIMEOUT_MS } from '../lib/timeout';

export const creatorEnrichmentRouter = Router();

creatorEnrichmentRouter.post('/', async (_req, res) => {
  try {
    const result = await withTimeout(
      runCreatorEnrichmentPipeline(db),
      BATCH_JOB_TIMEOUT_MS,
      'CreatorEnrichment:manual'
    );

    res.json({
      success: true,
      creatorsEnriched: result.creatorsEnriched,
      prospectsUpdated: result.prospectsUpdated,
      leaderboardUpdated: result.leaderboardUpdated,
      outreachQueued: result.outreachQueued,
      errors: result.errors,
    });
  } catch (err) {
    console.error('CreatorEnrichmentAgent manual trigger failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});
