import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

/**
 * LinkedInGrowthAgent
 *
 * Organically grows Kevin Colahan's LinkedIn presence by engaging
 * with relevant content in the Roblox creator and gaming space.
 *
 * Runs: Daily 3pm UTC — 0 15 * * *
 *
 * Strategy:
 *   1. Comment on relevant posts (max 5/day) — Claude drafts as Kevin
 *   2. Like relevant posts (max 20/day)
 *   3. Connection requests (max 5/day, skip if 403)
 *
 * All LinkedIn API calls routed through Vercel proxy at:
 *   POST /api/social/linkedin-engage
 *   { action: 'like'|'comment'|'connect', ... }
 *
 * LinkedIn w_member_social scope allows likes + comments.
 * Connection requests may need additional approval — gracefully skipped.
 */

const VERCEL_BASE = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || 'https://devmaxx.app';
const CRON_SECRET = (process.env.CRON_SECRET || '').trim();
const LINKEDIN_ACCESS_TOKEN = (process.env.LINKEDIN_ACCESS_TOKEN || '').trim();

function log(msg: string) {
  console.log(`[LinkedInGrowth] ${msg}`);
}

// ─── Vercel Proxy Call ──────────────────────────────────────

async function callLinkedInEngage(body: Record<string, unknown>): Promise<{ success: boolean; error?: string; data?: Record<string, unknown> }> {
  const url = `${VERCEL_BASE}/api/social/linkedin-engage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return { success: false, error: (data.error as string) || `HTTP ${res.status}` };
    }
    return { success: true, data };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── LinkedIn Feed Search ───────────────────────────────────

interface LinkedInPost {
  urn: string;
  authorUrn: string;
  authorName: string;
  text: string;
}

async function searchLinkedInFeed(): Promise<LinkedInPost[]> {
  // LinkedIn API doesn't have a public hashtag search on Community scope.
  // Use the feed API to get recent posts from connections/network.
  // If feed endpoint isn't available, use organization posts as fallback.

  if (!LINKEDIN_ACCESS_TOKEN) return [];

  const posts: LinkedInPost[] = [];

  // Try fetching own feed/network posts
  try {
    const res = await fetch('https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List()&count=50', {
      headers: {
        'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    if (res.ok) {
      const data = (await res.json()) as {
        elements?: Array<{
          id?: string;
          author?: string;
          specificContent?: {
            'com.linkedin.ugc.ShareContent'?: {
              shareCommentary?: { text?: string };
            };
          };
        }>;
      };

      for (const el of data.elements ?? []) {
        const text = el.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text;
        if (text && el.id) {
          posts.push({
            urn: el.id,
            authorUrn: el.author || '',
            authorName: '',
            text,
          });
        }
      }
      log(`Feed search returned ${posts.length} posts`);
    } else {
      const body = await res.text();
      log(`Feed search failed (${res.status}): ${body.slice(0, 200)}`);
    }
  } catch (err) {
    log(`Feed search threw: ${String(err)}`);
  }

  return posts;
}

// ─── Claude Comment Drafting ────────────────────────────────

async function scoreAndDraftComment(postText: string): Promise<{ score: number; comment: string | null }> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20251001',
    max_tokens: 512,
    system: `You are Kevin Colahan, founder of Devmaxx (devmaxx.app), an AI platform for Roblox game creators.

Your task: Read a LinkedIn post and decide if it's relevant to engage with, then draft a comment.

Step 1 — Score relevance 1-10:
- 10: Directly about Roblox creator economy, DevEx, game monetization
- 7-9: About game development, creator economy, indie games, gaming industry
- 4-6: Tangentially related (tech startups, SaaS, AI in gaming)
- 1-3: Not relevant at all

Step 2 — If score >= 7, draft a comment:
- First sentence: Add genuine value to the discussion (insight, experience, question)
- Second sentence: Can naturally mention Devmaxx ONLY if truly relevant, otherwise skip
- Max 3 sentences total
- Sound like a founder who knows Roblox deeply, not a marketer
- Never be spammy or salesy
- Never use buzzwords or generic encouragement

Respond in JSON format:
{ "score": 8, "comment": "Your comment here" }
If score < 7:
{ "score": 3, "comment": null }`,
    messages: [
      {
        role: 'user',
        content: `LinkedIn post:\n\n${postText.slice(0, 1500)}`,
      },
    ],
  });

  const text = response.content[0];
  if (text.type !== 'text') return { score: 0, comment: null };

  try {
    const parsed = JSON.parse(text.text) as { score: number; comment: string | null };
    return { score: parsed.score ?? 0, comment: parsed.comment ?? null };
  } catch {
    // Try to extract score from text
    log(`Failed to parse Claude response: ${text.text.slice(0, 100)}`);
    return { score: 0, comment: null };
  }
}

// ─── Keyword Matching for Likes ─────────────────────────────

const LIKE_KEYWORDS = [
  'roblox', 'devex', 'robux', 'game dev', 'gamedev', 'game development',
  'indie game', 'indie dev', 'creator economy', 'game monetization',
  'game studio', 'roblox developer', 'roblox creator', 'gaming creator',
  'game pass', 'luau', 'roblox studio',
];

function isLikeWorthy(text: string): boolean {
  const lower = text.toLowerCase();
  return LIKE_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Main Pipeline ──────────────────────────────────────────

export interface LinkedInGrowthResult {
  commentsPosted: number;
  likesGiven: number;
  connectionsSent: number;
  postsScanned: number;
  errors: string[];
}

export async function runLinkedInGrowthPipeline(
  db: PrismaClient
): Promise<LinkedInGrowthResult> {
  const errors: string[] = [];
  let commentsPosted = 0;
  let likesGiven = 0;
  let connectionsSent = 0;
  let postsScanned = 0;

  if (!LINKEDIN_ACCESS_TOKEN) {
    errors.push('LINKEDIN_ACCESS_TOKEN not set');
    return { commentsPosted, likesGiven, connectionsSent, postsScanned, errors };
  }

  if (!CRON_SECRET) {
    errors.push('CRON_SECRET not set');
    return { commentsPosted, likesGiven, connectionsSent, postsScanned, errors };
  }

  // Get already-engaged post URNs (don't double-engage)
  const recentLogs = await db.linkedInGrowthLog.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    select: { postId: true, profileId: true, action: true },
  });
  const engagedPostIds = new Set(recentLogs.filter((l) => l.postId).map((l) => l.postId!));
  const commentedAuthorIds = new Set(
    recentLogs.filter((l) => l.action === 'comment').map((l) => l.profileId)
  );

  // Count today's actions
  const todayStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayLogs = recentLogs.filter((l) => new Date() > todayStart);
  const todayComments = todayLogs.filter((l) => l.action === 'comment').length;
  const todayLikes = todayLogs.filter((l) => l.action === 'like').length;

  const MAX_COMMENTS = 5;
  const MAX_LIKES = 20;
  const commentBudget = Math.max(0, MAX_COMMENTS - todayComments);
  const likeBudget = Math.max(0, MAX_LIKES - todayLikes);

  log(`Budgets — comments: ${commentBudget}, likes: ${likeBudget}`);

  // ─── Fetch posts from feed ────────────────────────────────

  log('=== Searching LinkedIn feed ===');
  const posts = await searchLinkedInFeed();
  postsScanned = posts.length;

  if (posts.length === 0) {
    log('No posts found from feed — pipeline complete');
  }

  // ─── PART 1: Comment on relevant posts (max 5/day) ────────

  log('=== Part 1: Comment on relevant posts ===');
  let commentsAttempted = 0;

  for (const post of posts) {
    if (commentsAttempted >= commentBudget) break;
    if (engagedPostIds.has(post.urn)) continue;
    if (commentedAuthorIds.has(post.authorUrn)) continue;

    try {
      const { score, comment } = await scoreAndDraftComment(post.text);
      log(`Post ${post.urn.slice(-10)}: score=${score}`);

      if (score >= 7 && comment) {
        const result = await callLinkedInEngage({
          action: 'comment',
          postUrn: post.urn,
          commentText: comment,
        });

        if (result.success) {
          await db.linkedInGrowthLog.create({
            data: {
              profileId: post.authorUrn,
              profileName: post.authorName || post.authorUrn.split(':').pop() || '',
              action: 'comment',
              postId: post.urn,
              commentDrafted: comment,
              actionTaken: true,
              actionAt: new Date(),
            },
          });
          commentsPosted++;
          commentsAttempted++;
          engagedPostIds.add(post.urn);
          commentedAuthorIds.add(post.authorUrn);
          log(`Commented on ${post.urn}: "${comment.slice(0, 80)}..."`);

          await new Promise((r) => setTimeout(r, 3000));
        } else {
          errors.push(`Comment on ${post.urn} failed: ${result.error}`);
          log(`Comment failed: ${result.error}`);
        }
      }
    } catch (err) {
      errors.push(`Score/comment ${post.urn} failed: ${String(err)}`);
    }
  }

  // ─── PART 2: Like relevant posts (max 20/day) ─────────────

  log('=== Part 2: Like relevant posts ===');
  let likesAttempted = 0;

  for (const post of posts) {
    if (likesAttempted >= likeBudget) break;
    if (engagedPostIds.has(post.urn)) continue;

    if (!isLikeWorthy(post.text)) continue;

    const result = await callLinkedInEngage({
      action: 'like',
      postUrn: post.urn,
    });

    if (result.success) {
      await db.linkedInGrowthLog.create({
        data: {
          profileId: post.authorUrn,
          profileName: post.authorName || post.authorUrn.split(':').pop() || '',
          action: 'like',
          postId: post.urn,
          actionTaken: true,
          actionAt: new Date(),
        },
      });
      likesGiven++;
      likesAttempted++;
      engagedPostIds.add(post.urn);
      log(`Liked ${post.urn}`);

      await new Promise((r) => setTimeout(r, 1000));
    } else {
      errors.push(`Like ${post.urn} failed: ${result.error}`);
      // If we get 403, token doesn't support this — stop trying
      if (result.error?.includes('403')) {
        log('Like returned 403 — stopping likes');
        break;
      }
    }
  }

  // ─── PART 3: Connection requests (max 5/day, skip if 403) ─

  log('=== Part 3: Connection requests (skipped — needs API approval) ===');
  // LinkedIn connection request API requires additional scope approval.
  // We log this as a placeholder. When approved, uncomment the logic below.
  //
  // const MAX_CONNECTS = 5;
  // const todayConnects = todayLogs.filter((l) => l.action === 'connect').length;
  // const connectBudget = Math.max(0, MAX_CONNECTS - todayConnects);
  //
  // For each prospect with LinkedIn profile:
  //   callLinkedInEngage({ action: 'connect', targetPersonUrn, connectionMessage })
  //   If 403: break and log "needs scope approval"

  // ─── Log as AgentRun ──────────────────────────────────────

  const systemCreator = await db.creator.findFirst({
    where: { email: 'kevin@devmaxx.app' },
  });

  if (systemCreator) {
    await db.agentRun.create({
      data: {
        creatorId: systemCreator.id,
        agentName: 'LinkedInGrowthAgent',
        input: { commentBudget, likeBudget, postsScanned },
        output: { commentsPosted, likesGiven, connectionsSent, errorCount: errors.length },
        action: 'linkedin_growth',
        robuxImpact: 0,
        status: errors.length > 10 ? 'failed' : 'success',
      },
    });
  }

  log(`Done — comments: ${commentsPosted}, likes: ${likesGiven}, connections: ${connectionsSent}, errors: ${errors.length}`);
  return { commentsPosted, likesGiven, connectionsSent, postsScanned, errors };
}
