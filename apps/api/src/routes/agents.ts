import { Router } from 'express';
import { db } from '@devmaxx/db';

export const agentRouter = Router();

agentRouter.get('/runs', async (req, res) => {
  const { creatorId } = req.query;

  if (!creatorId || typeof creatorId !== 'string') {
    res.status(400).json({ error: 'creatorId is required' });
    return;
  }

  const runs = await db.agentRun.findMany({
    where: { creatorId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({ runs });
});

agentRouter.get('/runs/:id', async (req, res) => {
  const run = await db.agentRun.findUnique({
    where: { id: req.params.id },
  });

  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  res.json({ run });
});
