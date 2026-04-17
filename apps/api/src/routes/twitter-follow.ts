import { Router } from 'express';
import { db } from '../lib/db';
import { runTwitterFollowPipeline } from '../agents/twitter-follow';
import { withTimeout, BATCH_JOB_TIMEOUT_MS } from '../lib/timeout';

export const twitterFollowRouter = Router();

twitterFollowRouter.post('/', async (_req, res) => {
  try {
    const result = await withTimeout(
      runTwitterFollowPipeline(db),
      BATCH_JOB_TIMEOUT_MS,
      'TwitterFollow:manual'
    );

    res.json({
      success: true,
      followed: result.followed,
      followedBack: result.followedBack,
      unfollowed: result.unfollowed,
      errors: result.errors,
    });
  } catch (err) {
    console.error('TwitterFollowAgent manual trigger failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});
