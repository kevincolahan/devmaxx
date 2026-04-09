import { Router } from 'express';
import { db } from '../lib/db';
import { announceFeature } from '../agents/feature-announcement';
import { withTimeout, AGENT_RUN_TIMEOUT_MS } from '../lib/timeout';

export const announcementsRouter = Router();

announcementsRouter.post('/feature', async (req, res) => {
  const { featureName, description, url, type } = req.body as {
    featureName?: string;
    description?: string;
    url?: string;
    type?: 'tool' | 'feature' | 'improvement';
  };

  if (!featureName || !description || !url) {
    res.status(400).json({
      error: 'featureName, description, and url are required',
    });
    return;
  }

  try {
    const result = await withTimeout(
      announceFeature(db, {
        featureName,
        description,
        url,
        type: type ?? 'feature',
      }),
      AGENT_RUN_TIMEOUT_MS,
      `FeatureAnnouncement:${featureName}`
    );

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[FeatureAnnouncement] Route error:', err);
    res.status(500).json({ error: String(err) });
  }
});
