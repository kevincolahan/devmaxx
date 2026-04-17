import { Router } from 'express';
import { db } from '../lib/db';
import { runXOutreachPipeline } from '../agents/x-outreach';
import { withTimeout, BATCH_JOB_TIMEOUT_MS } from '../lib/timeout';

export const xOutreachRouter = Router();

xOutreachRouter.post('/', async (_req, res) => {
  try {
    const result = await withTimeout(
      runXOutreachPipeline(db),
      BATCH_JOB_TIMEOUT_MS,
      'XOutreach:manual'
    );

    res.json({
      success: true,
      tweetsSearched: result.tweetsSearched,
      tweetsEligible: result.tweetsEligible,
      repliesPosted: result.repliesPosted,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (err) {
    console.error('XOutreachAgent manual trigger failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});
