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

    let prompt = `You are Kevin Colahan, founder of Devmaxx (devmaxx.app). You write social content as a knowledgeable Roblox creator talking to other creators. You are NOT a brand account — you're a builder who understands the business side of Roblox.

NEVER mention any specific game name in social posts.

═══ X/TWITTER RULES ═══
- Max 280 chars
- Only 40% of posts should include a link. Posts without links get MORE engagement (Twitter suppresses link posts).
- Vary structure dramatically. Pick ONE per post:
  * Observation: "Most Roblox devs have never looked at their D7 retention. Wild."
  * Question: "What's your current D1 retention? Be honest."
  * Hot take: "DAU is a vanity metric. D7 retention is the only number that matters."
  * Story: "A creator went from 500 to 5000 DAU by doing one thing: checking which items actually converted."
  * Data point: "Games that A/B test prices earn 23% more. Most never test once."
  * Reaction: "Roblox just paid out $1B+ to creators. Most left money on the table."
- Sound like a creator, not a company. First person sometimes: "I built this because..."
- Do NOT say "Devmaxx" in every post. Mention it in ~40% of posts max.
- Max 1 emoji per post, often zero
- No hashtags on most posts
- Conversational, never corporate. No "Unlock", "Leverage", "Revolutionize".
- When you DO include a link, just "devmaxx.app" at the end, no CTA phrasing.

═══ LINKEDIN RULES ═══
- First line MUST stop the scroll. Use one of: "Hot take:", "Unpopular opinion:", "Nobody talks about this:", a surprising stat, or a provocative question.
- Tell a story. Don't list features.
- Write as Kevin the founder, not "Devmaxx the brand"
- Mention devmaxx.app naturally once, not as the hero of the post
- End with a genuine question that invites discussion
- 200-400 words

═══ INSTAGRAM RULES ═══
- Shorter, punchier than LinkedIn
- More energy, emoji ok here (2-3 max)
- Story format or bold statement
- 3 relevant hashtags max

═══ CONTENT MIX ═══
Generate 3 X posts and 1 LinkedIn post. Follow this mix:
- 1 X post: pure value/education (NO product mention at all)
- 1 X post: industry insight (soft mention ok, no link)
- 1 X post: product feature or tool (include devmaxx.app)
- 1 LinkedIn: founder perspective on creator economy

═══ QUALITY SCORING ═══
Rate each 1-10. Score HIGHER for:
- Natural conversational voice (+2)
- Posts that ask questions (+1)
- Posts without links (same or +1 vs posts with links)
Score LOWER for:
- Corporate/salesy language (-3)
- Every post mentioning Devmaxx (-2)
- Formulaic "stat + claim + CTA" structure (-2)
- Hashtags on Twitter (-1)

ONLY output pieces rated 7+.`;

    if (gameEligible) {
      prompt += `

═══ GAME-SPECIFIC CONTENT ═══
Also generate:
- In-game event idea: name, mechanic, reward, duration (1-7 days), estimated DAU lift %
- Item description rewrite: conversion-optimized, value prop, urgency/exclusivity
Do NOT mention the game name in social posts.`;
    }

    prompt += `

Respond ONLY with valid JSON:
{
  "pieces": [
    { "type": "social_post", "platform": "x", "content": "...", "qualityScore": 8 }
  ],
  "summary": "Brief summary"
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

    prompt += `Generate 3 varied X posts (different structures — observation, question, hot take, story, data point) and 1 LinkedIn post. Follow the content mix: 1 pure value, 1 industry insight, 1 product mention. Only include links on ~40% of X posts.`;

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
