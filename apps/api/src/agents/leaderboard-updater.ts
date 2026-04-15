import { PrismaClient } from '@prisma/client';

/**
 * LeaderboardUpdaterAgent
 *
 * Runs daily at 8am UTC. Fetches top 100 Roblox games,
 * calculates DevEx estimates, updates Leaderboard table,
 * and tracks week-over-week concurrent player change.
 *
 * Working Roblox API endpoints (verified April 2026):
 *   - catalog.roblox.com/v1/search/items             ✅
 *   - apis.roblox.com/universes/v1/places/{id}/universe ✅
 *   - games.roblox.com/v1/games?universeIds=          ✅
 *   - apis.roblox.com/explore-api/v1/get-sorts        ✅
 *   - thumbnails.roblox.com/v1/games/icons             ✅
 */

const FETCH_TIMEOUT_MS = 10_000;

function log(msg: string) {
  console.log(`[LeaderboardUpdater] ${msg}`);
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Roblox API timeout: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Types ──────────────────────────────────────────────────

interface RobloxGameData {
  id: number;
  rootPlaceId: number;
  name: string;
  playing: number;
  visits: number;
  created: string;
  updated: string;
  creator: { id: number; name: string; type: string };
  genre?: string;
}

// ─── Roblox API Helpers ──────────────────────────────────────

async function getExploreSortUniverseIds(): Promise<number[]> {
  const url = 'https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=leaderboard-updater';
  const res = await fetchWithTimeout(url);
  if (!res.ok) return [];

  const data = (await res.json()) as {
    sorts?: Array<{
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
    for (const game of sort.games ?? []) {
      if (game.universeId) universeIds.push(game.universeId);
    }
    for (const gs of sort.topicLayoutData?.gameSetData ?? []) {
      for (const game of gs.games ?? []) {
        if (game.universeId) universeIds.push(game.universeId);
      }
    }
  }
  return universeIds;
}

async function catalogSearch(keyword: string, limit = 30): Promise<number[]> {
  const url = `https://catalog.roblox.com/v1/search/items?category=Game&keyword=${encodeURIComponent(keyword)}&limit=${Math.min(limit, 30)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: Array<{ id: number }> };
  return (data.data ?? []).map((item) => item.id);
}

async function placeToUniverse(placeId: number): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
    if (!res.ok) return null;
    const data = (await res.json()) as { universeId?: number };
    return data.universeId ?? null;
  } catch {
    return null;
  }
}

async function placesToUniverses(placeIds: number[]): Promise<number[]> {
  const universeIds: number[] = [];
  for (let i = 0; i < placeIds.length; i += 10) {
    const batch = placeIds.slice(i, i + 10);
    const results = await Promise.all(batch.map((id) => placeToUniverse(id)));
    for (const uid of results) {
      if (uid !== null) universeIds.push(uid);
    }
  }
  return universeIds;
}

async function fetchGamesByIds(universeIds: number[]): Promise<RobloxGameData[]> {
  if (universeIds.length === 0) return [];
  const allGames: RobloxGameData[] = [];

  for (let i = 0; i < universeIds.length; i += 50) {
    const batch = universeIds.slice(i, i + 50);
    const url = `https://games.roblox.com/v1/games?universeIds=${batch.join(',')}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) continue;
    const data = (await res.json()) as { data?: RobloxGameData[] };
    allGames.push(...(data.data ?? []));
  }
  return allGames;
}

async function fetchThumbnails(universeIds: number[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (universeIds.length === 0) return map;

  for (let i = 0; i < universeIds.length; i += 50) {
    const batch = universeIds.slice(i, i + 50);
    const url = `https://thumbnails.roblox.com/v1/games/icons?universeIds=${batch.join(',')}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`;
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        data?: Array<{ targetId: number; imageUrl?: string }>;
      };
      for (const item of data.data ?? []) {
        if (item.imageUrl) map[String(item.targetId)] = item.imageUrl;
      }
    } catch {
      // continue without thumbnails
    }
  }
  return map;
}

// DevEx calculation: concurrent x 30 days x 0.5 R$ per player per day x 0.0035 USD per R$
function calcMonthlyDevEx(concurrent: number): number {
  return Math.round(concurrent * 30 * 0.5 * 0.0035 * 100) / 100;
}

// ─── Main Pipeline ──────────────────────────────────────────

export interface LeaderboardUpdaterResult {
  gamesUpdated: number;
  gamesScanned: number;
  errors: string[];
}

export async function runLeaderboardUpdaterPipeline(
  db: PrismaClient
): Promise<LeaderboardUpdaterResult> {
  const errors: string[] = [];
  log('Starting leaderboard update...');

  // 1. Gather universe IDs from multiple sources
  const keywords = ['simulator', 'tycoon', 'obby', 'roleplay', 'horror', 'fps', 'racing', 'rpg', 'adventure', 'fighting'];

  let exploreIds: number[] = [];
  try {
    exploreIds = await getExploreSortUniverseIds();
    log(`Explore sorts: ${exploreIds.length} universe IDs`);
  } catch (err) {
    errors.push(`Explore sorts failed: ${err}`);
  }

  const catalogPlaceIds: number[] = [];
  for (const keyword of keywords) {
    try {
      const ids = await catalogSearch(keyword);
      catalogPlaceIds.push(...ids);
    } catch (err) {
      errors.push(`Catalog search "${keyword}" failed: ${err}`);
    }
  }

  let catalogUniverseIds: number[] = [];
  try {
    catalogUniverseIds = await placesToUniverses(catalogPlaceIds);
    log(`Catalog search: ${catalogPlaceIds.length} place IDs → ${catalogUniverseIds.length} universe IDs`);
  } catch (err) {
    errors.push(`Place→Universe conversion failed: ${err}`);
  }

  const allUniverseIds = [...new Set([...exploreIds, ...catalogUniverseIds])];
  log(`Total unique universe IDs: ${allUniverseIds.length}`);

  // 2. Fetch full game details
  let games: RobloxGameData[] = [];
  try {
    games = await fetchGamesByIds(allUniverseIds);
    log(`Fetched details for ${games.length} games`);
  } catch (err) {
    errors.push(`Game details fetch failed: ${err}`);
    return { gamesUpdated: 0, gamesScanned: allUniverseIds.length, errors };
  }

  // 3. Fetch thumbnails
  const thumbnails = await fetchThumbnails(games.map((g) => g.id));

  // 4. Sort by concurrent players, take top 100
  const top100 = games
    .filter((g) => g.playing > 0)
    .sort((a, b) => b.playing - a.playing)
    .slice(0, 100);

  log(`Top 100 games selected (highest concurrent: ${top100[0]?.playing ?? 0})`);

  // 5. Get previous week's data for WoW change calculation
  const existingEntries = await db.leaderboard.findMany();
  const prevMap = new Map(existingEntries.map((e) => [e.universeId, e]));

  // 6. Upsert all entries
  let gamesUpdated = 0;
  for (let i = 0; i < top100.length; i++) {
    const game = top100[i];
    const universeId = String(game.id);
    const prev = prevMap.get(universeId);
    const prevConcurrent = prev?.concurrentPlayers ?? game.playing;
    const weekOverWeekChange = prevConcurrent > 0
      ? (game.playing - prevConcurrent) / prevConcurrent
      : 0;

    try {
      await db.leaderboard.upsert({
        where: { universeId },
        create: {
          universeId,
          gameName: game.name,
          creatorName: game.creator?.name ?? 'Unknown',
          thumbnailUrl: thumbnails[universeId] ?? null,
          concurrentPlayers: game.playing,
          totalVisits: game.visits,
          estimatedMonthlyDevEx: calcMonthlyDevEx(game.playing),
          genre: game.genre ?? 'Adventure',
          weekOverWeekChange,
          rank: i + 1,
        },
        update: {
          gameName: game.name,
          creatorName: game.creator?.name ?? 'Unknown',
          thumbnailUrl: thumbnails[universeId] ?? null,
          concurrentPlayers: game.playing,
          totalVisits: game.visits,
          estimatedMonthlyDevEx: calcMonthlyDevEx(game.playing),
          genre: game.genre ?? 'Adventure',
          weekOverWeekChange,
          rank: i + 1,
        },
      });
      gamesUpdated++;
    } catch (err) {
      errors.push(`Upsert failed for ${game.name}: ${err}`);
    }
  }

  // 7. Remove games that fell out of top 100
  const top100Ids = new Set(top100.map((g) => String(g.id)));
  const toRemove = existingEntries.filter((e) => !top100Ids.has(e.universeId));
  if (toRemove.length > 0) {
    await db.leaderboard.deleteMany({
      where: { universeId: { in: toRemove.map((e) => e.universeId) } },
    });
    log(`Removed ${toRemove.length} games that fell out of top 100`);
  }

  log(`Done — ${gamesUpdated} games updated, ${errors.length} errors`);
  return { gamesUpdated, gamesScanned: allUniverseIds.length, errors };
}
