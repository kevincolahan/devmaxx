import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function seed() {
  const creator = await db.creator.findFirst();
  if (!creator) { console.log('No creator found'); return; }

  const posts = [
    // X posts
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'Roblox paid $1B+ to creators last year. Most left 20-40% on the table with unoptimized pricing. Devmaxx fixes that automatically. devmaxx.app',
      creatorId: creator.id
    },
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'Your Roblox game is a business. Treat it like one. Devmaxx gives you a weekly brief — DAU trends, revenue analysis, pricing wins. Free to start. devmaxx.app',
      creatorId: creator.id
    },
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'The difference between $500/month and $5,000/month on Roblox is usually knowing which items to price higher. Devmaxx finds that automatically. devmaxx.app',
      creatorId: creator.id
    },
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'Games using A/B price testing earn 23% more DevEx on average. Devmaxx runs those tests automatically every week. Free tier available. devmaxx.app',
      creatorId: creator.id
    },
    {
      type: 'social_post', platform: 'x', status: 'approved',
      content: 'Most Roblox devs check analytics once a month. Devmaxx checks daily and tells you exactly what changed and why. Free tier available. devmaxx.app',
      creatorId: creator.id
    },
    // LinkedIn posts
    {
      type: 'social_post', platform: 'linkedin', status: 'approved',
      content: `The Roblox creator economy just hit a milestone most people missed.\n\nRoblox paid out over $1 billion to creators through DevEx last year — a 31% increase year over year. That's real money flowing to independent developers building games on a platform with 88 million daily active users.\n\nBut here's what the headline doesn't show: the vast majority of monetizing creators are leaving significant revenue on the table. Unoptimized item pricing, no A/B testing, manual analytics checks, and zero competitor awareness are the norm — not the exception.\n\nThe tools these creators need don't exist inside Roblox. They've never existed. Until now.\n\nDevmaxx is an AI-powered business operations platform built specifically for Roblox creators. Autonomous agents handle pricing optimization, player support, competitor tracking, and weekly business briefs — automatically.\n\nCreators focus on building great games. Devmaxx handles the business.\n\nIf you know a Roblox developer who should be earning more from their game, send them to devmaxx.app.\n\nWhat do you think is the biggest gap in creator economy tooling right now?`,
      creatorId: creator.id
    },
    {
      type: 'social_post', platform: 'linkedin', status: 'approved',
      content: `Roblox is the most underrated creator economy platform in 2026. Here's why.\n\n88 million daily active users. $1 billion paid to creators annually. A 17-year-old platform that is somehow still growing faster than most social networks.\n\nAnd yet when you ask most people in tech about the creator economy, they mention YouTube, TikTok, Substack. Rarely Roblox.\n\nThe difference: Roblox creators don't have personal brands. They have games. And games are businesses — businesses with DAU metrics, retention cohorts, item catalogs, pricing strategies, and player support queues.\n\nThe creator economy conversation has focused entirely on content creators. The game creator economy is a completely different animal — and it's larger, more durable, and significantly more underserved by tooling.\n\nThat's exactly the gap Devmaxx is built to fill. AI-powered business operations for Roblox game creators — the operators who need a business layer on top of their creative layer.\n\ndevmaxx.app\n\nAre you paying attention to the game creator economy?`,
      creatorId: creator.id
    },
    {
      type: 'social_post', platform: 'linkedin', status: 'approved',
      content: `What separates top-earning Roblox creators from everyone else? After analyzing creator data, five behaviors stand out.\n\n1. They test prices constantly. Top creators run A/B tests on item pricing continuously. They know that a 25% price increase on a high-demand item can double revenue without affecting conversion. Most creators set a price once and never touch it.\n\n2. They watch competitors daily. Top creators know when a competing game surges or drops in player count — and they capitalize immediately with events or updates. Most creators have no visibility into their competitive landscape.\n\n3. They track D7 retention obsessively. Daily active users is a vanity metric. D7 retention — how many players return after 7 days — is the real signal. Top creators optimize for this above everything else.\n\n4. They respond to player support fast. Games with sub-24-hour support response times retain significantly more players. Top creators treat player support as a revenue function, not a nuisance.\n\n5. They ship on a schedule. Weekly updates, bi-weekly events, monthly major releases. Consistency drives algorithmic visibility on Roblox and keeps the player base engaged between sessions.\n\nDevmaxx automates all five of these for creators who don't have a full team behind them.\n\ndevmaxx.app`,
      creatorId: creator.id
    },
    // Instagram posts
    {
      type: 'social_post', platform: 'instagram', status: 'approved',
      content: 'Roblox paid $1B+ to creators last year. Most left 20-40% on the table. Devmaxx fixes that automatically. Free to start → devmaxx.app',
      creatorId: creator.id
    },
    {
      type: 'social_post', platform: 'instagram', status: 'approved',
      content: 'The difference between $500/month and $5,000/month on Roblox is knowing which items to price higher. Devmaxx finds that automatically. devmaxx.app',
      creatorId: creator.id
    },
  ];

  for (const post of posts) {
    await db.contentPiece.create({ data: post });
  }

  console.log(`Seeded ${posts.length} content pieces`);
  await db.$disconnect();
}

seed().catch(console.error);
