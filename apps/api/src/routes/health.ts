import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'devmaxx-api',
    version: '2.0.0',
    scheduler: 'running',
    timestamp: new Date().toISOString(),
  });
});
