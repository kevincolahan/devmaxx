import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'devmaxx-api', version: '1.1.0', timestamp: new Date().toISOString() });
});
