export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CachedData {
  games: LeaderboardGame[];
  timestamp: number;
}

let cache: CachedData | null = null;

export interface LeaderboardGame {
  rank: number;
  universeId: string;
  name: string;
  creatorName: string;
  playing: number;
  visits: number;
  thumbnailUrl: string;
  genre: string;
  estimatedMonthlyDevEx: number;
  weekOverWeekChange: number;
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

// ─── Roblox API Helpers (same working endpoints as CreatorProspectingAgent) ───

async function getExploreSortUniverseIds(): Promise<number[]> {
  const url = 'https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=leaderboard';
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

async function fetchLeaderboardData(): Promise<LeaderboardGame[]> {
  // 1. Gather universe IDs from explore sorts + catalog searches
  const keywords = ['simulator', 'tycoon', 'obby', 'roleplay', 'horror', 'fps', 'racing', 'rpg'];
  const [exploreIds, ...catalogResults] = await Promise.all([
    getExploreSortUniverseIds(),
    ...keywords.map((kw) => catalogSearch(kw)),
  ]);

  const catalogPlaceIds = catalogResults.flat();
  const catalogUniverseIds = await placesToUniverses(catalogPlaceIds);

  const allUniverseIds = [...new Set([...exploreIds, ...catalogUniverseIds])];

  // 2. Fetch full game details
  const games = await fetchGamesByIds(allUniverseIds);

  // 3. Fetch thumbnails
  const universeIdsForThumbs = games.map((g) => g.id);
  const thumbnails = await fetchThumbnails(universeIdsForThumbs);

  // 4. Sort by concurrent players, take top 50
  const sorted = games
    .filter((g) => g.playing > 0)
    .sort((a, b) => b.playing - a.playing)
    .slice(0, 50);

  // 5. Build leaderboard entries
  return sorted.map((game, idx) => ({
    rank: idx + 1,
    universeId: String(game.id),
    name: game.name,
    creatorName: game.creator?.name ?? 'Unknown',
    playing: game.playing,
    visits: game.visits,
    thumbnailUrl: thumbnails[String(game.id)] ?? '',
    genre: game.genre ?? 'Adventure',
    estimatedMonthlyDevEx: calcMonthlyDevEx(game.playing),
    weekOverWeekChange: 0, // populated by LeaderboardUpdater agent
  }));
}

export async function GET() {
  try {
    // Return cached data if fresh
    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ games: cache.games, cached: true, updatedAt: new Date(cache.timestamp).toISOString() });
    }

    const games = await fetchLeaderboardData();
    cache = { games, timestamp: Date.now() };

    return NextResponse.json({ games, cached: false, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[Leaderboard API] Error:', error);
    // Return stale cache if available
    if (cache) {
      return NextResponse.json({ games: cache.games, cached: true, stale: true, updatedAt: new Date(cache.timestamp).toISOString() });
    }
    return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
  }
}
