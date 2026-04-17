import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

// ─── Seasonal Calendar ──────────────────────────────────────

interface SeasonalFactor {
  name: string;
  months: number[];
  multiplier: number;
  genres: string[];
}

const SEASONAL_FACTORS: SeasonalFactor[] = [
  { name: 'Summer Break', months: [6, 7, 8], multiplier: 1.25, genres: ['all'] },
  { name: 'Back to School', months: [9], multiplier: 0.85, genres: ['all'] },
  { name: 'Halloween', months: [10], multiplier: 1.40, genres: ['horror', 'adventure', 'rpg'] },
  { name: 'Halloween', months: [10], multiplier: 1.20, genres: ['all'] },
  { name: 'Thanksgiving', months: [11], multiplier: 1.15, genres: ['all'] },
  { name: 'Christmas/Holiday', months: [12], multiplier: 1.55, genres: ['all'] },
  { name: 'New Year', months: [1], multiplier: 1.10, genres: ['all'] },
  { name: 'Spring Break', months: [3, 4], multiplier: 1.15, genres: ['all'] },
];

function getActiveSeasonalFactors(genres: string[]): { current: SeasonalFactor[]; upcoming: SeasonalFactor[] } {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

  const matchesGenre = (factor: SeasonalFactor) =>
    factor.genres.includes('all') || factor.genres.some((g) => genres.includes(g));

  const current = SEASONAL_FACTORS.filter(
    (f) => f.months.includes(currentMonth) && matchesGenre(f)
  );

  const upcoming = SEASONAL_FACTORS.filter(
    (f) => f.months.includes(nextMonth) && matchesGenre(f) && !f.months.includes(currentMonth)
  );

  return { current, upcoming };
}

// ─── Forecast Generation ────────────────────────────────────

interface ForecastOutput {
  next30DaysRobux: number;
  next90DaysRobux: number;
  projectedDevExUSD: number;
  upsideRobux: number;
  upsideReason: string;
  downsideRobux: number;
  downsideReason: string;
  assumptions: string[];
  keyInsight: string;
  actionToImprove: string;
}

export async function runRevenueForecastPipeline(
  creatorId: string,
  gameId: string,
  db: PrismaClient
): Promise<{
  forecast: ForecastOutput;
  seasonalAlerts: string[];
}> {
  const game = await db.game.findUniqueOrThrow({ where: { id: gameId } });
  const genres = game.genre.map((g) => g.toLowerCase());

  // Get last 90 days of snapshots
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const snapshots = await db.metricSnapshot.findMany({
    where: { gameId, date: { gte: ninetyDaysAgo } },
    orderBy: { date: 'asc' },
  });

  // Get recent agent recommendations
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentRuns = await db.agentRun.findMany({
    where: { creatorId, gameId, createdAt: { gte: thirtyDaysAgo }, robuxImpact: { gt: 0 } },
    select: { agentName: true, action: true, robuxImpact: true, actualRobuxImpact: true },
    take: 10,
  });

  // Calculate trends
  const last30 = snapshots.filter((s) => s.date >= thirtyDaysAgo);
  const prior30 = snapshots.filter((s) => s.date < thirtyDaysAgo && s.date >= new Date(Date.now() - 60 * 24 * 60 * 60 * 1000));

  const last30Revenue = last30.reduce((s, m) => s + m.robuxEarned, 0);
  const prior30Revenue = prior30.reduce((s, m) => s + m.robuxEarned, 0);
  const avgDau = last30.length > 0 ? Math.round(last30.reduce((s, m) => s + m.dau, 0) / last30.length) : 0;
  const avgRetentionD7 = last30.length > 0 ? last30.reduce((s, m) => s + m.retentionD7, 0) / last30.length : 0;

  // Seasonal factors
  const seasonal = getActiveSeasonalFactors(genres);
  const seasonalAlerts: string[] = [];

  for (const factor of seasonal.upcoming) {
    const weeksUntil = Math.ceil((new Date(new Date().getFullYear(), factor.months[0] - 1, 1).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000));
    if (weeksUntil > 0 && weeksUntil <= 6) {
      const pctChange = Math.round((factor.multiplier - 1) * 100);
      seasonalAlerts.push(`${factor.name} in ${weeksUntil} weeks — historically +${pctChange}% for your genre. Start planning your event now.`);
    }
  }

  // Ask Claude for forecast
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a revenue analyst for Roblox games. Generate a revenue forecast based on historical metrics, trends, and seasonal factors.

DevEx conversion rate: 1 Robux = ~$0.0035 USD

Rules:
- Base case should extrapolate current trends with seasonal adjustment
- Upside case: what happens if the top recommendation is implemented
- Downside case: what happens if current negative trends continue
- Be specific about assumptions
- Reference actual numbers from the data

Respond ONLY with valid JSON:
{
  "next30DaysRobux": 45000,
  "next90DaysRobux": 150000,
  "projectedDevExUSD": 525.0,
  "upsideRobux": 60000,
  "upsideReason": "If pricing optimization is implemented (+33%)",
  "downsideRobux": 35000,
  "downsideReason": "If DAU decline continues at -5%/week",
  "assumptions": ["Current DAU trend: stable at 5200", "D7 retention: 32%"],
  "keyInsight": "Revenue is growing but retention is below genre average",
  "actionToImprove": "Focus on D7 retention — each 1pp improvement = ~800 R$/month"
}`,
    messages: [
      {
        role: 'user',
        content: `Generate a revenue forecast for "${game.name}" (genre: ${genres.join(', ')}).

LAST 30 DAYS:
- Total Robux earned: ${last30Revenue.toLocaleString()}
- Average DAU: ${avgDau}
- Average D7 Retention: ${(avgRetentionD7 * 100).toFixed(1)}%
- Snapshot count: ${last30.length}

PRIOR 30 DAYS:
- Total Robux earned: ${prior30Revenue.toLocaleString()}
- Revenue trend: ${prior30Revenue > 0 ? `${(((last30Revenue - prior30Revenue) / prior30Revenue) * 100).toFixed(1)}%` : 'no prior data'}

RECENT AGENT RECOMMENDATIONS:
${recentRuns.map((r) => `- ${r.agentName}: ${r.action} (estimated: ${r.robuxImpact} R$${r.actualRobuxImpact !== null ? `, actual: ${r.actualRobuxImpact} R$` : ''})`).join('\n') || 'None'}

ACTIVE SEASONAL FACTORS:
${seasonal.current.map((f) => `- ${f.name}: ${Math.round((f.multiplier - 1) * 100)}% typical boost`).join('\n') || 'None currently active'}

UPCOMING SEASONAL FACTORS:
${seasonal.upcoming.map((f) => `- ${f.name}: ${Math.round((f.multiplier - 1) * 100)}% typical boost`).join('\n') || 'None upcoming'}

Generate base, upside, and downside projections.`,
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in forecast response');

  const forecast = JSON.parse(jsonMatch[0]) as ForecastOutput;

  // Store forecast in DB
  await db.revenueForecast.create({
    data: {
      creatorId,
      gameId,
      next30DaysRobux: forecast.next30DaysRobux,
      next90DaysRobux: forecast.next90DaysRobux,
      projectedDevExUSD: forecast.projectedDevExUSD,
      upsideRobux: forecast.upsideRobux,
      downsideRobux: forecast.downsideRobux,
      assumptions: {
        assumptions: forecast.assumptions,
        upsideReason: forecast.upsideReason,
        downsideReason: forecast.downsideReason,
        keyInsight: forecast.keyInsight,
        actionToImprove: forecast.actionToImprove,
      },
      seasonalFactors: {
        current: seasonal.current.map((f) => ({ name: f.name, multiplier: f.multiplier })),
        upcoming: seasonal.upcoming.map((f) => ({ name: f.name, multiplier: f.multiplier })),
        alerts: seasonalAlerts,
      },
    },
  });

  // Log as AgentRun
  await db.agentRun.create({
    data: {
      creatorId,
      agentName: 'RevenueForecastingAgent',
      gameId,
      input: { last30Revenue, avgDau, avgRetentionD7, snapshotCount: snapshots.length } as any,
      output: forecast as any,
      action: 'forecast_generated',
      robuxImpact: 0,
      status: 'success',
    },
  });

  console.log(`[RevenueForecast] ${game.name}: base=${forecast.next30DaysRobux} R$, upside=${forecast.upsideRobux}, downside=${forecast.downsideRobux}`);

  return { forecast, seasonalAlerts };
}
