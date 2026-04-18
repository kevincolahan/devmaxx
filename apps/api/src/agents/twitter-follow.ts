import { PrismaClient } from '@prisma/client';

/**
 * TwitterFollowAgent
 *
 * Organically grows @devmaxxapp's following by:
 *   1. Following relevant Roblox creator accounts from ProspectList (max 20/day)
 *   2. Unfollowing non-followers after 7 days (max 10/day)
 *
 * Runs: Daily 2pm UTC — 0 14 * * *
 *
 * Uses Twitter API v2 via Vercel proxy (Railway IPs are blocked).
 * Follow/unfollow calls go through:
 *   POST https://www.devmaxx.app/api/social/twitter-follow
 *   { action: 'follow'|'unfollow', targetUserId }
 *
 * User ID lookups go through:
 *   GET https://www.devmaxx.app/api/twitter/search?query=from:{handle}
 */

const VERCEL_BASE = 'https://www.devmaxx.app';
const CRON_SECRET = (process.env.CRON_SECRET || '').trim();
const TWITTER_USER_ID = (process.env.TWITTER_USER_ID || '').trim();

function log(msg: string) {
  console.log(`[TwitterFollow] ${msg}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Vercel Proxy Calls ─────────────────────────────────────

function proxyHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${CRON_SECRET}`,
  };
}

async function callFollowApi(action: 'follow' | 'unfollow', targetUserId: string): Promise<{ success: boolean; error?: string }> {
  const url = `${VERCEL_BASE}/api/social/twitter-follow`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: proxyHeaders(),
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

// ─── Twitter User ID Lookup ─────────────────────────────────

async function lookupTwitterUserId(handle: string): Promise<{ userId: string; username: string } | null> {
  const cleanHandle = handle.replace(/^@/, '').trim();
  const url = `${VERCEL_BASE}/api/twitter/user?username=${encodeURIComponent(cleanHandle)}`;

  try {
    const res = await fetch(url, { headers: proxyHeaders() });

    if (res.status === 404) {
      log(`@${cleanHandle} not found on Twitter`);
      return null;
    }

    if (!res.ok) {
      const body = await res.text();
      log(`User lookup for @${cleanHandle} failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
      return null;
    }

    const data = (await res.json()) as {
      found: boolean;
      id?: string;
      username?: string;
    };

    if (!data.found || !data.id) {
      log(`@${cleanHandle} lookup returned no ID`);
      return null;
    }

    log(`Resolved @${cleanHandle} → user ID: ${data.id}`);
    return { userId: data.id, username: data.username ?? cleanHandle };
  } catch (err) {
    log(`User lookup error for @${cleanHandle}: ${err}`);
    return null;
  }
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
  const followedBack = 0;
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
    select: { userId: true, username: true },
  });
  const alreadyFollowedIds = new Set(existingFollows.map((f) => f.userId));
  const alreadyFollowedUsernames = new Set(existingFollows.map((f) => f.username.toLowerCase()));
  log(`Already followed ${alreadyFollowedIds.size} accounts total`);

  // ─── PART 1: Follow prospects with twitter handles (max 20/day) ─

  log('=== Part 1: Follow prospects from ProspectList + Leaderboard ===');

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
    // Get prospects with enriched twitter handles
    const prospects = await db.prospectList.findMany({
      where: {
        twitterHandle: { not: null },
      },
      orderBy: { prospectScore: 'desc' },
      take: 50,
    });

    // Also get leaderboard entries with twitter handles
    const leaderboardEntries = await db.leaderboard.findMany({
      where: {
        twitterHandle: { not: null },
      },
      orderBy: { rank: 'asc' },
      take: 50,
    });

    // Build candidate list: handle + source
    const candidates: Array<{ handle: string; gameName: string; source: string }> = [];

    for (const p of prospects) {
      if (p.twitterHandle && p.twitterHandle.trim() !== '' && !alreadyFollowedUsernames.has(p.twitterHandle.toLowerCase())) {
        candidates.push({ handle: p.twitterHandle, gameName: p.gameName, source: 'prospect' });
      }
    }

    for (const l of leaderboardEntries) {
      if (l.twitterHandle && l.twitterHandle.trim() !== '' && !alreadyFollowedUsernames.has(l.twitterHandle.toLowerCase())) {
        // Avoid duplicates from prospects
        if (!candidates.some((c) => c.handle.toLowerCase() === l.twitterHandle!.toLowerCase())) {
          candidates.push({ handle: l.twitterHandle, gameName: l.gameName, source: 'leaderboard' });
        }
      }
    }

    log(`Found ${candidates.length} candidates with twitter handles (${prospects.length} prospects, ${leaderboardEntries.length} leaderboard entries checked)`);

    // Resolve handles to user IDs and follow
    let followsThisRun = 0;
    for (const candidate of candidates) {
      if (followsThisRun >= followBudget) {
        log(`Follow budget exhausted (${followsThisRun}/${followBudget})`);
        break;
      }

      log(`Looking up @${candidate.handle} (${candidate.gameName}, ${candidate.source})...`);
      const lookup = await lookupTwitterUserId(candidate.handle);
      await delay(1000);

      if (!lookup) {
        log(`  Could not resolve @${candidate.handle} — skipping`);
        continue;
      }

      if (alreadyFollowedIds.has(lookup.userId)) {
        log(`  @${candidate.handle} (ID: ${lookup.userId}) already followed — skipping`);
        continue;
      }

      log(`  Following @${lookup.username} (ID: ${lookup.userId})...`);
      const result = await callFollowApi('follow', lookup.userId);

      if (result.success) {
        await db.twitterFollowLog.create({
          data: {
            userId: lookup.userId,
            username: lookup.username,
            action: 'follow',
            reason: `${candidate.source}: ${candidate.gameName}`,
          },
        });
        followed++;
        followsThisRun++;
        alreadyFollowedIds.add(lookup.userId);
        alreadyFollowedUsernames.add(lookup.username.toLowerCase());
        log(`  SUCCESS — followed @${lookup.username}`);
      } else {
        // 403 on follow means the account restricts who can follow
        if (result.error?.includes('403')) {
          log(`  @${lookup.username} restricts follows — skipping`);
        } else {
          errors.push(`Follow @${lookup.username} failed: ${result.error}`);
          log(`  FAILED: ${result.error}`);
        }
      }

      await delay(2000);
    }
  }

  // ─── PART 2: Follow back (skipped — requires Basic tier) ───

  log('=== Part 2: Follow back — skipped (requires Basic tier) ===');

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

        await delay(2000);
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
        input: { followBudget, unfollowBudget },
        output: { followed, followedBack, unfollowed, errorCount: errors.length },
        action: 'twitter_follow',
        robuxImpact: 0,
        status: errors.length > 10 ? 'failed' : 'success',
      },
    });
  }

  log(`Done — followed: ${followed}, unfollowed: ${unfollowed}, errors: ${errors.length}`);
  return { followed, followedBack, unfollowed, errors };
}
