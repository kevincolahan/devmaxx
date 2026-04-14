import { Router } from 'express';
import { db } from '../lib/db';
import { runCreatorProspectingPipeline } from '../agents/creator-prospecting';
import { withTimeout, BATCH_JOB_TIMEOUT_MS } from '../lib/timeout';

export const creatorProspectingRouter = Router();

creatorProspectingRouter.post('/', async (_req, res) => {
  try {
    const result = await withTimeout(
      runCreatorProspectingPipeline(db),
      BATCH_JOB_TIMEOUT_MS,
      'CreatorProspecting:manual'
    );

    res.json({
      success: true,
      prospectsFound: result.prospectsFound,
      prospectsScored: result.prospectsStored,
      outreachQueued: result.outreachQueued,
      gamesScanned: result.gamesScanned,
      errors: result.errors,
    });
  } catch (err) {
    console.error('CreatorProspectingAgent manual trigger failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});
