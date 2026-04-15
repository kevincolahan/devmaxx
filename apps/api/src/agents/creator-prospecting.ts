import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

/**
 * CreatorProspectingAgent
 *
 * Finds Roblox games in the sweet spot (100-10K concurrent) that have
 * monetization and are actively updated. Scores them, enriches data,
 * and queues top prospects for X outreach with personalized messages.
 *
 * Working Roblox API endpoints (verified from Railway):
 *   - catalog.roblox.com/v1/search/items (keyword → asset/place IDs)
 *   - apis.roblox.com/universes/v1/places/{placeId}/universe (place → universe)
 *   - games.roblox.com/v1/games?universeIds= (batch game details)
 *   - apis.roblox.com/explore-api/v1/get-sorts (browse sorts with game set IDs)
 *   - economy.roblox.com/v2/universes/{id}/game-passes (game pass lookup)
 *   - accountinformation.roblox.com/v1/users/{id}/promotion-channels (socials)
 *
 * Dead endpoints (404 from Railway as of April 2026):
 *   - games.roblox.com/v1/games/list
 *   - games.roblox.com/v1/games/sorts
 *   - games.roblox.com/v1/games/{id}/game-passes
 *   - develop.roblox.com/v1/universes
 */

const FETCH_TIMEOUT_MS = 10_000;

function log(msg: string) {
  console.log(`[Prospecting] ${msg}`);
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Roblox API timeout: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Roblox Public API Helpers ───────────────────────────────

interface GameSearchResult {
  universeId: number;
  name: string;
  playing: number;
  visits: number;
  created: string;
  updated: string;
  creatorId: number;
  creatorType: string;
  creatorName: string;
}

interface GamePassInfo {
  id: number;
  name: string;
  price: number | null;
}

interface ProspectData {
  robloxGameId: string;
  gameName: string;
  creatorUsername: string;
  concurrentPlayers: number;
  visitCount: number;
  hasGamePasses: boolean;
  gamePassCount: number;
  gamePassPriceMin: number | null;
  gamePassPriceMax: number | null;
  socialLinks: Record<string, string>;
  updatedRecently: boolean;
}

// ─── Strategy 1: Catalog search → place IDs → universe IDs → game details ───

async function catalogSearch(keyword: string, limit = 50): Promise<number[]> {
  const url = `https://catalog.roblox.com/v1/search/items?category=Game&keyword=${encodeURIComponent(keyword)}&limit=${Math.min(limit, 30)}`;
  log(`catalogSearch URL: ${url}`);

  const res = await fetchWithTimeout(url);
  log(`catalogSearch "${keyword}" status: ${res.status}`);

  if (!res.ok) {
    const body = await res.text();
    log(`catalogSearch "${keyword}" error: ${body.slice(0, 200)}`);
    return [];
  }

  const data = (await res.json()) as {
    data?: Array<{ id: number; itemType: string }>;
    nextPageCursor?: string | null;
  };

  const ids = (data.data ?? []).map((item) => item.id);
  log(`catalogSearch "${keyword}" found ${ids.length} asset IDs`);
  return ids;
}

async function placeToUniverse(placeId: number): Promise<number | null> {
  const url = `https://apis.roblox.com/universes/v1/places/${placeId}/universe`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { universeId?: number };
    return data.universeId ?? null;
  } catch {
    return null;
  }
}

async function placesToUniverses(placeIds: number[]): Promise<number[]> {
  const universeIds: number[] = [];
  // Process in parallel batches of 10 to speed things up
  for (let i = 0; i < placeIds.length; i += 10) {
    const batch = placeIds.slice(i, i + 10);
    const results = await Promise.all(batch.map((id) => placeToUniverse(id)));
    for (const uid of results) {
      if (uid !== null) universeIds.push(uid);
    }
  }
  log(`placesToUniverses: ${placeIds.length} place IDs → ${universeIds.length} universe IDs`);
  return universeIds;
}

// ─── Strategy 2: Explore API sorts → game set IDs → universe IDs ───

async function getExploreSortUniverseIds(): Promise<number[]> {
  const url = 'https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=prospecting';
  log(`getExploreSorts URL: ${url}`);

  const res = await fetchWithTimeout(url);
  log(`getExploreSorts status: ${res.status}`);

  if (!res.ok) {
    const body = await res.text();
    log(`getExploreSorts error: ${body.slice(0, 200)}`);
    return [];
  }

  const data = (await res.json()) as {
    sorts?: Array<{
      gameSetTypeId?: number;
      gameSetTargetId?: number;
      games?: Array<{ universeId?: number }>;
      topicLayoutData?: {
        gameSetData?: Array<{
          games?: Array<{ universeId?: number }>;
        }>;
      };
    }>;
  };

  const universeIds: number[] = [];
  for (const sort of data.sorts ?? []) {
    // Some sorts embed games directly
    for (const game of sort.games ?? []) {
      if (game.universeId) universeIds.push(game.universeId);
    }
    // Some sorts have nested gameSetData
    for (const gs of sort.topicLayoutData?.gameSetData ?? []) {
      for (const game of gs.games ?? []) {
        if (game.universeId) universeIds.push(game.universeId);
      }
    }
  }

  log(`getExploreSorts found ${universeIds.length} embedded universe IDs`);

  // Also try fetching game sets from the sorts
  const gameSetIds: Array<{ typeId: number; targetId: number }> = [];
  for (const sort of data.sorts ?? []) {
    if (sort.gameSetTypeId && sort.gameSetTargetId) {
      gameSetIds.push({ typeId: sort.gameSetTypeId, targetId: sort.gameSetTargetId });
    }
  }

  // Fetch first 3 game sets for more universe IDs
  for (const gs of gameSetIds.slice(0, 3)) {
    try {
      const gsUrl = `https://apis.roblox.com/explore-api/v1/get-games?gameSetTypeId=${gs.typeId}&gameSetTargetId=${gs.targetId}&maxRows=50`;
      log(`getGames URL: ${gsUrl}`);
      const gsRes = await fetchWithTimeout(gsUrl);
      log(`getGames status: ${gsRes.status}`);

      if (gsRes.ok) {
        const gsData = (await gsRes.json()) as {
          games?: Array<{ universeId?: number }>;
        };
        for (const game of gsData.games ?? []) {
          if (game.universeId) universeIds.push(game.universeId);
        }
        log(`getGames set ${gs.typeId}/${gs.targetId} returned ${gsData.games?.length ?? 0} games`);
      } else {
        const body = await gsRes.text();
        log(`getGames error: ${body.slice(0, 200)}`);
      }
    } catch (err) {
      log(`getGames threw: ${String(err)}`);
    }
  }

  return universeIds;
}

// ─── Batch game details (CONFIRMED WORKING) ───

async function fetchGamesByIds(universeIds: number[]): Promise<GameSearchResult[]> {
  if (universeIds.length === 0) return [];

  const allGames: GameSearchResult[] = [];

  // Process in batches of 100 (API limit)
  for (let i = 0; i < universeIds.length; i += 100) {
    const batch = universeIds.slice(i, i + 100);
    const url = `https://games.roblox.com/v1/games?universeIds=${batch.join(',')}`;
    log(`fetchGamesByIds URL: ${url.slice(0, 120)}... (${batch.length} IDs)`);

    const res = await fetchWithTimeout(url);
    log(`fetchGamesByIds status: ${res.status}`);

    if (!res.ok) {
      const body = await res.text();
      log(`fetchGamesByIds error: ${body.slice(0, 200)}`);
      continue;
    }

    const data = (await res.json()) as {
      data?: Array<{
        id: number;
        rootPlaceId: number;
        name: string;
        playing: number;
        visits: number;
        created: string;
        updated: string;
        creator: { id: number; type: string; name: string };
      }>;
    };

    const games = data.data ?? [];
    log(`fetchGamesByIds batch returned ${games.length} games`);
    allGames.push(
      ...games.map((g) => ({
        universeId: g.id,
        name: g.name,
        playing: g.playing,
        visits: g.visits,
        created: g.created,
        updated: g.updated,
        creatorId: g.creator.id,
        creatorType: g.creator.type,
        creatorName: g.creator.name,
      }))
    );
  }

  return allGames;
}

// ─── Game passes (try multiple endpoints) ───

async function fetchGamePasses(universeId: number): Promise<GamePassInfo[]> {
  // Try economy API (newer)
  const economyUrl = `https://economy.roblox.com/v2/universes/${universeId}/game-passes?limit=100&sortOrder=Asc`;
  try {
    const res = await fetchWithTimeout(economyUrl);
    if (res.ok) {
      const data = (await res.json()) as {
        data?: Array<{ id: number; name: string; price: number | null }>;
      };
      if (data.data && data.data.length > 0) {
        return data.data.map((gp) => ({ id: gp.id, name: gp.name, price: gp.price }));
      }
    }
  } catch {
    // fall through
  }

  // Try games API v1 (may still work for some)
  const gamesUrl = `https://games.roblox.com/v1/games/${universeId}/game-passes?limit=100&sortOrder=Asc`;
  try {
    const res = await fetchWithTimeout(gamesUrl);
    if (res.ok) {
      const data = (await res.json()) as {
        data?: Array<{ id: number; name: string; price: number | null }>;
      };
      return (data.data ?? []).map((gp) => ({ id: gp.id, name: gp.name, price: gp.price }));
    }
  } catch {
    // fall through
  }

  return [];
}

// ─── User socials ───

async function fetchUserSocials(userId: number): Promise<Record<string, string>> {
  const url = `https://accountinformation.roblox.com/v1/users/${userId}/promotion-channels`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return {};

  const data = (await res.json()) as Record<string, string | null>;
  const socials: Record<string, string> = {};

  if (data.twitter) socials.twitter = data.twitter;
  if (data.youtube) socials.youtube = data.youtube;
  if (data.twitch) socials.twitch = data.twitch;
  if (data.facebook) socials.facebook = data.facebook;

  return socials;
}

// ─── Scoring ────────────────────────────────────────────────

function scoreProspect(prospect: ProspectData): number {
  let score = 5; // Base score

  // Concurrent players sweet spot: 100-10K
  if (prospect.concurrentPlayers >= 500 && prospect.concurrentPlayers <= 5000) {
    score += 2; // Perfect sweet spot
  } else if (prospect.concurrentPlayers >= 100 && prospect.concurrentPlayers <= 10000) {
    score += 1; // Good range
  } else if (prospect.concurrentPlayers > 10000) {
    score -= 2; // Too big, likely has a team
  } else {
    score -= 1; // Too small
  }

  // Monetization
  if (prospect.hasGamePasses && prospect.gamePassCount >= 3) {
    score += 2; // Serious about monetization
  } else if (prospect.hasGamePasses) {
    score += 1; // Some monetization
  } else {
    score -= 2; // No monetization = not our ICP
  }

  // Visit count (engagement)
  if (prospect.visitCount >= 1_000_000) score += 1;
  if (prospect.visitCount >= 10_000_000) score += 1;

  // Recently updated
  if (prospect.updatedRecently) score += 1;
  else score -= 1;

  // Social presence (easier to reach)
  if (prospect.socialLinks.twitter) score += 1;

  return Math.max(1, Math.min(10, score));
}

// ─── Outreach Message Generation ────────────────────────────

async function generateOutreachMessage(
  prospect: ProspectData,
  score: number
): Promise<string> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You write short, personalized X/Twitter DMs for Devmaxx — an AI platform that helps Roblox creators optimize their games.

Rules:
- Max 280 characters (must fit in a tweet/DM)
- Reference their specific game by name
- Reference a specific metric (concurrent players or game passes)
- Sound like a fellow Roblox creator, not a marketer
- Never use buzzwords like "revolutionize" or "game-changing"
- Include a soft CTA (check it out, not "sign up now")
- No hashtags`,
    messages: [
      {
        role: 'user',
        content: `Write outreach for this Roblox creator:

Game: ${prospect.gameName}
Creator: ${prospect.creatorUsername}
Concurrent players: ${prospect.concurrentPlayers.toLocaleString()}
Total visits: ${prospect.visitCount.toLocaleString()}
Game passes: ${prospect.gamePassCount} (${prospect.hasGamePasses ? 'active' : 'none'})
${prospect.gamePassPriceMin !== null ? `Price range: ${prospect.gamePassPriceMin}-${prospect.gamePassPriceMax} Robux` : ''}
Prospect score: ${score}/10

Write a single tweet-length message.`,
      },
    ],
  });

  const text = response.content[0];
  return text.type === 'text' ? text.text.trim() : '';
}

// ─── Discovery: multi-strategy game finding ─────────────────

// Hardcoded popular Roblox universe IDs across genres (last resort fallback)
const KNOWN_UNIVERSE_IDS = [
  // Tycoons & Simulators
  3956818381, 4872321990, 2809202155, 2474168535, 1537690962,
  3597769786, 4915797882, 3732024327, 2337178604, 5765085497,
  5174755280, 4490140083, 5370651063, 2788229376, 5036010510,
  // RPG & Adventure
  3244313910, 4664500732, 920587237, 1224212277, 4922741943,
  // Popular active games
  2753915549, 292439477, 301549746, 379614936, 537413528,
  457405969, 142823291, 16732694, 114932368, 2414851778,
  67084534, 13822889, 65241,
  // Obby & Horror
  3260590327, 189707,
];

async function discoverGames(searchTerms: string[], errors: string[]): Promise<GameSearchResult[]> {
  const allUniverseIds = new Set<number>();

  // Strategy 1: Catalog search → place IDs → universe IDs
  log('=== Strategy 1: Catalog search ===');
  for (const term of searchTerms) {
    try {
      const placeIds = await catalogSearch(term, 30);
      if (placeIds.length > 0) {
        const universeIds = await placesToUniverses(placeIds);
        universeIds.forEach((id) => allUniverseIds.add(id));
      }
    } catch (err) {
      log(`Catalog search "${term}" threw: ${String(err)}`);
      errors.push(`Catalog search "${term}" failed: ${String(err)}`);
    }
  }
  log(`Strategy 1 total unique universe IDs: ${allUniverseIds.size}`);

  // Strategy 2: Explore API sorts → universe IDs
  log('=== Strategy 2: Explore API sorts ===');
  try {
    const exploreIds = await getExploreSortUniverseIds();
    exploreIds.forEach((id) => allUniverseIds.add(id));
    log(`After explore API, total unique universe IDs: ${allUniverseIds.size}`);
  } catch (err) {
    log(`Explore API threw: ${String(err)}`);
    errors.push(`Explore API failed: ${String(err)}`);
  }

  // Strategy 3: Hardcoded popular IDs (always include as baseline)
  log('=== Strategy 3: Hardcoded popular IDs ===');
  KNOWN_UNIVERSE_IDS.forEach((id) => allUniverseIds.add(id));
  log(`After hardcoded IDs, total unique universe IDs: ${allUniverseIds.size}`);

  // Fetch full game details for all collected universe IDs
  if (allUniverseIds.size === 0) {
    log('No universe IDs found from any strategy');
    return [];
  }

  log(`Fetching details for ${allUniverseIds.size} universe IDs...`);
  const games = await fetchGamesByIds(Array.from(allUniverseIds));
  log(`Got details for ${games.length} games`);

  return games;
}

// ─── Main Pipeline ──────────────────────────────────────────

export interface ProspectingResult {
  gamesScanned: number;
  prospectsFound: number;
  prospectsStored: number;
  outreachQueued: number;
  errors: string[];
}

export async function runCreatorProspectingPipeline(
  db: PrismaClient
): Promise<ProspectingResult> {
  const errors: string[] = [];
  let gamesScanned = 0;
  let prospectsFound = 0;
  let prospectsStored = 0;
  let outreachQueued = 0;

  // Get existing Devmaxx users (by robloxGameId) to exclude
  const existingGames = await db.game.findMany({ select: { robloxGameId: true } });
  const existingGameIds = new Set(existingGames.map((g) => g.robloxGameId));

  // Already-prospected game IDs (don't re-scan within 7 days)
  const recentProspects = await db.prospectList.findMany({
    where: { scannedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    select: { robloxGameId: true },
  });
  const recentIds = new Set(recentProspects.map((p) => p.robloxGameId));

  // Discover games using multi-strategy approach
  const searchTerms = ['tycoon', 'simulator', 'obby', 'rpg', 'roleplay', 'adventure', 'horror'];
  const allGames = await discoverGames(searchTerms, errors);

  // Deduplicate by universeId
  const uniqueGames = new Map<number, GameSearchResult>();
  for (const game of allGames) {
    uniqueGames.set(game.universeId, game);
  }

  gamesScanned = uniqueGames.size;
  log(`Total unique games after dedup: ${gamesScanned}`);
  log(`Excluding ${existingGameIds.size} existing + ${recentIds.size} recent`);

  // Filter to sweet spot
  const candidates = Array.from(uniqueGames.values()).filter((game) => {
    const id = String(game.universeId);
    if (existingGameIds.has(id)) return false;
    if (recentIds.has(id)) return false;
    if (game.playing < 100 || game.playing > 10000) return false;

    // Updated in last 30 days
    const updatedAt = new Date(game.updated);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (updatedAt < thirtyDaysAgo) return false;

    return true;
  });

  prospectsFound = candidates.length;
  log(`Candidates after filtering (100-10K concurrent, updated <30d): ${prospectsFound}`);

  // Enrich top candidates (limit to 30 per run to respect rate limits)
  const enrichLimit = Math.min(candidates.length, 30);
  const enrichedProspects: Array<ProspectData & { score: number }> = [];

  for (let i = 0; i < enrichLimit; i++) {
    const game = candidates[i];
    try {
      // Fetch game passes
      const gamePasses = await fetchGamePasses(game.universeId);
      const pricedPasses = gamePasses.filter((gp) => gp.price !== null && gp.price > 0);
      const prices = pricedPasses.map((gp) => gp.price!);

      // Fetch creator socials (only for User type, not Group)
      let socials: Record<string, string> = {};
      if (game.creatorType === 'User') {
        socials = await fetchUserSocials(game.creatorId);
      }

      const updatedAt = new Date(game.updated);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const prospect: ProspectData = {
        robloxGameId: String(game.universeId),
        gameName: game.name,
        creatorUsername: game.creatorName,
        concurrentPlayers: game.playing,
        visitCount: game.visits,
        hasGamePasses: gamePasses.length > 0,
        gamePassCount: gamePasses.length,
        gamePassPriceMin: prices.length > 0 ? Math.min(...prices) : null,
        gamePassPriceMax: prices.length > 0 ? Math.max(...prices) : null,
        socialLinks: socials,
        updatedRecently: updatedAt >= thirtyDaysAgo,
      };

      const score = scoreProspect(prospect);
      enrichedProspects.push({ ...prospect, score });
      log(`Enriched: ${game.name} (score=${score}, playing=${game.playing}, passes=${gamePasses.length})`);

      // Small delay to respect rate limits
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      errors.push(`Enrich ${game.name} failed: ${String(err)}`);
    }
  }

  // Store all enriched prospects
  for (const prospect of enrichedProspects) {
    try {
      await db.prospectList.upsert({
        where: { robloxGameId: prospect.robloxGameId },
        create: {
          robloxGameId: prospect.robloxGameId,
          gameName: prospect.gameName,
          creatorUsername: prospect.creatorUsername,
          concurrentPlayers: prospect.concurrentPlayers,
          visitCount: prospect.visitCount,
          hasGamePasses: prospect.hasGamePasses,
          gamePassCount: prospect.gamePassCount,
          gamePassPriceMin: prospect.gamePassPriceMin,
          gamePassPriceMax: prospect.gamePassPriceMax,
          socialLinks: prospect.socialLinks,
          prospectScore: prospect.score,
        },
        update: {
          gameName: prospect.gameName,
          concurrentPlayers: prospect.concurrentPlayers,
          visitCount: prospect.visitCount,
          hasGamePasses: prospect.hasGamePasses,
          gamePassCount: prospect.gamePassCount,
          gamePassPriceMin: prospect.gamePassPriceMin,
          gamePassPriceMax: prospect.gamePassPriceMax,
          socialLinks: prospect.socialLinks,
          prospectScore: prospect.score,
          scannedAt: new Date(),
        },
      });
      prospectsStored++;
    } catch (err) {
      errors.push(`Store ${prospect.gameName} failed: ${String(err)}`);
    }
  }

  // Generate outreach for top 10 scoring prospects with Twitter handles
  const contactedRecords = await db.prospectList.findMany({
    where: { outreachStatus: { in: ['contacted', 'replied', 'queued'] } },
    select: { robloxGameId: true },
  });
  const contactedIds = new Set(contactedRecords.map((r) => r.robloxGameId));

  const topProspects = enrichedProspects
    .filter((p) => p.score >= 6 && p.socialLinks.twitter && !contactedIds.has(p.robloxGameId))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  for (const prospect of topProspects) {
    try {
      const message = await generateOutreachMessage(prospect, prospect.score);

      await db.prospectList.update({
        where: { robloxGameId: prospect.robloxGameId },
        data: {
          outreachMessage: message,
          outreachStatus: 'queued',
        },
      });
      outreachQueued++;
    } catch (err) {
      errors.push(`Outreach gen ${prospect.gameName} failed: ${String(err)}`);
    }
  }

  // Log as system AgentRun
  const systemCreator = await db.creator.findFirst({
    where: { email: 'kevin@devmaxx.app' },
  });

  if (systemCreator) {
    await db.agentRun.create({
      data: {
        creatorId: systemCreator.id,
        agentName: 'CreatorProspectingAgent',
        input: { searchTerms, enrichLimit },
        output: { gamesScanned, prospectsFound, prospectsStored, outreachQueued, errorCount: errors.length },
        action: 'prospect_scan',
        robuxImpact: 0,
        status: errors.length > enrichLimit / 2 ? 'failed' : 'success',
      },
    });
  }

  return { gamesScanned, prospectsFound, prospectsStored, outreachQueued, errors };
}
