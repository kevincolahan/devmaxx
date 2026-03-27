import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentContext, AgentResult } from '@devmaxx/agent-core';
import {
  refreshAccessToken,
  fetchDeveloperProducts,
  fetchGamePasses,
} from '../lib/roblox';

interface Recommendation {
  title: string;
  description: string;
  estimatedRobuxUplift: number;
  priority: 'high' | 'medium' | 'low';
  category: string;
}

interface AuditOutput {
  summary: string;
  recommendations: Recommendation[];
  warnings: string[];
  revenueConcentrationRisk: boolean;
  topRevenueSource: string;
  topRevenuePercent: number;
}

export class MonetizationAdvisorAgent extends BaseAgent {
  constructor() {
    super('MonetizationAdvisorAgent');
  }

  buildSystemPrompt(_ctx: AgentContext): string {
    return `You are a Roblox monetization expert for Devmaxx. You perform monthly catalog audits and provide actionable revenue optimization recommendations.

Your analysis covers:
1. **Dead inventory** — items with zero sales in 30 days. Recommend price cuts, removal, or bundling.
2. **Underpriced items** — compare against genre benchmarks. Flag items priced significantly below comparable games.
3. **Missing descriptions** — items without descriptions convert poorly. Flag for content generation.
4. **Bundle opportunities** — identify items frequently relevant together that could be bundled at a discount.
5. **Seasonal pricing** — based on the current month, recommend seasonal events, limited-time offers, or holiday pricing.
6. **Revenue concentration** — if >90% of revenue comes from a single item or game pass, flag the risk.

Output exactly 5 recommendations sorted by estimated Robux uplift (highest first).

Respond ONLY with valid JSON:
{
  "summary": "One paragraph audit summary",
  "recommendations": [
    {
      "title": "Short action title",
      "description": "Detailed recommendation with specific numbers",
      "estimatedRobuxUplift": 5000,
      "priority": "high",
      "category": "underpriced|dead_inventory|bundle|seasonal|description|concentration"
    }
  ],
  "warnings": ["any critical warnings"],
  "revenueConcentrationRisk": false,
  "topRevenueSource": "Item Name",
  "topRevenuePercent": 45.2
}`;
  }

  buildUserPrompt(ctx: AgentContext): string {
    const input = ctx.inputData as unknown as {
      gameName: string;
      genre: string[];
      products: Array<{ id: string; displayName: string; description: string; priceInRobux: number }>;
      gamePasses: Array<{ id: string; displayName: string; description: string; priceInRobux: number }>;
      recentSnapshots: Array<{ topItems: Record<string, number>; robuxEarned: number; date: string }>;
      recentTests: Array<{ itemName: string; winner: string | null; priceA: number; priceB: number }>;
      currentMonth: string;
    };

    let prompt = `Monthly monetization audit for "${input.gameName}" (genre: ${input.genre.join(', ') || 'unknown'}).\n\n`;

    prompt += `DEVELOPER PRODUCTS (${input.products.length}):\n`;
    prompt += JSON.stringify(input.products, null, 2) + '\n\n';

    prompt += `GAME PASSES (${input.gamePasses.length}):\n`;
    prompt += JSON.stringify(input.gamePasses, null, 2) + '\n\n';

    if (input.recentSnapshots.length > 0) {
      prompt += `RECENT METRIC SNAPSHOTS (last 30 days):\n`;
      prompt += JSON.stringify(input.recentSnapshots, null, 2) + '\n\n';
    }

    if (input.recentTests.length > 0) {
      prompt += `RECENT PRICE TESTS:\n`;
      prompt += JSON.stringify(input.recentTests, null, 2) + '\n\n';
    }

    prompt += `CURRENT MONTH: ${input.currentMonth}\n\n`;
    prompt += `Provide exactly 5 recommendations sorted by estimated Robux uplift. Flag revenue concentration if >90% from one source.`;
    return prompt;
  }

  async parseResponse(r: Anthropic.Message, _ctx: AgentContext): Promise<AgentResult> {
    const text = r.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let audit: AuditOutput;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      audit = JSON.parse(jsonMatch[0]) as AuditOutput;
    } catch {
      return {
        action: 'audit_failed',
        output: { error: 'Failed to parse audit', rawResponse: text },
        status: 'failed',
      };
    }

    const totalUplift = audit.recommendations.reduce(
      (sum, r) => sum + r.estimatedRobuxUplift,
      0
    );

    return {
      action: 'audit_complete',
      output: {
        summary: audit.summary,
        recommendations: audit.recommendations,
        warnings: audit.warnings,
        revenueConcentrationRisk: audit.revenueConcentrationRisk,
        topRevenueSource: audit.topRevenueSource,
        topRevenuePercent: audit.topRevenuePercent,
      },
      robuxImpact: totalUplift,
      status: 'success',
    };
  }

  async executeActions(result: AgentResult, ctx: AgentContext): Promise<void> {
    if (result.action !== 'audit_complete') return;

    const output = result.output as unknown as AuditOutput;

    for (const rec of output.recommendations) {
      await ctx.db.contentPiece.create({
        data: {
          gameId: ctx.gameId,
          creatorId: ctx.creatorId,
          type: 'monetization',
          content: JSON.stringify(rec),
          qualityScore: rec.priority === 'high' ? 90 : rec.priority === 'medium' ? 70 : 50,
          status: 'draft',
          sourceData: {
            agentName: this.agentName,
            category: rec.category,
            estimatedUplift: rec.estimatedRobuxUplift,
          },
        },
      });
    }
  }

  async runFullPipeline(
    creatorId: string,
    gameId: string,
    db: import('@prisma/client').PrismaClient
  ): Promise<AgentResult> {
    const game = await db.game.findUniqueOrThrow({
      where: { id: gameId },
    });

    const accessToken = await refreshAccessToken(creatorId, db);
    const products = await fetchDeveloperProducts(game.robloxGameId, accessToken);
    const gamePasses = await fetchGamePasses(game.robloxGameId, accessToken);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentSnapshots = await db.metricSnapshot.findMany({
      where: { gameId, date: { gte: thirtyDaysAgo } },
      orderBy: { date: 'desc' },
      select: { topItems: true, robuxEarned: true, date: true },
    });

    const recentTests = await db.priceTest.findMany({
      where: { gameId, status: 'complete' },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: { itemName: true, winner: true, priceA: true, priceB: true },
    });

    const now = new Date();
    const currentMonth = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const context: AgentContext = {
      creatorId,
      gameId,
      inputData: {
        gameName: game.name,
        genre: game.genre,
        products: products.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          description: p.description,
          priceInRobux: p.priceInRobux,
        })),
        gamePasses: gamePasses.map((gp) => ({
          id: gp.id,
          displayName: gp.displayName,
          description: gp.description,
          priceInRobux: gp.priceInRobux,
        })),
        recentSnapshots: recentSnapshots.map((s) => ({
          topItems: s.topItems as Record<string, number>,
          robuxEarned: s.robuxEarned,
          date: s.date.toISOString(),
        })),
        recentTests,
        currentMonth,
      },
      db,
    };

    return this.run(context);
  }
}
