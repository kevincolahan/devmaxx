import { PrismaClient } from '@prisma/client';

const ROBLOX_BASE = 'https://apis.roblox.com';
const ROBLOX_AUTH = 'https://apis.roblox.com/oauth/v1/token';

// ─── Timeout-aware fetch ─────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000; // 10 seconds

async function fetchWithTimeout(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Roblox API timeout after ${FETCH_TIMEOUT_MS}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Types ───────────────────────────────────────────────────

interface RobloxMetrics {
  dau: number;
  mau: number;
  concurrentPeak: number;
  avgSessionSec: number;
  retentionD1: number;
  retentionD7: number;
  retentionD30: number;
  robuxEarned: number;
  newPlayers: number;
  returningPlayers: number;
  topItems: Record<string, number>;
  visitSources: Record<string, number>;
}

interface CompetitorMetrics {
  concurrent: number;
  rating: number;
  name: string;
}

// ─── Token Refresh ───────────────────────────────────────────

export async function refreshAccessToken(
  creatorId: string,
  db: PrismaClient
): Promise<string> {
  const creator = await db.creator.findUniqueOrThrow({
    where: { id: creatorId },
  });

  if (!creator.robloxAccessToken || !creator.robloxRefreshToken) {
    throw new Error(`No Roblox tokens stored for creator ${creatorId}. User must connect Roblox first.`);
  }

  const expiresAt = creator.robloxTokenExpiresAt?.getTime() ?? 0;
  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;

  if (expiresAt > fiveMinutesFromNow) {
    return creator.robloxAccessToken;
  }

  const res = await fetchWithTimeout(ROBLOX_AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creator.robloxRefreshToken,
      client_id: process.env.ROBLOX_OAUTH_CLIENT_ID!,
      client_secret: process.env.ROBLOX_OAUTH_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Roblox token refresh failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);

  await db.creator.update({
    where: { id: creatorId },
    data: {
      robloxAccessToken: data.access_token,
      robloxRefreshToken: data.refresh_token,
      robloxTokenExpiresAt: newExpiresAt,
    },
  });

  return data.access_token;
}

// ─── Analytics ───────────────────────────────────────────────
//
// Strategy: Try Open Cloud analytics API with API key first.
// If that fails (permissions, wrong endpoint), fall back to
// the public games.roblox.com API for basic stats.

export async function fetchGameAnalytics(
  universeId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<RobloxMetrics> {
  console.log(`[Roblox] fetchGameAnalytics universeId=${universeId} range=${startDate}..${endDate}`);

  // Try Open Cloud analytics with API key (from env)
  const apiKey = (process.env.ROBLOX_OPEN_CLOUD_API_KEY || '').trim();

  if (apiKey) {
    try {
      const result = await fetchAnalyticsOpenCloud(universeId, apiKey, startDate, endDate);
      console.log(`[Roblox] Open Cloud analytics success — DAU: ${result.dau}`);
      return result;
    } catch (err) {
      console.log(`[Roblox] Open Cloud analytics failed: ${err} — falling back to public API`);
    }
  } else {
    console.log(`[Roblox] No ROBLOX_OPEN_CLOUD_API_KEY — using public API fallback`);
  }

  // Fallback: public games.roblox.com API (no auth needed, limited data)
  return fetchAnalyticsPublicApi(universeId);
}

async function fetchAnalyticsOpenCloud(
  universeId: string,
  apiKey: string,
  startDate: string,
  endDate: string
): Promise<RobloxMetrics> {
  const headers = { 'x-api-key': apiKey };
  const analyticsUrl = `${ROBLOX_BASE}/cloud/v2/universes/${universeId}/analytics-service/v1/metrics`;

  console.log(`[Roblox] Open Cloud URL: ${analyticsUrl}`);
  console.log(`[Roblox] Auth: x-api-key (${apiKey.length} chars)`);

  const [dauRes, revenueRes, retentionRes] = await Promise.all([
    fetchWithTimeout(`${analyticsUrl}?metric=DAU&startDate=${startDate}&endDate=${endDate}`, { headers }),
    fetchWithTimeout(`${analyticsUrl}?metric=Revenue&startDate=${startDate}&endDate=${endDate}`, { headers }),
    fetchWithTimeout(`${analyticsUrl}?metric=Retention&startDate=${startDate}&endDate=${endDate}`, { headers }),
  ]);

  // Log response details
  const dauBody = await dauRes.text();
  const revenueBody = await revenueRes.text();
  const retentionBody = await retentionRes.text();

  console.log(`[Roblox] DAU response: ${dauRes.status} — ${dauBody.slice(0, 200)}`);
  console.log(`[Roblox] Revenue response: ${revenueRes.status} — ${revenueBody.slice(0, 200)}`);
  console.log(`[Roblox] Retention response: ${retentionRes.status} — ${retentionBody.slice(0, 200)}`);

  if (!dauRes.ok || !revenueRes.ok || !retentionRes.ok) {
    throw new Error(`Open Cloud analytics returned errors: DAU=${dauRes.status} Revenue=${revenueRes.status} Retention=${retentionRes.status}`);
  }

  const dauData = JSON.parse(dauBody) as Record<string, unknown>;
  const revenueData = JSON.parse(revenueBody) as Record<string, unknown>;
  const retentionData = JSON.parse(retentionBody) as Record<string, unknown>;

  const dauValues = extractMetricValues(dauData, 'DAU');
  const concurrentValues = extractMetricValues(dauData, 'ConcurrentPeak');
  const sessionValues = extractMetricValues(dauData, 'AvgSessionLength');
  const mauValues = extractMetricValues(dauData, 'MAU');
  const newPlayerValues = extractMetricValues(dauData, 'NewUsers');
  const returningValues = extractMetricValues(dauData, 'ReturningUsers');
  const revenueValues = extractMetricValues(revenueData, 'Revenue');
  const retD1 = extractMetricValues(retentionData, 'D1Retention');
  const retD7 = extractMetricValues(retentionData, 'D7Retention');
  const retD30 = extractMetricValues(retentionData, 'D30Retention');

  // Fetch top items
  const itemsRes = await fetchWithTimeout(
    `${ROBLOX_BASE}/cloud/v2/universes/${universeId}/economy/developer-products?maxPageSize=10`,
    { headers }
  );
  const topItems: Record<string, number> = {};
  if (itemsRes.ok) {
    const itemsData = (await itemsRes.json()) as { developerProducts?: Array<{ displayName: string; priceInRobux: number }> };
    for (const item of itemsData.developerProducts ?? []) {
      topItems[item.displayName] = item.priceInRobux;
    }
  }

  return {
    dau: average(dauValues),
    mau: last(mauValues),
    concurrentPeak: max(concurrentValues),
    avgSessionSec: average(sessionValues),
    retentionD1: averageFloat(retD1),
    retentionD7: averageFloat(retD7),
    retentionD30: averageFloat(retD30),
    robuxEarned: sum(revenueValues),
    newPlayers: sum(newPlayerValues),
    returningPlayers: sum(returningValues),
    topItems,
    visitSources: {},
  };
}

async function fetchAnalyticsPublicApi(universeId: string): Promise<RobloxMetrics> {
  console.log(`[Roblox] Using public API fallback for universe ${universeId}`);

  const url = `https://games.roblox.com/v1/games?universeIds=${universeId}`;
  console.log(`[Roblox] Public API URL: ${url}`);

  const res = await fetchWithTimeout(url);
  const body = await res.text();
  console.log(`[Roblox] Public API response: ${res.status} — ${body.slice(0, 300)}`);

  if (!res.ok) {
    throw new Error(`Public games API failed: ${res.status} — ${body.slice(0, 200)}`);
  }

  const data = JSON.parse(body) as {
    data?: Array<{
      id: number;
      name: string;
      playing: number;
      visits: number;
      favoritedCount: number;
      created: string;
      updated: string;
    }>;
  };

  const game = data.data?.[0];
  if (!game) {
    throw new Error(`No game data returned for universe ${universeId}`);
  }

  console.log(`[Roblox] Public API: ${game.name} — playing: ${game.playing}, visits: ${game.visits}`);

  // Estimate metrics from public data
  const concurrent = game.playing;
  const estimatedDau = Math.round(concurrent * 4.5); // rough multiplier
  const estimatedRevenue = Math.round(concurrent * 0.5); // R$ per player per day estimate

  return {
    dau: estimatedDau,
    mau: Math.round(estimatedDau * 8), // rough MAU estimate
    concurrentPeak: concurrent,
    avgSessionSec: 720, // default 12 min
    retentionD1: 0.25, // default estimates
    retentionD7: 0.12,
    retentionD30: 0.05,
    robuxEarned: estimatedRevenue,
    newPlayers: Math.round(estimatedDau * 0.3),
    returningPlayers: Math.round(estimatedDau * 0.7),
    topItems: {},
    visitSources: {},
  };
}

// ─── Competitor Data ─────────────────────────────────────────

export async function fetchCompetitorData(
  universeId: string,
  apiKey: string
): Promise<CompetitorMetrics> {
  const headers = { 'x-api-key': apiKey };

  const gameRes = await fetchWithTimeout(
    `${ROBLOX_BASE}/cloud/v2/universes/${universeId}`,
    { headers }
  );

  if (!gameRes.ok) {
    throw new Error(`Failed to fetch competitor ${universeId}: ${gameRes.status}`);
  }

  const gameData = (await gameRes.json()) as {
    displayName?: string;
    playing?: number;
    visits?: number;
  };

  const name = gameData.displayName ?? `Universe ${universeId}`;
  const concurrent = gameData.playing ?? 0;

  const votesRes = await fetchWithTimeout(
    `${ROBLOX_BASE}/cloud/v2/universes/${universeId}/votes`,
    { headers }
  );
  let rating = 0;
  if (votesRes.ok) {
    const votesData = (await votesRes.json()) as { upVotes?: number; downVotes?: number };
    const up = votesData.upVotes ?? 0;
    const down = votesData.downVotes ?? 0;
    rating = up + down > 0 ? up / (up + down) : 0;
  }

  return { concurrent, rating, name };
}

// ─── Products & Game Passes ──────────────────────────────────

export interface DeveloperProduct {
  id: string;
  displayName: string;
  description: string;
  priceInRobux: number;
  iconImageAssetId?: string;
}

export interface GamePass {
  id: string;
  displayName: string;
  description: string;
  priceInRobux: number;
  iconImageAssetId?: string;
}

export async function fetchDeveloperProducts(
  universeId: string,
  accessToken: string
): Promise<DeveloperProduct[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const products: DeveloperProduct[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${ROBLOX_BASE}/cloud/v2/universes/${universeId}/economy/developer-products`);
    url.searchParams.set('maxPageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetchWithTimeout(url.toString(), { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch developer products: ${res.status}`);
    }

    const data = (await res.json()) as {
      developerProducts?: DeveloperProduct[];
      nextPageToken?: string;
    };

    for (const p of data.developerProducts ?? []) {
      products.push(p);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return products;
}

export async function fetchGamePasses(
  universeId: string,
  accessToken: string
): Promise<GamePass[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  const res = await fetchWithTimeout(
    `${ROBLOX_BASE}/cloud/v2/universes/${universeId}/game-passes?maxPageSize=100`,
    { headers }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch game passes: ${res.status}`);
  }

  const data = (await res.json()) as {
    gamePasses?: GamePass[];
  };

  return data.gamePasses ?? [];
}

export async function updateProductPrice(
  universeId: string,
  productId: string,
  newPrice: number,
  accessToken: string
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const res = await fetchWithTimeout(
    `${ROBLOX_BASE}/cloud/v2/universes/${universeId}/economy/developer-products/${productId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ priceInRobux: newPrice }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update product price: ${res.status} — ${text}`);
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function extractMetricValues(data: Record<string, unknown>, metric: string): number[] {
  const dataPoints = (data as Record<string, unknown[]>).dataPoints ?? [];
  return dataPoints
    .filter((dp: unknown) => (dp as Record<string, string>).metric === metric || dataPoints.length > 0)
    .map((dp: unknown) => Number((dp as Record<string, unknown>).value ?? 0));
}

function extractVisitSources(data: Record<string, unknown>): Record<string, number> {
  const sources: Record<string, number> = {};
  const dataPoints = (data as Record<string, unknown[]>).dataPoints ?? [];
  for (const dp of dataPoints) {
    const typed = dp as Record<string, unknown>;
    const source = String(typed.source ?? typed.label ?? 'unknown');
    sources[source] = (sources[source] ?? 0) + Number(typed.value ?? 0);
  }
  return sources;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function averageFloat(values: number[]): number {
  if (values.length === 0) return 0;
  return parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(4));
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function max(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

function last(values: number[]): number {
  return values.length > 0 ? values[values.length - 1] : 0;
}
