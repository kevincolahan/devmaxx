import { Resend } from 'resend';
import { PrismaClient } from '@prisma/client';

const FROM = process.env.FROM_EMAIL ?? 'onboarding@resend.dev';

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">

<div style="text-align:center;margin-bottom:32px;">
  <h1 style="font-size:28px;font-weight:700;margin:0;color:#fff;">Devmaxx</h1>
  <p style="color:#6366f1;margin:4px 0 0;font-size:14px;">Maxx your DevEx</p>
</div>

${content}

<div style="text-align:center;color:#4b5563;font-size:11px;margin-top:40px;padding-top:24px;border-top:1px solid #1f2937;">
  <p>You're receiving this because you signed up at devmaxx.app</p>
  <p><a href="https://devmaxx.app/settings/notifications" style="color:#6366f1;">Manage preferences</a></p>
  <p>Devmaxx &middot; devmaxx.app</p>
</div>

</div>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  return `<div style="text-align:center;margin:24px 0;">
  <a href="${url}" style="display:inline-block;background:#059669;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${text}</a>
</div>`;
}

function section(title: string, body: string): string {
  return `<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:24px;margin-bottom:16px;">
  <h2 style="font-size:14px;color:#6366f1;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">${title}</h2>
  ${body}
</div>`;
}

// ─── Email 1: Welcome (immediate) ───────────────────────────

export function buildWelcomeEmail(): { subject: string; html: string } {
  return {
    subject: "Welcome to Devmaxx \u2014 here's how to get started",
    html: emailWrapper(`
${section('Welcome to Devmaxx', `
  <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0;">
    You just joined the platform that helps Roblox creators maximize their DevEx earnings. Autonomous AI agents will monitor your game, optimize pricing, track competitors, and send you weekly growth briefs \u2014 all automatically.
  </p>
  <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:16px 0 0;">
    Here's how to get started in 5 minutes:
  </p>
`)}

${section('Connect Your Game', `
  <div style="margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="background:#059669;color:#fff;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;">1</span>
      <span style="color:#f9fafb;font-weight:600;">Go to create.roblox.com \u2192 API Keys</span>
    </div>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 0 32px;">Open the Roblox Creator Hub and navigate to the API Keys section.</p>
  </div>
  <div style="margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="background:#059669;color:#fff;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;">2</span>
      <span style="color:#f9fafb;font-weight:600;">Create an API key</span>
    </div>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 0 32px;">Enable scopes: <code style="background:#1f2937;padding:2px 6px;border-radius:4px;">universe:read</code> and <code style="background:#1f2937;padding:2px 6px;border-radius:4px;">universe-places:read</code></p>
  </div>
  <div style="margin-bottom:0;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="background:#059669;color:#fff;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;">3</span>
      <span style="color:#f9fafb;font-weight:600;">Enter your Universe ID + API key at Devmaxx</span>
    </div>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 0 32px;">Paste them in the onboarding flow and you're done.</p>
  </div>
`)}

${section('What Happens Next', `
  <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0;">
    Once you connect your game, agents start running immediately:
  </p>
  <ul style="color:#9ca3af;font-size:14px;line-height:1.8;margin:12px 0 0;padding-left:20px;">
    <li>MetricsMonitor checks your DAU, retention, and revenue daily</li>
    <li>CompetitorIntel starts tracking rival games</li>
    <li>You'll get your first GrowthBrief this Sunday at 6pm</li>
  </ul>
`)}

${ctaButton('Connect Your Game \u2192', 'https://devmaxx.app/onboarding')}
    `),
  };
}

// ─── Email 2: Day 3 (your agents are running) ───────────────

export function buildDay3Email(hasConnected: boolean): { subject: string; html: string } {
  const connectedContent = `
  <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0;">
    Your game is connected and agents have been working for 3 days. Here's what they're doing right now:
  </p>
  <ul style="color:#9ca3af;font-size:14px;line-height:1.8;margin:12px 0 0;padding-left:20px;">
    <li><strong style="color:#f9fafb;">MetricsMonitor</strong> \u2014 Checking your DAU, retention cohorts, and revenue trends every morning at 6am UTC</li>
    <li><strong style="color:#f9fafb;">CompetitorIntel</strong> \u2014 Tracking player counts and ratings of games in your genre daily at 8am UTC</li>
    <li><strong style="color:#f9fafb;">PricingOptimizer</strong> \u2014 Analyzing your item catalog and preparing your first A/B price test for Monday</li>
  </ul>
  <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:16px 0 0;">
    Your first GrowthBrief arrives this Sunday at 6pm \u2014 a 90-second read with your week's data, trends, and recommended actions.
  </p>
  ${ctaButton('View Your Dashboard \u2192', 'https://devmaxx.app/dashboard')}
  <div style="text-align:center;margin-top:16px;">
    <p style="color:#9ca3af;font-size:13px;">Want autopilot mode? <a href="https://devmaxx.app/pricing" style="color:#6366f1;text-decoration:none;">Upgrade to Pro \u2192</a></p>
  </div>`;

  const notConnectedContent = `
  <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0;">
    You signed up 3 days ago, but your game isn't connected yet. Here's what you're missing:
  </p>
  <ul style="color:#9ca3af;font-size:14px;line-height:1.8;margin:12px 0 0;padding-left:20px;">
    <li><strong style="color:#f9fafb;">MetricsMonitor</strong> would be checking your DAU, retention, and revenue daily</li>
    <li><strong style="color:#f9fafb;">CompetitorIntel</strong> would be tracking rival games in your genre</li>
    <li><strong style="color:#f9fafb;">PricingOptimizer</strong> would be preparing your first A/B price test</li>
  </ul>
  <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:16px 0 0;">
    It takes 2 minutes to connect. Your first GrowthBrief can arrive this Sunday.
  </p>
  ${ctaButton('Connect Your Game \u2192', 'https://devmaxx.app/onboarding')}`;

  return {
    subject: "Your Devmaxx agents are running \u2014 here's what they're doing",
    html: emailWrapper(`
${section('Day 3 Update', hasConnected ? connectedContent : notConnectedContent)}
    `),
  };
}

// ─── Email 3: Day 7 (first week recap) ──────────────────────

export function buildDay7Email(
  hasConnected: boolean,
  stats: { agentRuns: number; robuxImpact: number }
): { subject: string; html: string } {
  const connectedContent = `
  <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0;">
    Your first week with Devmaxx is in the books. Here's what happened:
  </p>
  <div style="display:flex;gap:16px;margin:16px 0;">
    <div style="flex:1;background:#1f2937;border-radius:8px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:#fff;">${stats.agentRuns}</div>
      <div style="color:#9ca3af;font-size:12px;margin-top:4px;">Agent Runs</div>
    </div>
    <div style="flex:1;background:#1f2937;border-radius:8px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:#4ade80;">${stats.robuxImpact >= 0 ? '+' : ''}${stats.robuxImpact.toLocaleString()}</div>
      <div style="color:#9ca3af;font-size:12px;margin-top:4px;">Robux Impact</div>
    </div>
  </div>
  <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:16px 0 0;">
    This is just the beginning. Creators on the Pro plan see 3-5x more impact with autopilot mode, competitor tracking, and content generation.
  </p>
  ${ctaButton('Upgrade to Creator \u2014 $49/mo \u2192', 'https://devmaxx.app/pricing')}
  <p style="color:#6b7280;font-size:13px;text-align:center;margin-top:8px;">14-day free trial \u2014 cancel anytime</p>`;

  const notConnectedContent = `
  <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0;">
    It's been a week since you signed up, and your game still isn't connected. Here's the thing:
  </p>
  <div style="background:#1f2937;border-radius:8px;padding:20px;margin:16px 0;border-left:4px solid #f59e0b;">
    <p style="color:#fbbf24;font-size:15px;font-weight:600;margin:0;">Your competitors are using tools like this. You're not.</p>
    <p style="color:#9ca3af;font-size:14px;margin:8px 0 0;">
      Roblox paid $1B+ to creators last year. The top earners optimize pricing, track competitors, and analyze retention daily. Devmaxx automates all of that for you \u2014 for free.
    </p>
  </div>
  <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0;">
    Connect in 2 minutes. Get your first GrowthBrief this Sunday. See what you've been missing.
  </p>
  ${ctaButton('Connect Your Game Now \u2192', 'https://devmaxx.app/onboarding')}`;

  return {
    subject: 'Your first week with Devmaxx',
    html: emailWrapper(`
${section('Week 1 Recap', hasConnected ? connectedContent : notConnectedContent)}
    `),
  };
}

// ─── Send helpers ───────────────────────────────────────────

async function hasEmailBeenSent(db: PrismaClient, creatorId: string, emailNum: number): Promise<boolean> {
  const key = `onboarding_email_${creatorId}_${emailNum}`;
  const row = await db.keyValue.findUnique({ where: { key } });
  return !!row;
}

async function markEmailSent(db: PrismaClient, creatorId: string, emailNum: number): Promise<void> {
  const key = `onboarding_email_${creatorId}_${emailNum}`;
  await db.keyValue.upsert({
    where: { key },
    update: { value: new Date().toISOString() },
    create: { key, value: new Date().toISOString() },
  });
}

export async function sendWelcomeEmail(db: PrismaClient, creatorId: string, email: string): Promise<boolean> {
  if (await hasEmailBeenSent(db, creatorId, 1)) return false;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { subject, html } = buildWelcomeEmail();

  try {
    await resend.emails.send({ from: FROM, to: email, subject, html });
    await markEmailSent(db, creatorId, 1);
    console.log(`[Onboarding] Email 1 (welcome) sent to ${email}`);
    return true;
  } catch (err) {
    console.error(`[Onboarding] Failed to send welcome email to ${email}:`, err);
    return false;
  }
}

export async function sendDay3Email(db: PrismaClient, creatorId: string, email: string): Promise<boolean> {
  if (await hasEmailBeenSent(db, creatorId, 2)) return false;

  const creator = await db.creator.findUnique({ where: { id: creatorId } });
  const hasConnected = !!(creator?.robloxUserId || creator?.robloxApiKey);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { subject, html } = buildDay3Email(hasConnected);

  try {
    await resend.emails.send({ from: FROM, to: email, subject, html });
    await markEmailSent(db, creatorId, 2);
    console.log(`[Onboarding] Email 2 (day 3) sent to ${email} (connected: ${hasConnected})`);
    return true;
  } catch (err) {
    console.error(`[Onboarding] Failed to send day 3 email to ${email}:`, err);
    return false;
  }
}

export async function sendDay7Email(db: PrismaClient, creatorId: string, email: string): Promise<boolean> {
  if (await hasEmailBeenSent(db, creatorId, 3)) return false;

  const creator = await db.creator.findUnique({ where: { id: creatorId } });
  const hasConnected = !!(creator?.robloxUserId || creator?.robloxApiKey);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const agentRuns = await db.agentRun.count({
    where: { creatorId, createdAt: { gte: sevenDaysAgo } },
  });
  const robuxAgg = await db.agentRun.aggregate({
    where: { creatorId, createdAt: { gte: sevenDaysAgo } },
    _sum: { robuxImpact: true },
  });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { subject, html } = buildDay7Email(hasConnected, {
    agentRuns,
    robuxImpact: robuxAgg._sum.robuxImpact ?? 0,
  });

  try {
    await resend.emails.send({ from: FROM, to: email, subject, html });
    await markEmailSent(db, creatorId, 3);
    console.log(`[Onboarding] Email 3 (day 7) sent to ${email} (connected: ${hasConnected}, runs: ${agentRuns})`);
    return true;
  } catch (err) {
    console.error(`[Onboarding] Failed to send day 7 email to ${email}:`, err);
    return false;
  }
}

// ─── Cron runner: check and send day 3 + day 7 emails ───────

export async function runOnboardingEmails(db: PrismaClient): Promise<{ day3Sent: number; day7Sent: number }> {
  const now = new Date();
  let day3Sent = 0;
  let day7Sent = 0;

  // Day 3: creators who signed up 3 days ago (between 72-96 hours ago)
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

  const day3Creators = await db.creator.findMany({
    where: { createdAt: { gte: fourDaysAgo, lte: threeDaysAgo } },
  });

  for (const creator of day3Creators) {
    const sent = await sendDay3Email(db, creator.id, creator.email);
    if (sent) day3Sent++;
  }

  // Day 7: creators who signed up 7 days ago (between 168-192 hours ago)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

  const day7Creators = await db.creator.findMany({
    where: { createdAt: { gte: eightDaysAgo, lte: sevenDaysAgo } },
  });

  for (const creator of day7Creators) {
    const sent = await sendDay7Email(db, creator.id, creator.email);
    if (sent) day7Sent++;
  }

  return { day3Sent, day7Sent };
}
