import { Router } from 'express';
import { db } from '../lib/db';
import { runMentionsResponsePipeline } from '../agents/mentions-response';
import { withTimeout, BATCH_JOB_TIMEOUT_MS } from '../lib/timeout';

export const mentionsResponseRouter = Router();

mentionsResponseRouter.post('/', async (_req, res) => {
  try {
    const result = await withTimeout(
      runMentionsResponsePipeline(db),
      BATCH_JOB_TIMEOUT_MS,
      'MentionsResponse:manual'
    );

    res.json({
      success: true,
      mentionsProcessed: result.mentionsProcessed,
      repliesPosted: result.repliesPosted,
      flaggedNegative: result.flaggedNegative,
    });
  } catch (err) {
    console.error('MentionsResponseAgent manual trigger failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});
