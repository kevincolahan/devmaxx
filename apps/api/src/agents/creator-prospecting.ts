import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

/**
 * CreatorProspectingAgent
 *
 * Finds Roblox games in the sweet spot (100-10K concurrent) that have
 * monetization and are actively updated. Scores them, enriches data,
 * and queues top prospects for X outreach with personalized messages.
 *
 * Discovery strategy (tries multiple endpoints with fallbacks):
 *   1. games.roblox.com/v1/games/list (keyword search)
 *   2. apis.roblox.com/search-api/omni-search (omni search)
 *   3. games.roblox.com/v1/games?universeIds= (batch detail lookup)
 *   4. games.roblox.com/v1/games/{id}/game-passes (enrichment)
 *   5. accountinformation.roblox.com/v1/users/{id}/promotion-channels
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

// Strategy 1: games.roblox.com/v1/games/list (keyword search)
async function searchGamesV1(keyword: string, limit = 50): Promise<GameSearchResult[]> {
  const url = `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(keyword)}&model.maxRows=${limit}&model.startRows=0&model.gameFilter=0`;
  log(`searchGamesV1 URL: ${url}`);

  const res = await fetchWithTimeout(url);
  log(`searchGamesV1 "${keyword}" status: ${res.status}`);

  if (!res.ok) {
    const body = await res.text();
    log(`searchGamesV1 "${keyword}" error: ${body.slice(0, 200)}`);
    return [];
  }

  const data = (await res.json()) as {
    games?: Array<{
      universeId: number;
      name: string;
      playing: number;
      visits: number;
      created: string;
      updated: string;
      creator: { id: number; type: string; name: string };
    }>;
  };

  const games = data.games ?? [];
  log(`searchGamesV1 "${keyword}" found ${games.length} games`);
  return games.map((g) => ({
    universeId: g.universeId,
    name: g.name,
    playing: g.playing,
    visits: g.visits,
    created: g.created,
    updated: g.updated,
    creatorId: g.creator.id,
    creatorType: g.creator.type,
    creatorName: g.creator.name,
  }));
}

// Strategy 2: omni-search API
async function searchGamesOmni(keyword: string): Promise<number[]> {
  const url = `https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(keyword)}&pageType=all`;
  log(`searchGamesOmni URL: ${url}`);

  const res = await fetchWithTimeout(url);
  log(`searchGamesOmni "${keyword}" status: ${res.status}`);

  if (!res.ok) {
    const body = await res.text();
    log(`searchGamesOmni "${keyword}" error: ${body.slice(0, 200)}`);
    return [];
  }

  const data = (await res.json()) as {
    searchResults?: Array<{
      contentGroupType?: string;
      contents?: Array<{
        contentType?: string;
        universeId?: number;
        contentId?: number;
      }>;
    }>;
  };

  const universeIds: number[] = [];
  for (const group of data.searchResults ?? []) {
    for (const item of group.contents ?? []) {
      const id = item.universeId ?? item.contentId;
      if (id) universeIds.push(id);
    }
  }

  log(`searchGamesOmni "${keyword}" found ${universeIds.length} universe IDs`);
  return universeIds;
}

// Batch lookup: get game details by universe IDs
async function fetchGamesByIds(universeIds: number[]): Promise<GameSearchResult[]> {
  if (universeIds.length === 0) return [];

  // API supports up to 100 IDs per request
  const batch = universeIds.slice(0, 100);
  const url = `https://games.roblox.com/v1/games?universeIds=${batch.join(',')}`;
  log(`fetchGamesByIds URL: ${url}`);

  const res = await fetchWithTimeout(url);
  log(`fetchGamesByIds status: ${res.status}`);

  if (!res.ok) {
    const body = await res.text();
    log(`fetchGamesByIds error: ${body.slice(0, 200)}`);
    return [];
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
  log(`fetchGamesByIds returned ${games.length} games`);
  return games.map((g) => ({
    universeId: g.id,
    name: g.name,
    playing: g.playing,
    visits: g.visits,
    created: g.created,
    updated: g.updated,
    creatorId: g.creator.id,
    creatorType: g.creator.type,
    creatorName: g.creator.name,
  }));
}

// Sort tokens for browsing popular games
async function getGameSortTokens(): Promise<string[]> {
  const url = 'https://games.roblox.com/v1/games/sorts?model.gameSortsContext=HomeSorts';
  log(`getGameSortTokens URL: ${url}`);

  const res = await fetchWithTimeout(url);
  log(`getGameSortTokens status: ${res.status}`);

  if (!res.ok) {
    const body = await res.text();
    log(`getGameSortTokens error: ${body.slice(0, 200)}`);
    return [];
  }

  const data = (await res.json()) as {
    sorts?: Array<{ token: string; name: string }>;
  };

  const tokens = (data.sorts ?? []).map((s) => s.token);
  log(`getGameSortTokens found ${tokens.length} sorts`);
  return tokens;
}

// Sorted game list (using sort token)
async function fetchSortedGames(sortToken: string, limit = 100): Promise<GameSearchResult[]> {
  const url = `https://games.roblox.com/v1/games/list?model.sortToken=${sortToken}&model.maxRows=${limit}&model.startRows=0&model.gameFilter=0`;
  log(`fetchSortedGames URL: ${url}`);

  const res = await fetchWithTimeout(url);
  log(`fetchSortedGames status: ${res.status}`);

  if (!res.ok) {
    const body = await res.text();
    log(`fetchSortedGames error: ${body.slice(0, 200)}`);
    return [];
  }

  const data = (await res.json()) as {
    games?: Array<{
      universeId: number;
      name: string;
      playing: number;
      visits: number;
      created: string;
      updated: string;
      creator: { id: number; type: string; name: string };
    }>;
  };

  const games = data.games ?? [];
  log(`fetchSortedGames found ${games.length} games`);
  return games.map((g) => ({
    universeId: g.universeId,
    name: g.name,
    playing: g.playing,
    visits: g.visits,
    created: g.created,
    updated: g.updated,
    creatorId: g.creator.id,
    creatorType: g.creator.type,
    creatorName: g.creator.name,
  }));
}

async function fetchGamePasses(universeId: number): Promise<GamePassInfo[]> {
  const url = `https://games.roblox.com/v1/games/${universeId}/game-passes?limit=100&sortOrder=Asc`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return [];

  const data = (await res.json()) as {
    data?: Array<{ id: number; name: string; price: number | null }>;
  };

  return (data.data ?? []).map((gp) => ({
    id: gp.id,
    name: gp.name,
    price: gp.price,
  }));
}

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

async function discoverGames(searchTerms: string[], errors: string[]): Promise<GameSearchResult[]> {
  const allGames: GameSearchResult[] = [];

  // Strategy 1: V1 keyword search
  log('=== Strategy 1: V1 keyword search ===');
  let v1Total = 0;
  for (const term of searchTerms) {
    try {
      const results = await searchGamesV1(term, 50);
      v1Total += results.length;
      allGames.push(...results);
    } catch (err) {
      log(`V1 search "${term}" threw: ${String(err)}`);
      errors.push(`V1 search "${term}" failed: ${String(err)}`);
    }
  }
  log(`Strategy 1 total: ${v1Total} games`);

  // Strategy 2: omni-search → batch details (fallback if V1 returned nothing)
  if (v1Total === 0) {
    log('=== Strategy 2: omni-search fallback ===');
    const allUniverseIds = new Set<number>();

    for (const term of searchTerms) {
      try {
        const ids = await searchGamesOmni(term);
        ids.forEach((id) => allUniverseIds.add(id));
      } catch (err) {
        log(`Omni search "${term}" threw: ${String(err)}`);
        errors.push(`Omni search "${term}" failed: ${String(err)}`);
      }
    }

    if (allUniverseIds.size > 0) {
      log(`Omni search found ${allUniverseIds.size} unique IDs, fetching details...`);
      try {
        const details = await fetchGamesByIds(Array.from(allUniverseIds));
        allGames.push(...details);
        log(`Strategy 2 total: ${details.length} games with details`);
      } catch (err) {
        log(`fetchGamesByIds threw: ${String(err)}`);
        errors.push(`Batch game fetch failed: ${String(err)}`);
      }
    } else {
      log('Strategy 2: omni-search also returned 0 IDs');
    }
  }

  // Strategy 3: sorted game lists
  log('=== Strategy 3: sorted game lists ===');
  try {
    const sortTokens = await getGameSortTokens();
    for (const token of sortTokens.slice(0, 3)) {
      try {
        const results = await fetchSortedGames(token, 50);
        allGames.push(...results);
      } catch (err) {
        log(`Sorted games token="${token}" threw: ${String(err)}`);
      }
    }
  } catch (err) {
    log(`getGameSortTokens threw: ${String(err)}`);
    errors.push(`Sort fetch failed: ${String(err)}`);
  }

  // Strategy 4: hardcoded popular universe IDs as last resort
  if (allGames.length === 0) {
    log('=== Strategy 4: hardcoded popular game IDs fallback ===');
    // Well-known active Roblox games across genres
    const knownUniverseIds = [
      65241, 142823291, 189707, 292439477, 301549746, 13822889,
      379614936, 537413528, 457405969, 2753915549, 16732694,
      114932368, 189707, 3956818381, 67084534, 2414851778,
      920587237, 4872321990, 2809202155, 3260590327,
      1224212277, 4922741943, 2474168535, 1537690962,
      3597769786, 4915797882, 3732024327, 2337178604,
      5765085497, 5174755280, 4490140083, 5370651063,
      2788229376, 5036010510, 3244313910, 4664500732,
    ];
    try {
      const details = await fetchGamesByIds(knownUniverseIds);
      allGames.push(...details);
      log(`Strategy 4 total: ${details.length} games from hardcoded IDs`);
    } catch (err) {
      log(`Strategy 4 threw: ${String(err)}`);
      errors.push(`Hardcoded ID fetch failed: ${String(err)}`);
    }
  }

  log(`Total games from all strategies: ${allGames.length}`);
  return allGames;
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
      log(`Enriched: ${game.name} (score=${score}, playing=${game.playing})`);

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
