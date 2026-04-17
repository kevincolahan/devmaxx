import { Router } from 'express';
import { db } from '../lib/db';
import { runLinkedInGrowthPipeline } from '../agents/linkedin-growth';
import { withTimeout, BATCH_JOB_TIMEOUT_MS } from '../lib/timeout';

export const linkedInGrowthRouter = Router();

linkedInGrowthRouter.post('/', async (_req, res) => {
  try {
    const result = await withTimeout(
      runLinkedInGrowthPipeline(db),
      BATCH_JOB_TIMEOUT_MS,
      'LinkedInGrowth:manual'
    );

    res.json({
      success: true,
      commentsPosted: result.commentsPosted,
      likesGiven: result.likesGiven,
      connectionsSent: result.connectionsSent,
      postsScanned: result.postsScanned,
      errors: result.errors,
    });
  } catch (err) {
    console.error('LinkedInGrowthAgent manual trigger failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});
