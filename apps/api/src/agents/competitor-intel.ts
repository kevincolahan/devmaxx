import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentContext, AgentResult } from '@devmaxx/agent-core';
import { fetchCompetitorData } from '../lib/roblox';

interface CompetitorInput {
  watchingGameId: string;
  watchingGameName: string;
  competitorUniverseIds: string[];
}

interface CompetitorChange {
  name: string;
  robloxGameId: string;
  currentConcurrent: number;
  previousConcurrent: number;
  changePercent: number;
  ratingChange: number;
}

interface AnalysisOutput {
  summary: string;
  materialChanges: CompetitorChange[];
  threats: string[];
  opportunities: string[];
}

export class CompetitorIntelligenceAgent extends BaseAgent {
  constructor() {
    super('CompetitorIntelligenceAgent');
  }

  buildSystemPrompt(_ctx: AgentContext): string {
    return `You are a competitive intelligence analyst for Roblox games, working for Devmaxx.

You analyze competitor player count and rating data to identify material changes that could impact the creator's game.

Your job:
1. Identify material changes — any competitor with >20% change in concurrent players vs prior 7-day average
2. Assess threats — competitors gaining significant ground
3. Identify opportunities — competitors losing players that could be captured
4. Provide strategic recommendations

Respond ONLY with valid JSON in this exact format:
{
  "summary": "One paragraph competitive landscape summary",
  "materialChanges": [
    {
      "name": "Game Name",
      "robloxGameId": "123",
      "currentConcurrent": 5000,
      "previousConcurrent": 3000,
      "changePercent": 66.7,
      "ratingChange": 0.02
    }
  ],
  "threats": ["threat1", "threat2"],
  "opportunities": ["opportunity1", "opportunity2"]
}`;
  }

  buildUserPrompt(ctx: AgentContext): string {
    const input = ctx.inputData as unknown as {
      watchingGameName: string;
      currentSnapshots: Array<{ name: string; robloxGameId: string; concurrent: number; rating: number }>;
      priorSnapshots: Array<{ name: string; robloxGameId: string; avgConcurrent: number; avgRating: number }>;
    };

    let prompt = `Analyze competitor data for "${input.watchingGameName}":\n\n`;
    prompt += `CURRENT COMPETITOR SNAPSHOTS:\n${JSON.stringify(input.currentSnapshots, null, 2)}\n\n`;

    if (input.priorSnapshots.length > 0) {
      prompt += `PRIOR 7-DAY AVERAGES:\n${JSON.stringify(input.priorSnapshots, null, 2)}\n\n`;
    } else {
      prompt += `PRIOR DATA: No prior snapshots. This is the first competitor scan.\n\n`;
    }

    prompt += `Flag any competitor with >20% concurrent player change. Identify threats and opportunities.`;
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

    return {
      action: analysis.materialChanges.length > 0 ? 'competitor_alert' : 'competitors_stable',
      output: {
        summary: analysis.summary,
        materialChanges: analysis.materialChanges,
        threats: analysis.threats,
        opportunities: analysis.opportunities,
      },
      robuxImpact: 0,
      status: 'success',
    };
  }

  async executeActions(_result: AgentResult, _ctx: AgentContext): Promise<void> {
    // Competitor intel is informational — no automated game changes
  }

  async runFullPipeline(
    creatorId: string,
    gameId: string,
    input: CompetitorInput,
    db: import('@prisma/client').PrismaClient
  ): Promise<AgentResult> {
    const apiKey = process.env.ROBLOX_OPEN_CLOUD_API_KEY!;

    const currentSnapshots: Array<{
      name: string;
      robloxGameId: string;
      concurrent: number;
      rating: number;
    }> = [];

    for (const universeId of input.competitorUniverseIds) {
      try {
        const data = await fetchCompetitorData(universeId, apiKey);

        await db.competitorSnapshot.create({
          data: {
            watchingGameId: gameId,
            robloxGameId: universeId,
            name: data.name,
            concurrent: data.concurrent,
            rating: data.rating,
          },
        });

        currentSnapshots.push({
          name: data.name,
          robloxGameId: universeId,
          concurrent: data.concurrent,
          rating: data.rating,
        });
      } catch (err) {
        console.error(`Failed to fetch competitor ${universeId}:`, err);
      }
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const priorSnapshots: Array<{
      name: string;
      robloxGameId: string;
      avgConcurrent: number;
      avgRating: number;
    }> = [];

    for (const universeId of input.competitorUniverseIds) {
      const priorRecords = await db.competitorSnapshot.findMany({
        where: {
          watchingGameId: gameId,
          robloxGameId: universeId,
          updatedAt: { gte: sevenDaysAgo },
        },
        orderBy: { updatedAt: 'desc' },
        skip: 1,
      });

      if (priorRecords.length > 0) {
        const avgConcurrent = Math.round(
          priorRecords.reduce((sum, r) => sum + r.concurrent, 0) / priorRecords.length
        );
        const avgRating =
          priorRecords.reduce((sum, r) => sum + r.rating, 0) / priorRecords.length;

        priorSnapshots.push({
          name: priorRecords[0].name,
          robloxGameId: universeId,
          avgConcurrent,
          avgRating,
        });
      }
    }

    const context: AgentContext = {
      creatorId,
      gameId,
      inputData: {
        watchingGameName: input.watchingGameName,
        currentSnapshots,
        priorSnapshots,
      },
      db,
    };

    return this.run(context);
  }
}
