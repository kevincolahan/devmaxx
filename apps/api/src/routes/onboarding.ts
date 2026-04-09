import { Router } from 'express';
import { Resend } from 'resend';
import { db } from '../lib/db';
import { sendWelcomeEmail, sendDay3Email, sendDay7Email } from '../lib/onboarding-emails';

const FROM = process.env.FROM_EMAIL ?? 'onboarding@resend.dev';

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

onboardingRouter.post('/referral-credit', async (req, res) => {
  const { referrerEmail, referredEmail } = req.body as {
    referrerEmail: string;
    referredEmail: string;
  };

  if (!referrerEmail || !referredEmail) {
    res.status(400).json({ error: 'referrerEmail and referredEmail are required' });
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: FROM,
      to: referrerEmail,
      subject: 'You earned a free month of Devmaxx!',
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">

<div style="text-align:center;margin-bottom:32px;">
  <h1 style="font-size:28px;font-weight:700;margin:0;color:#fff;">Devmaxx</h1>
  <p style="color:#6366f1;margin:4px 0 0;font-size:14px;">Maxx your DevEx</p>
</div>

<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:24px;margin-bottom:24px;">
  <h2 style="font-size:20px;margin:0 0 12px;color:#10b981;">You earned a free month!</h2>
  <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 16px;">
    ${referredEmail} just upgraded to a paid plan using your referral link. We've added <strong style="color:#fff;">1 free month</strong> to your account as a thank you.
  </p>
  <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 16px;">
    Keep sharing your referral link to earn more free months. Every creator who upgrades through your link gives you another month free.
  </p>
  <div style="text-align:center;margin-top:20px;">
    <a href="https://devmaxx.app/dashboard" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">View your dashboard</a>
  </div>
</div>

<div style="text-align:center;color:#4b5563;font-size:11px;margin-top:40px;padding-top:24px;border-top:1px solid #1f2937;">
  <p>You're receiving this because you signed up at devmaxx.app</p>
  <p>Devmaxx &middot; devmaxx.app</p>
</div>

</div>
</body>
</html>`,
    });

    console.log(`[Referral] Credit email sent to ${referrerEmail}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[Referral] Failed to send credit email:`, err);
    res.status(500).json({ error: String(err) });
  }
});
