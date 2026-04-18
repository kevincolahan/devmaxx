import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function daysAt10UTC(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(10, 0, 0, 0);
  return d;
}

function daysAt11UTC(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(11, 0, 0, 0);
  return d;
}

async function seed() {
  const creator = await db.creator.findFirst({
    where: { email: 'kevin@devmaxx.app' },
  });

  if (!creator) {
    const fallback = await db.creator.findFirst();
    if (!fallback) {
      console.log('No creator found in DB');
      process.exit(1);
    }
    console.log(`kevin@devmaxx.app not found, using fallback: ${fallback.email}`);
  }

  const creatorId = creator?.id ?? (await db.creator.findFirst())!.id;

  const posts = [
    // ─── TWITTER ───────────────────────────────────────────
    {
      type: 'social_post',
      platform: 'x',
      status: 'approved',
      creatorId,
      createdAt: hoursFromNow(2),
      content: `just shipped a Discord bot for Roblox creators

/devmaxx status → game health score, DAU, last agent run
/devmaxx brief → your weekly growth summary
/devmaxx alerts → DAU drop notifications

add it to your server: devmaxx.app/discord`,
    },
    {
      type: 'social_post',
      platform: 'x',
      status: 'approved',
      creatorId,
      createdAt: daysAt10UTC(1),
      content: `Roblox creators spend hours checking analytics manually

built something that just tells you what changed and what to do about it — straight to your Discord

devmaxx.app/discord`,
    },
    {
      type: 'social_post',
      platform: 'x',
      status: 'approved',
      creatorId,
      createdAt: daysAt10UTC(2),
      content: `most Roblox devs have never looked at their D7 retention

that one number tells you more about your game's future than DAU ever will

free benchmark tool: devmaxx.app/retention-calculator`,
    },
    {
      type: 'social_post',
      platform: 'x',
      status: 'approved',
      creatorId,
      createdAt: daysAt10UTC(3),
      content: `hot take: DAU is a vanity metric

a game with 500 DAU and 40% D7 retention will outperform a game with 5000 DAU and 8% retention every time`,
    },
    {
      type: 'social_post',
      platform: 'x',
      status: 'approved',
      creatorId,
      createdAt: daysAt10UTC(4),
      content: `the top 50 Roblox games by concurrent players and estimated monthly DevEx — updated daily

Adopt Me: 572K players, ~$30K/month
Brookhaven: 362K players, ~$19K/month
Blox Fruits: 250K players, ~$13K/month

devmaxx.app/leaderboard`,
    },
    {
      type: 'social_post',
      platform: 'x',
      status: 'approved',
      creatorId,
      createdAt: daysAt10UTC(5),
      content: `a creator went from $300/month to $2,100/month by doing one thing: raising the price of their most popular game pass by 40%

nobody complained`,
    },
    {
      type: 'social_post',
      platform: 'x',
      status: 'approved',
      creatorId,
      createdAt: daysAt10UTC(6),
      content: `built a free DevEx calculator for Roblox creators

enter your DAU and pricing — see exactly what you're leaving on the table

devmaxx.app/devex-calculator`,
    },

    // ─── LINKEDIN ──────────────────────────────────────────
    {
      type: 'social_post',
      platform: 'linkedin',
      status: 'approved',
      creatorId,
      createdAt: hoursFromNow(3),
      content: `Just shipped something I've wanted to build for a while.

Roblox game creators live in Discord. Their analytics don't.

The Devmaxx Discord bot fixes that. Connect your game once and get:
- Game health score on demand
- Weekly GrowthBrief delivered to your server
- Automatic alerts when DAU drops or a competitor surges

/devmaxx status. /devmaxx brief. /devmaxx alerts.

Built for solo creators who don't have time to check five dashboards. The bot handles it.

devmaxx.app/discord`,
    },
    {
      type: 'social_post',
      platform: 'linkedin',
      status: 'approved',
      creatorId,
      createdAt: daysAt11UTC(3),
      content: `Most Roblox developers treat their game like a hobby.

The ones making real DevEx treat it like a business.

The difference isn't talent or luck. It's tracking the right metrics and acting on them consistently.

D7 retention. Price elasticity. Competitor movement.

That's what separates $300/month from $3,000/month.

Built Devmaxx to automate all of it. devmaxx.app`,
    },
    {
      type: 'social_post',
      platform: 'linkedin',
      status: 'approved',
      creatorId,
      createdAt: daysAt11UTC(6),
      content: `The Roblox creator economy paid out over $1 billion last year.

Most of that went to the top 1% of games.

The gap isn't quality — it's optimization. The top games A/B test prices, track retention daily, and watch competitors constantly.

Built AI agents to do all of that automatically for the other 99%.

devmaxx.app`,
    },
  ];

  console.log(`Seeding ${posts.length} content pieces for creator ${creatorId}...\n`);

  for (const post of posts) {
    const created = await db.contentPiece.create({ data: post });
    const dateLabel = new Date(post.createdAt).toISOString().split('T')[0];
    const timeLabel = new Date(post.createdAt).toISOString().split('T')[1].slice(0, 5);
    console.log(`  [${post.platform}] ${dateLabel} ${timeLabel} UTC — "${post.content.slice(0, 50)}..." (${created.id})`);
  }

  console.log(`\nDone. ${posts.length} posts seeded with status "approved".`);
  await db.$disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
