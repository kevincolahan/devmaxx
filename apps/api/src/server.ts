process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
  process.exit(1);
});

import express from 'express';
import cors from 'cors';
import { db } from './lib/db';
import { healthRouter } from './routes/health';
import { agentRouter } from './routes/agents';
import { metricsRouter } from './routes/metrics';
import { competitorRouter } from './routes/competitors';
import { pricingRouter } from './routes/pricing';
import { monetizationRouter } from './routes/monetization';
import { supportRouter } from './routes/support';
import { contentRouter } from './routes/content';
import { growthBriefRouter } from './routes/growth-brief';
import { startScheduler } from './cron/scheduler';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Global request timeout — 5 minutes max for any request
app.use((_req, res, next) => {
  res.setTimeout(300_000, () => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Request timeout — exceeded 5 minutes' });
    }
  });
  next();
});

app.use('/health', healthRouter);
app.use('/api/agents', agentRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/competitors', competitorRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/monetization', monetizationRouter);
app.use('/api/support', supportRouter);
app.use('/api/content', contentRouter);
app.use('/api/growth-brief', growthBriefRouter);

async function startup() {
  // Verify DB connection before accepting traffic
  try {
    await db.$connect();
    console.log('[STARTUP] Database connected successfully');
  } catch (err) {
    console.error('[STARTUP] Database connection failed:', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Devmaxx API running on port ${PORT}`);

    // Log social credential status at startup
    const socialCreds = {
      TWITTER_API_KEY: !!process.env.TWITTER_API_KEY,
      TWITTER_API_SECRET: !!process.env.TWITTER_API_SECRET,
      TWITTER_ACCESS_TOKEN: !!process.env.TWITTER_ACCESS_TOKEN,
      TWITTER_ACCESS_SECRET: !!process.env.TWITTER_ACCESS_SECRET,
      LINKEDIN_ACCESS_TOKEN: !!process.env.LINKEDIN_ACCESS_TOKEN,
      LINKEDIN_ORG_ID: !!process.env.LINKEDIN_ORG_ID,
      TIKTOK_ACCESS_TOKEN: !!process.env.TIKTOK_ACCESS_TOKEN,
      INSTAGRAM_ACCESS_TOKEN: !!process.env.INSTAGRAM_ACCESS_TOKEN,
      INSTAGRAM_ACCOUNT_ID: !!process.env.INSTAGRAM_ACCOUNT_ID,
    };
    console.log('[STARTUP] Social credentials:', socialCreds);

    // Start cron scheduler after server is listening
    try {
      startScheduler();
      console.log('[STARTUP] Scheduler started');
    } catch (err) {
      console.error('[STARTUP] Scheduler failed to start:', err);
      // Don't exit — let the API serve requests even if scheduler fails
    }
  });
}

startup().catch((err) => {
  console.error('[STARTUP] Fatal error:', err);
  process.exit(1);
});

export { app, db };
