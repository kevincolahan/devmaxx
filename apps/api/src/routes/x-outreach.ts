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

// Reset: clear old XOutreachLog entries to allow fresh runs
xOutreachRouter.post('/reset', async (_req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const deleted = await db.xOutreachLog.deleteMany({
      where: { createdAt: { lt: sevenDaysAgo } },
    });

    console.log(`[XOutreach] Reset — deleted ${deleted.count} log entries older than 7 days`);

    res.json({
      success: true,
      deletedCount: deleted.count,
      message: `Cleared ${deleted.count} outreach log entries older than 7 days`,
    });
  } catch (err) {
    console.error('XOutreach reset failed:', err);
    res.status(500).json({ error: 'Reset failed', details: String(err) });
  }
});
