import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentContext, AgentResult } from '../lib/base-agent';

interface GeneratedPiece {
  type: 'social_post' | 'event_idea' | 'item_desc';
  platform: string | null;
  content: string;
  qualityScore: number;
}

interface ContentOutput {
  pieces: GeneratedPiece[];
  summary: string;
}

export class ContentGenerationAgent extends BaseAgent {
  constructor() {
    super('ContentGenerationAgent');
  }

  buildSystemPrompt(ctx: AgentContext): string {
    const input = ctx.inputData as Record<string, unknown>;
    const gameEligible = input.gameEligible as boolean;

    let prompt = `You are a content strategist for Devmaxx (devmaxx.app) — an AI-powered platform that helps Roblox game creators maximize their DevEx earnings through autonomous agents.

IMPORTANT RULES:
- Generate PLATFORM MARKETING content about Devmaxx the product — NOT about any specific Roblox game.
- NEVER mention any specific game name in social posts.
- Focus on: the Roblox creator economy, DevEx optimization tips, pricing analytics insights, industry stats, and Devmaxx platform benefits.
- Position Devmaxx as the essential tool for serious Roblox creators.

Generate the following social content:
1. X/Twitter post: Under 280 chars. Hook + stat or insight + CTA to devmaxx.app. Conversational creator voice, not corporate. Include relevant emoji.
2. LinkedIn post: 3 paragraphs. Creator economy angle. Data-driven storytelling about Roblox monetization. End with engagement question. Tag Devmaxx.

Topics to draw from:
- Roblox creator economy growth and DevEx trends
- How AI agents optimize game revenue (pricing, retention, content)
- Analytics insights (DAU patterns, retention benchmarks, monetization best practices)
- Platform updates and new Devmaxx features
- Creator success patterns and industry benchmarks`;

    if (gameEligible) {
      prompt += `

GAME-SPECIFIC CONTENT (this game qualifies with real DAU and revenue):
Also generate:
3. In-game event idea: name, mechanic (what players do), reward, duration (1-7 days), estimated DAU lift %.
4. Item description rewrite: Conversion-optimized. Highlight value proposition. Create urgency or exclusivity.
Do NOT mention the game name in social posts — game-specific content is for event ideas and item descriptions only.`;
    }

    prompt += `

Self-rate each piece 1-10 on quality:
- 9-10: Exceptional, viral potential
- 7-8: Strong, publish-ready
- 5-6: Decent but needs editing
- 1-4: Weak, do not publish

ONLY output pieces rated 7+. Skip anything below 7.

Social handles: @devmaxxapp (X, TikTok), @devmaxx.app (Instagram), Devmaxx (LinkedIn)

Respond ONLY with valid JSON:
{
  "pieces": [
    {
      "type": "social_post",
      "platform": "x",
      "content": "The post content",
      "qualityScore": 8
    },
    {
      "type": "social_post",
      "platform": "linkedin",
      "content": "The LinkedIn post content",
      "qualityScore": 8
    }
  ],
  "summary": "Brief summary of what was generated and why"
}`;

    return prompt;
  }

  buildUserPrompt(ctx: AgentContext): string {
    const input = ctx.inputData as Record<string, unknown>;
    const gameEligible = input.gameEligible as boolean;

    let prompt = `Generate Devmaxx platform marketing content for the Roblox creator economy.\n\n`;

    const topOutcomes = input.topOutcomes as unknown[];
    if (topOutcomes && topOutcomes.length > 0) {
      prompt += `AGENT OUTCOMES THIS WEEK (use as inspiration for insights, but do NOT mention the game name):\n`;
      prompt += JSON.stringify(topOutcomes, null, 2) + '\n\n';
    }

    if (input.currentMetrics) {
      prompt += `ANONYMIZED METRICS (use as data points for industry insights):\n`;
      prompt += JSON.stringify(input.currentMetrics, null, 2) + '\n\n';
    }

    if (input.existingContent) {
      prompt += `RECENTLY PUBLISHED (avoid duplicates):\n`;
      prompt += JSON.stringify(input.existingContent, null, 2) + '\n\n';
    }

    prompt += `Generate an X/Twitter post and a LinkedIn post about Devmaxx and the Roblox creator economy.`;

    if (gameEligible) {
      prompt += ` Also generate an in-game event idea and an item description rewrite (genre: ${(input.genre as string[])?.join(', ') || 'unknown'}).`;
    }

    prompt += ` Only output pieces rated 7+.`;
    return prompt;
  }

  async parseResponse(r: Anthropic.Message, _ctx: AgentContext): Promise<AgentResult> {
    const text = r.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let contentOutput: ContentOutput;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      contentOutput = JSON.parse(jsonMatch[0]) as ContentOutput;
    } catch {
      return {
        action: 'generation_failed',
        output: { error: 'Failed to parse content', rawResponse: text },
        status: 'failed',
      };
    }

    const qualityPieces = contentOutput.pieces.filter((p) => p.qualityScore >= 7);

    return {
      action: qualityPieces.length > 0 ? 'content_generated' : 'no_quality_content',
      output: {
        pieces: qualityPieces,
        summary: contentOutput.summary,
        totalGenerated: contentOutput.pieces.length,
        qualityFiltered: qualityPieces.length,
      },
      robuxImpact: 0,
      status: 'success',
    };
  }

  async executeActions(result: AgentResult, ctx: AgentContext): Promise<void> {
    if (result.action !== 'content_generated') return;

    const output = result.output as { pieces: GeneratedPiece[] };

    for (const piece of output.pieces) {
      await ctx.db.contentPiece.create({
        data: {
          gameId: ctx.gameId,
          creatorId: ctx.creatorId,
          type: piece.type,
          platform: piece.platform,
          content: piece.content,
          qualityScore: piece.qualityScore,
          status: piece.qualityScore >= 7 ? 'approved' : 'draft',
          sourceData: {
            agentName: this.agentName,
            generatedAt: new Date().toISOString(),
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

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const topOutcomes = await db.agentRun.findMany({
      where: {
        creatorId,
        gameId,
        createdAt: { gte: sevenDaysAgo },
        robuxImpact: { gt: 0 },
      },
      orderBy: { robuxImpact: 'desc' },
      take: 5,
      select: {
        agentName: true,
        action: true,
        output: true,
        robuxImpact: true,
        createdAt: true,
      },
    });

    const latestSnapshot = await db.metricSnapshot.findFirst({
      where: { gameId },
      orderBy: { date: 'desc' },
    });

    const recentContent = await db.contentPiece.findMany({
      where: { gameId, createdAt: { gte: sevenDaysAgo } },
      select: { type: true, platform: true, content: true },
      take: 10,
    });

    // Only generate game-specific content (event ideas, item descriptions) if
    // the game has real engagement — DAU > 100 and revenue > 0
    const gameEligible = latestSnapshot
      ? latestSnapshot.dau > 100 && latestSnapshot.robuxEarned > 0
      : false;

    const context: AgentContext = {
      creatorId,
      gameId,
      inputData: {
        gameName: game.name,
        genre: game.genre,
        gameEligible,
        topOutcomes: topOutcomes.map((o) => ({
          agent: o.agentName,
          action: o.action,
          impact: o.robuxImpact,
          date: o.createdAt.toISOString(),
          details: o.output,
        })),
        currentMetrics: latestSnapshot
          ? {
              dau: latestSnapshot.dau,
              robuxEarned: latestSnapshot.robuxEarned,
              retentionD1: latestSnapshot.retentionD1,
              concurrentPeak: latestSnapshot.concurrentPeak,
            }
          : null,
        existingContent: recentContent,
      },
      db,
    };

    return this.run(context);
  }
}
