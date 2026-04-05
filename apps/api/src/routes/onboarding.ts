import { Router } from 'express';
import { db } from '../lib/db';
import { sendWelcomeEmail, sendDay3Email, sendDay7Email } from '../lib/onboarding-emails';

export const onboardingRouter = Router();

onboardingRouter.post('/welcome', async (req, res) => {
  const { creatorId, email } = req.body as { creatorId?: string; email?: string };

  if (!email) {
    res.status(400).json({ error: 'email is required' });
    return;
  }

  let resolvedCreatorId = creatorId;
  if (!resolvedCreatorId) {
    const creator = await db.creator.findUnique({ where: { email } });
    if (!creator) {
      res.status(404).json({ error: 'Creator not found' });
      return;
    }
    resolvedCreatorId = creator.id;
  }

  const sent = await sendWelcomeEmail(db, resolvedCreatorId, email);
  res.json({ success: true, sent });
});

onboardingRouter.post('/day3', async (req, res) => {
  const { creatorId, email } = req.body as { creatorId: string; email: string };
  if (!creatorId || !email) {
    res.status(400).json({ error: 'creatorId and email are required' });
    return;
  }
  const sent = await sendDay3Email(db, creatorId, email);
  res.json({ success: true, sent });
});

onboardingRouter.post('/day7', async (req, res) => {
  const { creatorId, email } = req.body as { creatorId: string; email: string };
  if (!creatorId || !email) {
    res.status(400).json({ error: 'creatorId and email are required' });
    return;
  }
  const sent = await sendDay7Email(db, creatorId, email);
  res.json({ success: true, sent });
});
