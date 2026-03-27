import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentContext, AgentResult } from '@devmaxx/agent-core';
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

interface AnalysisOutput {
  summary: string;
  anomalies: Anomaly[];
  healthScore: number;
  recommendations: string[];
}

export class MetricsMonitorAgent extends BaseAgent {
  constructor() {
    super('MetricsMonitorAgent');
  }

  buildSystemPrompt(_ctx: AgentContext): string {
    return `You are a Roblox game analytics expert working for Devmaxx, an AI platform that maximizes DevEx earnings for Roblox creators.

You analyze 7-day metric snapshots and compare them against prior period averages. Your job:

1. Identify anomalies — any metric that changed more than 15% from prior period
2. Explain WHY each anomaly likely occurred (seasonal, update, competitor, viral moment, etc.)
3. Provide 2-3 actionable recommendations to improve or sustain performance
4. Calculate a health score from 0-100 using this formula:
   - Retention weight: 40% (average of D1, D7, D30 normalized to 0-100)
   - DAU trend weight: 30% (positive trend = higher score)
   - Revenue trend weight: 30% (positive trend = higher score)

Respond ONLY with valid JSON in this exact format:
{
  "summary": "One paragraph trend summary",
  "anomalies": [
    {
      "metric": "metric_name",
      "current": 1234,
      "previous": 1000,
      "changePercent": 23.4,
      "direction": "up"
    }
  ],
  "healthScore": 72,
  "recommendations": ["rec1", "rec2", "rec3"]
}`;
  }

  buildUserPrompt(ctx: AgentContext): string {
    const input = ctx.inputData as unknown as {
      currentMetrics: Record<string, unknown>;
      priorMetrics: Record<string, unknown> | null;
      gameName: string;
    };

    let prompt = `Analyze the following 7-day metrics for "${input.gameName}":\n\n`;
    prompt += `CURRENT PERIOD:\n${JSON.stringify(input.currentMetrics, null, 2)}\n\n`;

    if (input.priorMetrics) {
      prompt += `PRIOR PERIOD (previous 7 days):\n${JSON.stringify(input.priorMetrics, null, 2)}\n\n`;
    } else {
      prompt += `PRIOR PERIOD: No prior data available. This is the first snapshot.\n\n`;
    }

    prompt += `Calculate the health score and identify any anomalies (>15% change in any key metric).`;
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
      },
      db,
    };

    return this.run(context);
  }
}
