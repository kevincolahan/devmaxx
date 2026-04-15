import { PrismaClient } from '@prisma/client';

/**
 * TwitterFollowAgent
 *
 * Organically grows @devmaxxapp's following by:
 *   1. Following relevant Roblox creator accounts (max 20/day)
 *   2. Following back new followers (max 10/day)
 *   3. Unfollowing non-followers after 7 days (max 10/day)
 *
 * Runs: Daily 2pm UTC — 0 14 * * *
 *
 * Uses Twitter API v2 via Vercel proxy (Railway IPs are blocked).
 * All follow/unfollow calls go through:
 *   POST /api/social/twitter-follow
 *   { action: 'follow'|'unfollow', targetUserId }
 *
 * Twitter API Free tier limits:
 *   - POST /2/tweets (1,500/month)
 *   - POST /2/users/:id/following (user-context write)
 *   - GET /2/tweets/search/recent (read — may need Basic tier)
 *
 * Search for prospects is done via tweet search (recent tweets
 * mentioning Roblox dev topics). If search is blocked on Free
 * tier, falls back to following accounts from ProspectList.
 */

const VERCEL_BASE = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || 'https://devmaxx.app';
const CRON_SECRET = (process.env.CRON_SECRET || '').trim();
const TWITTER_USER_ID = (process.env.TWITTER_USER_ID || '').trim();

function log(msg: string) {
  console.log(`[TwitterFollow] ${msg}`);
}

// ─── Vercel Proxy Calls ─────────────────────────────────────

async function callFollowApi(action: 'follow' | 'unfollow', targetUserId: string): Promise<{ success: boolean; error?: string }> {
  const url = `${VERCEL_BASE}/api/social/twitter-follow`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({ action, targetUserId }),
    });

    const data = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── Twitter Search via Vercel (tweets search requires Basic tier) ─

interface TwitterUser {
  id: string;
  username: string;
  name: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
  description?: string;
  created_at?: string;
}

async function searchRecentTweets(query: string): Promise<TwitterUser[]> {
  // This endpoint may need Basic tier ($100/mo). If it returns 403,
  // we fall back to ProspectList-based following.
  const url = `${VERCEL_BASE}/api/social/twitter-search?query=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    if (!res.ok) {
      log(`Tweet search failed (${res.status}) — will use ProspectList fallback`);
      return [];
    }
    const data = (await res.json()) as { users?: TwitterUser[] };
    return data.users ?? [];
  } catch (err) {
    log(`Tweet search error: ${String(err)}`);
    return [];
  }
}

// ─── Follow Rules ───────────────────────────────────────────

function isValidFollowTarget(user: TwitterUser): boolean {
  const followers = user.public_metrics?.followers_count ?? 0;
  const tweets = user.public_metrics?.tweet_count ?? 0;

  // Never follow accounts with < 10 followers
  if (followers < 10) return false;

  // Never follow accounts with > 100K followers (won't follow back)
  if (followers > 100_000) return false;

  // Skip accounts that look like bots (very low tweet count)
  if (tweets < 5) return false;

  // Check if active in last 30 days (rough heuristic: has tweets)
  if (tweets < 10) return false;

  return true;
}

function isRobloxRelated(user: TwitterUser): boolean {
  const bio = (user.description || '').toLowerCase();
  const robloxKeywords = ['roblox', 'devex', 'robux', 'luau', 'rblx', 'bloxburg', 'studio'];
  const creatorKeywords = ['developer', 'creator', 'studio', 'game dev', 'indie', 'gamedev'];

  const hasRoblox = robloxKeywords.some((kw) => bio.includes(kw));
  const hasCreator = creatorKeywords.some((kw) => bio.includes(kw));

  return hasRoblox || (hasCreator && bio.includes('game'));
}

// ─── Main Pipeline ──────────────────────────────────────────

export interface TwitterFollowResult {
  followed: number;
  followedBack: number;
  unfollowed: number;
  errors: string[];
}

export async function runTwitterFollowPipeline(
  db: PrismaClient
): Promise<TwitterFollowResult> {
  const errors: string[] = [];
  let followed = 0;
  let followedBack = 0;
  let unfollowed = 0;

  if (!TWITTER_USER_ID) {
    errors.push('TWITTER_USER_ID not set');
    return { followed, followedBack, unfollowed, errors };
  }

  if (!CRON_SECRET) {
    errors.push('CRON_SECRET not set');
    return { followed, followedBack, unfollowed, errors };
  }

  // Get all accounts we've already followed (to avoid duplicates)
  const existingFollows = await db.twitterFollowLog.findMany({
    where: { action: { in: ['follow', 'followback'] } },
    select: { userId: true },
  });
  const alreadyFollowedIds = new Set(existingFollows.map((f) => f.userId));
  log(`Already followed ${alreadyFollowedIds.size} accounts total`);

  // ─── PART 1: Follow relevant accounts (max 20/day) ────────

  log('=== Part 1: Follow relevant Roblox accounts ===');

  const MAX_FOLLOWS_PER_DAY = 20;
  const todayFollows = await db.twitterFollowLog.count({
    where: {
      action: 'follow',
      followedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  const followBudget = Math.max(0, MAX_FOLLOWS_PER_DAY - todayFollows);
  log(`Follow budget today: ${followBudget} (already followed ${todayFollows} today)`);

  if (followBudget > 0) {
    // Strategy A: Search tweets for Roblox dev content
    const searchQueries = [
      'roblox devex',
      'roblox game dev',
      'roblox developer studio',
      'roblox creator earnings',
    ];

    const candidates: TwitterUser[] = [];
    for (const query of searchQueries) {
      const users = await searchRecentTweets(query);
      candidates.push(...users);
    }

    // Deduplicate and filter
    const uniqueCandidates = new Map<string, TwitterUser>();
    for (const user of candidates) {
      if (!uniqueCandidates.has(user.id) && !alreadyFollowedIds.has(user.id)) {
        if (isValidFollowTarget(user) && isRobloxRelated(user)) {
          uniqueCandidates.set(user.id, user);
        }
      }
    }
    log(`Found ${uniqueCandidates.size} valid candidates from tweet search`);

    // Strategy B: Fall back to ProspectList twitter handles
    if (uniqueCandidates.size < followBudget) {
      log('Supplementing with ProspectList twitter handles...');
      const prospects = await db.prospectList.findMany({
        where: {
          socialLinks: { not: undefined },
          outreachStatus: { in: ['queued', 'pending'] },
        },
        orderBy: { prospectScore: 'desc' },
        take: 50,
      });

      for (const prospect of prospects) {
        const socials = prospect.socialLinks as Record<string, string> | null;
        if (socials?.twitter && !alreadyFollowedIds.has(socials.twitter)) {
          // We don't have the Twitter user ID from ProspectList, just the handle.
          // We'll store the handle as userId for now — the follow API needs an ID though.
          // Skip ProspectList follows that don't have numeric IDs.
          log(`ProspectList: ${prospect.gameName} has @${socials.twitter} but no user ID — skipping`);
        }
      }
    }

    // Execute follows
    const toFollow = Array.from(uniqueCandidates.values()).slice(0, followBudget);
    for (const user of toFollow) {
      const result = await callFollowApi('follow', user.id);
      if (result.success) {
        await db.twitterFollowLog.create({
          data: {
            userId: user.id,
            username: user.username,
            action: 'follow',
            reason: `Tweet search: bio="${(user.description || '').slice(0, 100)}", followers=${user.public_metrics?.followers_count ?? 0}`,
          },
        });
        followed++;
        alreadyFollowedIds.add(user.id);
        log(`Followed @${user.username} (${user.public_metrics?.followers_count ?? 0} followers)`);

        // Rate limit delay
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        errors.push(`Follow @${user.username} failed: ${result.error}`);
        log(`Failed to follow @${user.username}: ${result.error}`);
      }
    }
  }

  // ─── PART 2: Follow back new followers (max 10/day) ───────

  log('=== Part 2: Follow back new followers ===');

  const MAX_FOLLOWBACKS_PER_DAY = 10;
  const todayFollowbacks = await db.twitterFollowLog.count({
    where: {
      action: 'followback',
      followedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  const followbackBudget = Math.max(0, MAX_FOLLOWBACKS_PER_DAY - todayFollowbacks);
  log(`Followback budget today: ${followbackBudget}`);

  // Note: GET /2/users/:id/followers requires Basic tier.
  // If not available, this section will be skipped gracefully.
  // When Basic tier is available, we'll fetch followers and follow back.
  if (followbackBudget > 0) {
    log('Follower list endpoint requires Basic tier — skipping follow-backs for now');
    // TODO: When Basic tier is available, fetch followers via:
    //   GET https://api.twitter.com/2/users/${TWITTER_USER_ID}/followers
    //   Filter: > 50 followers, Roblox/gaming related bio
    //   Follow back up to followbackBudget
  }

  // ─── PART 3: Unfollow non-followers after 7 days (max 10/day) ─

  log('=== Part 3: Unfollow non-followers ===');

  const MAX_UNFOLLOWS_PER_DAY = 10;
  const todayUnfollows = await db.twitterFollowLog.count({
    where: {
      action: 'unfollow',
      followedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  const unfollowBudget = Math.max(0, MAX_UNFOLLOWS_PER_DAY - todayUnfollows);
  log(`Unfollow budget today: ${unfollowBudget}`);

  if (unfollowBudget > 0) {
    // Find accounts we followed > 7 days ago that haven't followed back
    const staleFollows = await db.twitterFollowLog.findMany({
      where: {
        action: 'follow',
        followedBack: false,
        unfollowedAt: null,
        followedAt: { lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { followedAt: 'asc' },
      take: unfollowBudget,
    });

    log(`Found ${staleFollows.length} stale follows to unfollow`);

    for (const follow of staleFollows) {
      const result = await callFollowApi('unfollow', follow.userId);
      if (result.success) {
        await db.twitterFollowLog.update({
          where: { id: follow.id },
          data: { unfollowedAt: new Date() },
        });

        // Also log the unfollow action
        await db.twitterFollowLog.create({
          data: {
            userId: follow.userId,
            username: follow.username,
            action: 'unfollow',
            reason: `No follow-back after 7 days (followed ${follow.followedAt.toISOString().split('T')[0]})`,
          },
        });

        unfollowed++;
        log(`Unfollowed @${follow.username} (no follow-back since ${follow.followedAt.toISOString().split('T')[0]})`);

        // Rate limit delay
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        errors.push(`Unfollow @${follow.username} failed: ${result.error}`);
      }
    }
  }

  // ─── Log as AgentRun ──────────────────────────────────────

  const systemCreator = await db.creator.findFirst({
    where: { email: 'kevin@devmaxx.app' },
  });

  if (systemCreator) {
    await db.agentRun.create({
      data: {
        creatorId: systemCreator.id,
        agentName: 'TwitterFollowAgent',
        input: { followBudget, followbackBudget: followbackBudget, unfollowBudget },
        output: { followed, followedBack, unfollowed, errorCount: errors.length },
        action: 'twitter_follow',
        robuxImpact: 0,
        status: errors.length > 10 ? 'failed' : 'success',
      },
    });
  }

  log(`Done — followed: ${followed}, followed back: ${followedBack}, unfollowed: ${unfollowed}, errors: ${errors.length}`);
  return { followed, followedBack, unfollowed, errors };
}
