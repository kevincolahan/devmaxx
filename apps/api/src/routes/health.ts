import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'devmaxx-api', timestamp: new Date().toISOString() });
});
