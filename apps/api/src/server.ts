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

app.listen(PORT, () => {
  console.log(`Devmaxx API running on port ${PORT}`);
  startScheduler();
});

export { app, db };
