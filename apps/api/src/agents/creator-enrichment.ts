import { PrismaClient } from '@prisma/client';

/**
 * CreatorEnrichmentAgent
 *
 * Runs daily at 6am UTC. For every creator in ProspectList and Leaderboard
 * that hasn't been enriched in the last 7 days, searches across all social
 * platforms and enriches records with social presence data.
 *
 * Sources:
 *   - Roblox profile + promotion channels
 *   - Twitter/X lookup
 *   - YouTube Data API v3
 *   - Reddit user API
 *   - Roblox DevForum
 *
 * Rate limits: max 50 creators per run, 500ms delay between API calls.
 */

const FETCH_TIMEOUT_MS = 10_000;
const DELAY_BETWEEN_CALLS_MS = 500;
const MAX_CREATORS_PER_RUN = 50;
const ENRICHMENT_STALE_DAYS = 7;

function log(msg: string) {
  console.log(`[CreatorEnrichment] ${msg}`);
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`API timeout: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Types ──────────────────────────────────────────────────

interface EnrichmentData {
  twitterHandle: string | null;
  twitterFollowers: number | null;
  youtubeChannel: string | null;
  youtubeSubscribers: number | null;
  twitchHandle: string | null;
  redditUsername: string | null;
  devforumUsername: string | null;
  devforumTrustLevel: number | null;
  socialScore: number;
}

interface CreatorTarget {
  id: string;
  source: 'prospect' | 'leaderboard';
  creatorName: string;
  gameName: string;
  robloxGameId?: string;
  universeId?: string;
  creatorUserId?: string;
}

// ─── STEP 1: Roblox Profile ────────────────────────────────

interface RobloxPromotionChannels {
  facebook?: string;
  twitter?: string;
  youtube?: string;
  twitch?: string;
  guilded?: string;
}

async function fetchRobloxProfile(userId: string): Promise<{
  displayName: string | null;
  bio: string | null;
}> {
  try {
    const res = await fetchWithTimeout(`https://users.roblox.com/v1/users/${userId}`);
    if (!res.ok) return { displayName: null, bio: null };
    const data = (await res.json()) as { displayName?: string; description?: string };
    return {
      displayName: data.displayName ?? null,
      bio: data.description ?? null,
    };
  } catch {
    return { displayName: null, bio: null };
  }
}

async function fetchPromotionChannels(userId: string): Promise<RobloxPromotionChannels> {
  try {
    const res = await fetchWithTimeout(
      `https://accountinformation.roblox.com/v1/users/${userId}/promotion-channels`
    );
    if (!res.ok) return {};
    const data = (await res.json()) as RobloxPromotionChannels;
    return data;
  } catch {
    return {};
  }
}

// ─── STEP 2: Twitter/X Search ──────────────────────────────

async function searchTwitterUser(username: string): Promise<{
  handle: string | null;
  followers: number | null;
}> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (!bearerToken) return { handle: null, followers: null };

  try {
    const res = await fetchWithTimeout(
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=public_metrics`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
      }
    );
    if (!res.ok) return { handle: null, followers: null };
    const data = (await res.json()) as {
      data?: {
        username: string;
        public_metrics?: { followers_count?: number };
      };
    };
    if (!data.data) return { handle: null, followers: null };
    return {
      handle: data.data.username,
      followers: data.data.public_metrics?.followers_count ?? null,
    };
  } catch {
    return { handle: null, followers: null };
  }
}

async function findTwitterHandle(creatorName: string, gameName: string): Promise<{
  handle: string | null;
  followers: number | null;
}> {
  // Try exact username first
  const exact = await searchTwitterUser(creatorName);
  if (exact.handle) return exact;
  await delay(DELAY_BETWEEN_CALLS_MS);

  // Try username + "roblox"
  const withRoblox = await searchTwitterUser(`${creatorName}roblox`);
  if (withRoblox.handle) return withRoblox;
  await delay(DELAY_BETWEEN_CALLS_MS);

  // Try username + "dev"
  const withDev = await searchTwitterUser(`${creatorName}dev`);
  if (withDev.handle) return withDev;

  return { handle: null, followers: null };
}

// ─── STEP 3: YouTube Search ────────────────────────────────

async function searchYouTubeChannel(gameName: string, creatorName: string): Promise<{
  channelId: string | null;
  subscribers: number | null;
}> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return { channelId: null, subscribers: null };

  try {
    const query = encodeURIComponent(`${gameName} roblox ${creatorName}`);
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?q=${query}&type=channel&maxResults=3&key=${apiKey}`;
    const res = await fetchWithTimeout(searchUrl);
    if (!res.ok) return { channelId: null, subscribers: null };

    const data = (await res.json()) as {
      items?: Array<{
        snippet?: { channelId?: string; title?: string };
      }>;
    };

    const items = data.items ?? [];
    if (items.length === 0) return { channelId: null, subscribers: null };

    // Find best match — check if any channel title contains the creator name
    const match = items.find((item) => {
      const title = (item.snippet?.title ?? '').toLowerCase();
      return (
        title.includes(creatorName.toLowerCase()) ||
        title.includes(gameName.toLowerCase())
      );
    }) ?? items[0];

    const channelId = match?.snippet?.channelId;
    if (!channelId) return { channelId: null, subscribers: null };

    // Fetch subscriber count
    await delay(DELAY_BETWEEN_CALLS_MS);
    const statsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`;
    const statsRes = await fetchWithTimeout(statsUrl);
    if (!statsRes.ok) return { channelId, subscribers: null };

    const statsData = (await statsRes.json()) as {
      items?: Array<{
        statistics?: { subscriberCount?: string };
      }>;
    };

    const subCount = statsData.items?.[0]?.statistics?.subscriberCount;
    return {
      channelId,
      subscribers: subCount ? parseInt(subCount, 10) : null,
    };
  } catch {
    return { channelId: null, subscribers: null };
  }
}

// ─── STEP 4: Reddit Search ─────────────────────────────────

async function checkRedditUser(username: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
      {
        headers: { 'User-Agent': 'devmaxx-enrichment/1.0' },
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: { name?: string; subreddit?: { subscribers?: number } };
    };
    return data.data?.name ?? null;
  } catch {
    return null;
  }
}

// ─── STEP 5: DevForum Search ───────────────────────────────

async function checkDevForum(username: string): Promise<{
  username: string | null;
  trustLevel: number | null;
}> {
  try {
    const res = await fetchWithTimeout(
      `https://devforum.roblox.com/u/${encodeURIComponent(username)}.json`
    );
    if (!res.ok) return { username: null, trustLevel: null };
    const data = (await res.json()) as {
      user?: { username?: string; trust_level?: number };
    };
    return {
      username: data.user?.username ?? null,
      trustLevel: data.user?.trust_level ?? null,
    };
  } catch {
    return { username: null, trustLevel: null };
  }
}

// ─── Social Score Calculation ──────────────────────────────

function calculateSocialScore(data: EnrichmentData): number {
  let score = 0;

  // Twitter presence (up to 3 points)
  if (data.twitterHandle) {
    score += 1;
    if ((data.twitterFollowers ?? 0) >= 1000) score += 1;
    if ((data.twitterFollowers ?? 0) >= 10000) score += 1;
  }

  // YouTube presence (up to 3 points)
  if (data.youtubeChannel) {
    score += 1;
    if ((data.youtubeSubscribers ?? 0) >= 1000) score += 1;
    if ((data.youtubeSubscribers ?? 0) >= 10000) score += 1;
  }

  // Twitch (1 point)
  if (data.twitchHandle) score += 1;

  // Reddit (1 point)
  if (data.redditUsername) score += 1;

  // DevForum (up to 2 points)
  if (data.devforumUsername) {
    score += 1;
    if ((data.devforumTrustLevel ?? 0) >= 2) score += 1;
  }

  return Math.min(score, 10);
}

// ─── Enrich a single creator ───────────────────────────────

async function enrichCreator(target: CreatorTarget): Promise<EnrichmentData> {
  log(`Enriching: ${target.creatorName} (${target.gameName})`);

  const enrichment: EnrichmentData = {
    twitterHandle: null,
    twitterFollowers: null,
    youtubeChannel: null,
    youtubeSubscribers: null,
    twitchHandle: null,
    redditUsername: null,
    devforumUsername: null,
    devforumTrustLevel: null,
    socialScore: 0,
  };

  // STEP 1: Roblox promotion channels (if we have a user ID)
  if (target.creatorUserId) {
    const channels = await fetchPromotionChannels(target.creatorUserId);
    await delay(DELAY_BETWEEN_CALLS_MS);

    if (channels.twitter) {
      // Clean Twitter handle — may be URL or handle
      const twitterHandle = channels.twitter
        .replace(/https?:\/\/(www\.)?(twitter|x)\.com\//i, '')
        .replace(/^@/, '')
        .split('/')[0]
        .split('?')[0]
        .trim();

      if (twitterHandle) {
        const twitterData = await searchTwitterUser(twitterHandle);
        enrichment.twitterHandle = twitterData.handle ?? twitterHandle;
        enrichment.twitterFollowers = twitterData.followers;
        await delay(DELAY_BETWEEN_CALLS_MS);
      }
    }

    if (channels.youtube) {
      // Extract channel ID from YouTube URL
      const ytMatch = channels.youtube.match(/channel\/(UC[\w-]+)/);
      if (ytMatch) {
        enrichment.youtubeChannel = ytMatch[1];
      } else {
        enrichment.youtubeChannel = channels.youtube;
      }
    }

    if (channels.twitch) {
      const twitchHandle = channels.twitch
        .replace(/https?:\/\/(www\.)?twitch\.tv\//i, '')
        .split('/')[0]
        .split('?')[0]
        .trim();
      enrichment.twitchHandle = twitchHandle || null;
    }
  }

  // STEP 2: Twitter search (if not found from Roblox profile)
  if (!enrichment.twitterHandle) {
    const twitter = await findTwitterHandle(target.creatorName, target.gameName);
    enrichment.twitterHandle = twitter.handle;
    enrichment.twitterFollowers = twitter.followers;
    await delay(DELAY_BETWEEN_CALLS_MS);
  }

  // STEP 3: YouTube search (if not found from Roblox profile)
  if (!enrichment.youtubeChannel) {
    const youtube = await searchYouTubeChannel(target.gameName, target.creatorName);
    enrichment.youtubeChannel = youtube.channelId;
    enrichment.youtubeSubscribers = youtube.subscribers;
    await delay(DELAY_BETWEEN_CALLS_MS);
  }

  // STEP 4: Reddit check
  const reddit = await checkRedditUser(target.creatorName);
  enrichment.redditUsername = reddit;
  await delay(DELAY_BETWEEN_CALLS_MS);

  // STEP 5: DevForum check
  const devforum = await checkDevForum(target.creatorName);
  enrichment.devforumUsername = devforum.username;
  enrichment.devforumTrustLevel = devforum.trustLevel;

  // STEP 6: Calculate social score
  enrichment.socialScore = calculateSocialScore(enrichment);

  log(`  ${target.creatorName}: score=${enrichment.socialScore} twitter=${enrichment.twitterHandle ?? 'none'} yt=${enrichment.youtubeChannel ?? 'none'} reddit=${enrichment.redditUsername ?? 'none'} devforum=${enrichment.devforumUsername ?? 'none'}`);

  return enrichment;
}

// ─── Outreach Queue ────────────────────────────────────────

async function queueOutreach(
  db: PrismaClient,
  target: CreatorTarget,
  enrichment: EnrichmentData
): Promise<number> {
  let queued = 0;

  if (enrichment.twitterHandle) {
    try {
      await db.creatorOutreachQueue.upsert({
        where: {
          creatorId_platform: {
            creatorId: target.id,
            platform: 'twitter',
          },
        },
        create: {
          creatorId: target.id,
          creatorName: target.creatorName,
          gameName: target.gameName,
          platform: 'twitter',
          platformHandle: enrichment.twitterHandle,
          status: 'pending',
          source: target.source,
        },
        update: {
          platformHandle: enrichment.twitterHandle,
          creatorName: target.creatorName,
          gameName: target.gameName,
        },
      });
      queued++;
    } catch (err) {
      log(`  Failed to queue twitter outreach for ${target.creatorName}: ${err}`);
    }
  }

  if (enrichment.youtubeChannel) {
    try {
      await db.creatorOutreachQueue.upsert({
        where: {
          creatorId_platform: {
            creatorId: target.id,
            platform: 'youtube',
          },
        },
        create: {
          creatorId: target.id,
          creatorName: target.creatorName,
          gameName: target.gameName,
          platform: 'youtube',
          platformHandle: enrichment.youtubeChannel,
          status: 'pending',
          source: target.source,
        },
        update: {
          platformHandle: enrichment.youtubeChannel,
          creatorName: target.creatorName,
          gameName: target.gameName,
        },
      });
      queued++;
    } catch (err) {
      log(`  Failed to queue youtube outreach for ${target.creatorName}: ${err}`);
    }
  }

  if (enrichment.devforumUsername && (enrichment.devforumTrustLevel ?? 0) >= 1) {
    try {
      await db.creatorOutreachQueue.upsert({
        where: {
          creatorId_platform: {
            creatorId: target.id,
            platform: 'devforum',
          },
        },
        create: {
          creatorId: target.id,
          creatorName: target.creatorName,
          gameName: target.gameName,
          platform: 'devforum',
          platformHandle: enrichment.devforumUsername,
          status: 'pending',
          source: target.source,
        },
        update: {
          platformHandle: enrichment.devforumUsername,
          creatorName: target.creatorName,
          gameName: target.gameName,
        },
      });
      queued++;
    } catch (err) {
      log(`  Failed to queue devforum outreach for ${target.creatorName}: ${err}`);
    }
  }

  return queued;
}

// ─── Main Pipeline ──────────────────────────────────────────

export interface CreatorEnrichmentResult {
  creatorsEnriched: number;
  prospectsUpdated: number;
  leaderboardUpdated: number;
  outreachQueued: number;
  errors: string[];
}

export async function runCreatorEnrichmentPipeline(
  db: PrismaClient
): Promise<CreatorEnrichmentResult> {
  const errors: string[] = [];
  let creatorsEnriched = 0;
  let prospectsUpdated = 0;
  let leaderboardUpdated = 0;
  let outreachQueued = 0;

  log('Starting creator enrichment pipeline...');

  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - ENRICHMENT_STALE_DAYS);

  // Gather targets from ProspectList
  const prospects = await db.prospectList.findMany({
    where: {
      OR: [
        { enrichedAt: null },
        { enrichedAt: { lt: staleDate } },
      ],
    },
    orderBy: { prospectScore: 'desc' },
    take: MAX_CREATORS_PER_RUN,
  });

  const remaining = MAX_CREATORS_PER_RUN - prospects.length;

  // Gather targets from Leaderboard
  const leaderboardEntries = remaining > 0
    ? await db.leaderboard.findMany({
        where: {
          OR: [
            { enrichedAt: null },
            { enrichedAt: { lt: staleDate } },
          ],
        },
        orderBy: { rank: 'asc' },
        take: remaining,
      })
    : [];

  const targets: CreatorTarget[] = [
    ...prospects.map((p) => ({
      id: p.id,
      source: 'prospect' as const,
      creatorName: p.creatorUsername,
      gameName: p.gameName,
      robloxGameId: p.robloxGameId,
    })),
    ...leaderboardEntries.map((l) => ({
      id: l.id,
      source: 'leaderboard' as const,
      creatorName: l.creatorName,
      gameName: l.gameName,
      universeId: l.universeId,
    })),
  ];

  log(`Found ${targets.length} creators to enrich (${prospects.length} prospects + ${leaderboardEntries.length} leaderboard)`);

  for (const target of targets) {
    try {
      const enrichment = await enrichCreator(target);

      // Update the appropriate table
      if (target.source === 'prospect') {
        await db.prospectList.update({
          where: { id: target.id },
          data: {
            twitterHandle: enrichment.twitterHandle,
            twitterFollowers: enrichment.twitterFollowers,
            youtubeChannel: enrichment.youtubeChannel,
            youtubeSubscribers: enrichment.youtubeSubscribers,
            twitchHandle: enrichment.twitchHandle,
            redditUsername: enrichment.redditUsername,
            devforumUsername: enrichment.devforumUsername,
            devforumTrustLevel: enrichment.devforumTrustLevel,
            socialScore: enrichment.socialScore,
            enrichedAt: new Date(),
          },
        });
        prospectsUpdated++;
      } else {
        await db.leaderboard.update({
          where: { id: target.id },
          data: {
            twitterHandle: enrichment.twitterHandle,
            twitterFollowers: enrichment.twitterFollowers,
            youtubeChannel: enrichment.youtubeChannel,
            youtubeSubscribers: enrichment.youtubeSubscribers,
            twitchHandle: enrichment.twitchHandle,
            redditUsername: enrichment.redditUsername,
            devforumUsername: enrichment.devforumUsername,
            devforumTrustLevel: enrichment.devforumTrustLevel,
            socialScore: enrichment.socialScore,
            enrichedAt: new Date(),
          },
        });
        leaderboardUpdated++;
      }

      // Queue outreach for enriched creators with social presence
      if (enrichment.socialScore > 0) {
        const queued = await queueOutreach(db, target, enrichment);
        outreachQueued += queued;
      }

      creatorsEnriched++;
      await delay(DELAY_BETWEEN_CALLS_MS);
    } catch (err) {
      errors.push(`${target.creatorName}: ${err}`);
      log(`  ERROR enriching ${target.creatorName}: ${err}`);
    }
  }

  log(`Done — ${creatorsEnriched} enriched (${prospectsUpdated} prospects, ${leaderboardUpdated} leaderboard), ${outreachQueued} outreach queued, ${errors.length} errors`);

  return {
    creatorsEnriched,
    prospectsUpdated,
    leaderboardUpdated,
    outreachQueued,
    errors,
  };
}
