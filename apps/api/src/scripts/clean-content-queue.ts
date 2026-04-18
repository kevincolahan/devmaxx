import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

// ─── Rewrites: match by content prefix → new content ────────

const REWRITES: Array<{ match: string; newContent: string }> = [
  {
    match: 'DevEx payments hit $741M',
    newContent: `DevEx hit $741M last year. Most of it went to the top 1% of games. The gap isn't talent — it's optimization. devmaxx.app`,
  },
  {
    match: 'Stop shipping Roblox updates blind',
    newContent: `Most Roblox devs ship an update and have no idea if it helped. Built something that tracks the before/after automatically. devmaxx.app`,
  },
  {
    match: '90% of Roblox devs ship updates blind',
    newContent: `Shipped an update last week and not sure if it helped? That's the default state for most Roblox creators. devmaxx.app/dashboard`,
  },
  {
    match: 'NEW: AI that reads ALL your player feedback',
    newContent: `Reading through every support ticket manually to find patterns is how most Roblox devs do it. Built something that does it automatically and surfaces what matters.`,
  },
];

// ─── Posts that are already clean — skip these ──────────────

const SKIP_PREFIXES = [
  'just shipped a Discord bot',
  'Roblox creators spend hours checking',
  'most Roblox devs have never looked at their D7',
  'hot take: DAU is a vanity metric',
  'a creator went from $300/month',
  'the top 50 Roblox games by concurrent',
  'built a free DevEx calculator',
  'Just shipped something I\'ve wanted to build',
  'Most Roblox developers treat their game like a hobby',
  'The Roblox creator economy paid out over $1 billion',
];

// ─── Patterns to clean ─────────────────────────────────────

const HASHTAG_REGEX = /#\w+/g;
const CORPORATE_PHRASES = [
  'unprecedented growth',
  'leveraging AI-powered analytics',
  'data-driven business',
  'key metrics',
  'optimize your',
  'game-changing',
  'revolutionary',
  'game changer',
  'cutting-edge',
  'next-level',
];

async function clean() {
  const allPosts = await db.contentPiece.findMany({
    where: { type: 'social_post' },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${allPosts.length} social posts total\n`);

  let updated = 0;
  let skipped = 0;
  let deleted = 0;

  // Step 1: Delete duplicate seeded posts (keep oldest of each unique content)
  const contentMap = new Map<string, typeof allPosts>();
  for (const post of allPosts) {
    const key = post.content.slice(0, 80).trim();
    const existing = contentMap.get(key);
    if (existing) {
      existing.push(post);
    } else {
      contentMap.set(key, [post]);
    }
  }

  for (const [key, dupes] of contentMap) {
    if (dupes.length > 1) {
      // Keep the oldest, delete the rest
      dupes.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      for (let i = 1; i < dupes.length; i++) {
        await db.contentPiece.delete({ where: { id: dupes[i].id } });
        deleted++;
        console.log(`  DELETED duplicate: "${key.slice(0, 50)}..." (${dupes[i].id})`);
      }
    }
  }

  if (deleted > 0) console.log(`\nDeleted ${deleted} duplicates\n`);

  // Re-fetch after dedup
  const posts = await db.contentPiece.findMany({
    where: { type: 'social_post' },
    orderBy: { createdAt: 'desc' },
  });

  for (const post of posts) {
    // Skip Instagram — different culture
    if (post.platform === 'instagram' || post.platform === 'tiktok') {
      console.log(`  SKIP (${post.platform}): "${post.content.slice(0, 50)}..."`);
      skipped++;
      continue;
    }

    // Skip already-published posts
    if (post.status === 'published') {
      console.log(`  SKIP (published): "${post.content.slice(0, 50)}..."`);
      skipped++;
      continue;
    }

    // Skip posts that are already in good voice
    const isClean = SKIP_PREFIXES.some((prefix) => post.content.startsWith(prefix));
    if (isClean) {
      console.log(`  SKIP (clean): "${post.content.slice(0, 50)}..."`);
      skipped++;
      continue;
    }

    // Check for specific rewrites
    let didRewrite = false;
    for (const rewrite of REWRITES) {
      if (post.content.includes(rewrite.match)) {
        await db.contentPiece.update({
          where: { id: post.id },
          data: { content: rewrite.newContent },
        });
        console.log(`  REWRITE [${post.platform}]: "${rewrite.match.slice(0, 40)}..." → "${rewrite.newContent.slice(0, 50)}..."`);
        updated++;
        didRewrite = true;
        break;
      }
    }
    if (didRewrite) continue;

    // Generic cleanup: hashtags, corporate language, exclamation marks
    let cleaned = post.content;
    const originalContent = cleaned;

    // Remove hashtags
    cleaned = cleaned.replace(HASHTAG_REGEX, '').replace(/\s{2,}/g, ' ').trim();

    // Remove corporate phrases
    for (const phrase of CORPORATE_PHRASES) {
      const regex = new RegExp(phrase, 'gi');
      cleaned = cleaned.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
    }

    // Remove exclamation marks (keep ? though)
    cleaned = cleaned.replace(/!/g, '.').replace(/\.\./g, '.').replace(/\. \./g, '.').trim();

    // Trim LinkedIn posts over 1000 chars
    if (post.platform === 'linkedin' && cleaned.length > 1000) {
      cleaned = cleaned.slice(0, 997) + '...';
    }

    if (cleaned !== originalContent) {
      await db.contentPiece.update({
        where: { id: post.id },
        data: { content: cleaned },
      });
      console.log(`  CLEANED [${post.platform}]: "${originalContent.slice(0, 40)}..." → "${cleaned.slice(0, 50)}..."`);
      updated++;
    } else {
      console.log(`  SKIP (no changes needed): "${post.content.slice(0, 50)}..."`);
      skipped++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Duplicates deleted: ${deleted}`);
  await db.$disconnect();
}

clean().catch((err) => {
  console.error('Clean failed:', err);
  process.exit(1);
});
