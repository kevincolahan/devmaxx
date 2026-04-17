import { Router } from 'express';
import { db } from '../lib/db';
import { runYouTubeOutreachPipeline } from '../agents/youtube-outreach';
import { withTimeout, BATCH_JOB_TIMEOUT_MS } from '../lib/timeout';

export const youtubeOutreachRouter = Router();

youtubeOutreachRouter.post('/', async (_req, res) => {
  try {
    const result = await withTimeout(
      runYouTubeOutreachPipeline(db),
      BATCH_JOB_TIMEOUT_MS,
      'YouTubeOutreach:manual'
    );

    res.json({
      success: true,
      videosSearched: result.videosSearched,
      videosEligible: result.videosEligible,
      commentsPosted: result.commentsPosted,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (err) {
    console.error('YouTubeOutreachAgent manual trigger failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});
