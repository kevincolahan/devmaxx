import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentContext, AgentResult } from '../lib/base-agent';
import { fetchGameAnalytics, refreshAccessToken } from '../lib/roblox';

interface MetricsInput {
  robloxGameId: string;
  universeId: string;
  gameName: string;
}

interface Anomaly {
  metric: string;
  current: number;
  previous: number;
  changePercent: number;
  direction: 'up' | 'down';
}

interface BenchmarkComparison {
  metric: string;
  yours: number;
  genreAvg: number;
  top10Pct: number;
  verdict: string;
}

interface AnalysisOutput {
  summary: string;
  anomalies: Anomaly[];
  benchmarks: BenchmarkComparison[];
  healthScore: number;
  recommendations: string[];
}

// ─── Genre Benchmark Data ───────────────────────────────────
// Based on aggregated Roblox analytics across game categories.
// Source: Public Roblox developer community data + DevEx reports.

interface GenreBenchmarks {
  retentionD1: { avg: number; top10: number };
  retentionD7: { avg: number; top10: number };
  retentionD30: { avg: number; top10: number };
  avgSessionSec: { avg: number; top10: number };
  dauToMau: { avg: number; top10: number };
  robuxPerDau: { avg: number; top10: number };
}

const GENRE_BENCHMARKS: Record<string, GenreBenchmarks> = {
  obby: {
    retentionD1: { avg: 0.25, top10: 0.42 },
    retentionD7: { avg: 0.10, top10: 0.22 },
    retentionD30: { avg: 0.04, top10: 0.12 },
    avgSessionSec: { avg: 480, top10: 900 },
    dauToMau: { avg: 0.12, top10: 0.25 },
    robuxPerDau: { avg: 0.8, top10: 2.5 },
  },
  rpg: {
    retentionD1: { avg: 0.30, top10: 0.50 },
    retentionD7: { avg: 0.15, top10: 0.32 },
    retentionD30: { avg: 0.06, top10: 0.18 },
    avgSessionSec: { avg: 900, top10: 1800 },
    dauToMau: { avg: 0.18, top10: 0.35 },
    robuxPerDau: { avg: 1.5, top10: 4.0 },
  },
  simulator: {
    retentionD1: { avg: 0.28, top10: 0.48 },
    retentionD7: { avg: 0.12, top10: 0.28 },
    retentionD30: { avg: 0.05, top10: 0.15 },
    avgSessionSec: { avg: 720, top10: 1500 },
    dauToMau: { avg: 0.15, top10: 0.30 },
    robuxPerDau: { avg: 1.2, top10: 3.5 },
  },
  tycoon: {
    retentionD1: { avg: 0.32, top10: 0.52 },
    retentionD7: { avg: 0.14, top10: 0.30 },
    retentionD30: { avg: 0.06, top10: 0.16 },
    avgSessionSec: { avg: 840, top10: 1600 },
    dauToMau: { avg: 0.16, top10: 0.32 },
    robuxPerDau: { avg: 1.4, top10: 3.8 },
  },
  fps: {
    retentionD1: { avg: 0.22, top10: 0.40 },
    retentionD7: { avg: 0.08, top10: 0.20 },
    retentionD30: { avg: 0.03, top10: 0.10 },
    avgSessionSec: { avg: 600, top10: 1200 },
    dauToMau: { avg: 0.10, top10: 0.22 },
    robuxPerDau: { avg: 0.6, top10: 2.0 },
  },
  horror: {
    retentionD1: { avg: 0.20, top10: 0.38 },
    retentionD7: { avg: 0.07, top10: 0.18 },
    retentionD30: { avg: 0.02, top10: 0.08 },
    avgSessionSec: { avg: 540, top10: 1100 },
    dauToMau: { avg: 0.08, top10: 0.18 },
    robuxPerDau: { avg: 0.5, top10: 1.8 },
  },
  roleplay: {
    retentionD1: { avg: 0.35, top10: 0.55 },
    retentionD7: { avg: 0.18, top10: 0.35 },
    retentionD30: { avg: 0.08, top10: 0.20 },
    avgSessionSec: { avg: 1200, top10: 2400 },
    dauToMau: { avg: 0.20, top10: 0.38 },
    robuxPerDau: { avg: 1.8, top10: 5.0 },
  },
  adventure: {
    retentionD1: { avg: 0.26, top10: 0.44 },
    retentionD7: { avg: 0.11, top10: 0.24 },
    retentionD30: { avg: 0.04, top10: 0.13 },
    avgSessionSec: { avg: 660, top10: 1300 },
    dauToMau: { avg: 0.13, top10: 0.27 },
    robuxPerDau: { avg: 1.0, top10: 3.0 },
  },
  default: {
    retentionD1: { avg: 0.27, top10: 0.45 },
    retentionD7: { avg: 0.12, top10: 0.25 },
    retentionD30: { avg: 0.05, top10: 0.14 },
    avgSessionSec: { avg: 720, top10: 1400 },
    dauToMau: { avg: 0.14, top10: 0.28 },
    robuxPerDau: { avg: 1.1, top10: 3.2 },
  },
};

function getBenchmarksForGenre(genres: string[]): GenreBenchmarks {
  const primaryGenre = (genres[0] || '').toLowerCase();
  return GENRE_BENCHMARKS[primaryGenre] ?? GENRE_BENCHMARKS.default;
}

export class MetricsMonitorAgent extends BaseAgent {
  constructor() {
    super('MetricsMonitorAgent');
  }

  buildSystemPrompt(_ctx: AgentContext): string {
    return `You are a Roblox game analytics expert working for Devmaxx, an AI platform that maximizes DevEx earnings for Roblox creators.

You analyze 7-day metric snapshots, compare them against prior period averages, AND benchmark against genre averages and top-tier thresholds.

Your job:

1. Identify anomalies — any metric that changed more than 15% from prior period
2. Explain WHY each anomaly likely occurred (seasonal, update, competitor, viral moment, etc.)
3. Compare every key metric against genre benchmarks:
   - Show: "Your score" vs "Genre average" vs "Top 10% threshold"
   - Give a clear verdict: "above average", "below average", "top-tier", "needs work"
   - Example: "Your D7 retention (35%) is above the genre average (28%) but below top 10% (52%) — strong but room to reach top-tier."
4. Provide 2-3 actionable recommendations that specifically reference the benchmark gaps
5. Calculate a health score from 0-100 using this formula:
   - Retention weight: 40% (average of D1, D7, D30 normalized to 0-100)
   - DAU trend weight: 30% (positive trend = higher score)
   - Revenue trend weight: 30% (positive trend = higher score)

Respond ONLY with valid JSON in this exact format:
{
  "summary": "One paragraph trend summary with benchmark context",
  "anomalies": [
    {
      "metric": "metric_name",
      "current": 1234,
      "previous": 1000,
      "changePercent": 23.4,
      "direction": "up"
    }
  ],
  "benchmarks": [
    {
      "metric": "D7 Retention",
      "yours": 0.35,
      "genreAvg": 0.28,
      "top10Pct": 0.52,
      "verdict": "Above average — 7pp above genre average but 17pp below top 10%. Focus on onboarding flow to close the gap."
    }
  ],
  "healthScore": 72,
  "recommendations": ["rec1 referencing specific benchmark gaps", "rec2", "rec3"]
}`;
  }

  buildUserPrompt(ctx: AgentContext): string {
    const input = ctx.inputData as unknown as {
      currentMetrics: Record<string, unknown>;
      priorMetrics: Record<string, unknown> | null;
      gameName: string;
      genre: string[];
      benchmarks: GenreBenchmarks;
    };

    let prompt = `Analyze the following 7-day metrics for "${input.gameName}" (genre: ${input.genre.join(', ') || 'unknown'}):\n\n`;
    prompt += `CURRENT PERIOD:\n${JSON.stringify(input.currentMetrics, null, 2)}\n\n`;

    if (input.priorMetrics) {
      prompt += `PRIOR PERIOD (previous 7 days):\n${JSON.stringify(input.priorMetrics, null, 2)}\n\n`;
    } else {
      prompt += `PRIOR PERIOD: No prior data available. This is the first snapshot.\n\n`;
    }

    prompt += `GENRE BENCHMARKS (${input.genre[0] || 'default'}):\n`;
    prompt += `  D1 Retention — genre avg: ${(input.benchmarks.retentionD1.avg * 100).toFixed(0)}%, top 10%: ${(input.benchmarks.retentionD1.top10 * 100).toFixed(0)}%\n`;
    prompt += `  D7 Retention — genre avg: ${(input.benchmarks.retentionD7.avg * 100).toFixed(0)}%, top 10%: ${(input.benchmarks.retentionD7.top10 * 100).toFixed(0)}%\n`;
    prompt += `  D30 Retention — genre avg: ${(input.benchmarks.retentionD30.avg * 100).toFixed(0)}%, top 10%: ${(input.benchmarks.retentionD30.top10 * 100).toFixed(0)}%\n`;
    prompt += `  Avg Session — genre avg: ${input.benchmarks.avgSessionSec.avg}s, top 10%: ${input.benchmarks.avgSessionSec.top10}s\n`;
    prompt += `  DAU/MAU Ratio — genre avg: ${(input.benchmarks.dauToMau.avg * 100).toFixed(0)}%, top 10%: ${(input.benchmarks.dauToMau.top10 * 100).toFixed(0)}%\n`;
    prompt += `  Robux/DAU — genre avg: ${input.benchmarks.robuxPerDau.avg}, top 10%: ${input.benchmarks.robuxPerDau.top10}\n\n`;

    prompt += `Compare each metric against genre benchmarks. Identify anomalies (>15% change) and provide recommendations that reference specific benchmark gaps.`;
    return prompt;
  }

  async parseResponse(r: Anthropic.Message, _ctx: AgentContext): Promise<AgentResult> {
    const text = r.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let analysis: AnalysisOutput;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      analysis = JSON.parse(jsonMatch[0]) as AnalysisOutput;
    } catch {
      return {
        action: 'analysis_failed',
        output: { error: 'Failed to parse Claude analysis', rawResponse: text },
        status: 'failed',
      };
    }

    const robuxImpact = analysis.anomalies
      .filter((a) => a.metric.toLowerCase().includes('robux') || a.metric.toLowerCase().includes('revenue'))
      .reduce((sum, a) => sum + Math.round(a.current - a.previous), 0);

    return {
      action: analysis.anomalies.length > 0 ? 'anomalies_detected' : 'metrics_normal',
      output: {
        summary: analysis.summary,
        anomalies: analysis.anomalies,
        benchmarks: analysis.benchmarks ?? [],
        healthScore: Math.max(0, Math.min(100, analysis.healthScore)),
        recommendations: analysis.recommendations,
      },
      robuxImpact,
      status: 'success',
    };
  }

  async executeActions(result: AgentResult, ctx: AgentContext): Promise<void> {
    if (!ctx.gameId) return;

    const output = result.output as unknown as AnalysisOutput;

    await ctx.db.game.update({
      where: { id: ctx.gameId },
      data: { healthScore: output.healthScore },
    });
  }

  async runFullPipeline(
    creatorId: string,
    gameId: string,
    input: MetricsInput,
    db: import('@prisma/client').PrismaClient
  ): Promise<AgentResult> {
    const accessToken = await refreshAccessToken(creatorId, db);

    // Get game genre for benchmarks
    const game = await db.game.findUnique({ where: { id: gameId } });
    const genres = game?.genre ?? [];
    const benchmarks = getBenchmarksForGenre(genres);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const startDate = sevenDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];
    const priorStart = fourteenDaysAgo.toISOString().split('T')[0];
    const priorEnd = startDate;

    const currentMetrics = await fetchGameAnalytics(
      input.universeId,
      accessToken,
      startDate,
      endDate
    );

    await db.metricSnapshot.create({
      data: {
        gameId,
        date: now,
        dau: currentMetrics.dau,
        mau: currentMetrics.mau,
        concurrentPeak: currentMetrics.concurrentPeak,
        avgSessionSec: currentMetrics.avgSessionSec,
        retentionD1: currentMetrics.retentionD1,
        retentionD7: currentMetrics.retentionD7,
        retentionD30: currentMetrics.retentionD30,
        robuxEarned: currentMetrics.robuxEarned,
        newPlayers: currentMetrics.newPlayers,
        returningPlayers: currentMetrics.returningPlayers,
        topItems: currentMetrics.topItems,
        visitSources: currentMetrics.visitSources,
      },
    });

    let priorMetrics: Record<string, unknown> | null = null;
    try {
      const priorData = await fetchGameAnalytics(
        input.universeId,
        accessToken,
        priorStart,
        priorEnd
      );
      priorMetrics = priorData as unknown as Record<string, unknown>;
    } catch {
      // First run — no prior data available
    }

    const context: AgentContext = {
      creatorId,
      gameId,
      inputData: {
        currentMetrics: currentMetrics as unknown as Record<string, unknown>,
        priorMetrics,
        gameName: input.gameName,
        genre: genres,
        benchmarks,
      },
      db,
    };

    return this.run(context);
  }
}
