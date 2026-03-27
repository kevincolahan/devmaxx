import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentContext, AgentResult } from '../lib/base-agent';

type Category = 'bug' | 'refund' | 'how-to' | 'feature' | 'toxic' | 'positive';

interface ClassificationOutput {
  category: Category;
  sentiment: number;
  response: string;
  refundAmount: number | null;
  bugDescription: string | null;
  autoResolvable: boolean;
  escalationReason: string | null;
}

export class PlayerSupportAgent extends BaseAgent {
  constructor() {
    super('PlayerSupportAgent');
  }

  buildSystemPrompt(ctx: AgentContext): string {
    const input = ctx.inputData as Record<string, unknown>;
    const gameName = (input.gameName as string) ?? 'the game';

    return `You are a player support agent for the Roblox game "${gameName}", powered by Devmaxx.

Your job is to:
1. Classify the player message into exactly one category: bug | refund | how-to | feature | toxic | positive
2. Draft a helpful, friendly response appropriate to the category
3. Determine if the ticket can be auto-resolved

Classification rules:
- "bug": Player reports something broken, glitching, or not working as expected
- "refund": Player wants money back, mentions purchase, accidental buy, item not received
- "how-to": Player asking how to do something, where to find something, game mechanics
- "feature": Player suggesting new feature, improvement, or content
- "toxic": Harassment, threats, slurs, severe negativity toward other players or the game
- "positive": Compliment, thank you, appreciation, fan message

Auto-resolve rules:
- refund <= 500 Robux: auto-approve
- refund 500-1000 Robux AND account age > 30 days: auto-approve
- refund > 1000 Robux: ESCALATE — never auto-approve
- bug: auto-respond with acknowledgment, NOT auto-resolved (needs investigation)
- how-to / feature / positive: auto-resolve with appropriate response
- toxic: auto-respond with warning, flag for review, NOT auto-resolved

Response tone: Friendly, concise, professional. Use the player's name if available. Never promise things you can't deliver.

Respond ONLY with valid JSON:
{
  "category": "bug",
  "sentiment": -2,
  "response": "Your drafted response to the player",
  "refundAmount": null,
  "bugDescription": "Short bug description for dedup",
  "autoResolvable": false,
  "escalationReason": null
}

sentiment: -5 (very negative) to +5 (very positive)
refundAmount: only for refund category, in Robux
bugDescription: only for bug category, null otherwise
escalationReason: only when autoResolvable is false and needs human review`;
  }

  buildUserPrompt(ctx: AgentContext): string {
    const input = ctx.inputData as Record<string, unknown>;

    let prompt = `Player message:\n"${input.message}"\n\n`;
    prompt += `Player ID: ${input.playerId}\n`;
    prompt += `Source: ${input.source ?? 'in-game'}\n`;

    if (input.playerAccountAgeDays) {
      prompt += `Account age: ${input.playerAccountAgeDays} days\n`;
    }

    if (input.recentPurchases) {
      prompt += `Recent purchases: ${JSON.stringify(input.recentPurchases)}\n`;
    }

    if (input.knownBugs) {
      prompt += `\nKnown bugs (for dedup):\n${JSON.stringify(input.knownBugs)}\n`;
    }

    return prompt;
  }

  async parseResponse(r: Anthropic.Message, _ctx: AgentContext): Promise<AgentResult> {
    const text = r.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let classification: ClassificationOutput;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      classification = JSON.parse(jsonMatch[0]) as ClassificationOutput;
    } catch {
      return {
        action: 'classification_failed',
        output: { error: 'Failed to parse classification', rawResponse: text },
        status: 'failed',
      };
    }

    const action = classification.autoResolvable ? 'auto_resolved' : 'escalated';

    return {
      action,
      output: {
        category: classification.category,
        sentiment: classification.sentiment,
        response: classification.response,
        refundAmount: classification.refundAmount,
        bugDescription: classification.bugDescription,
        autoResolvable: classification.autoResolvable,
        escalationReason: classification.escalationReason,
      },
      robuxImpact: classification.refundAmount
        ? -classification.refundAmount
        : 0,
      status: classification.autoResolvable ? 'success' : 'escalated',
    };
  }

  async executeActions(_result: AgentResult, _ctx: AgentContext): Promise<void> {
    // Ticket creation and bug dedup happen in runFullPipeline
  }

  async runFullPipeline(
    gameId: string,
    playerId: string,
    message: string,
    source: string,
    db: import('@prisma/client').PrismaClient
  ): Promise<AgentResult & { ticketId: string }> {
    const game = await db.game.findUniqueOrThrow({
      where: { id: gameId },
      include: { creator: true },
    });

    const knownBugs = await db.bugTicket.findMany({
      where: { gameId, status: 'open' },
      select: { id: true, description: true, reportCount: true },
      take: 20,
    });

    const context: AgentContext = {
      creatorId: game.creatorId,
      gameId,
      inputData: {
        gameName: game.name,
        playerId,
        message,
        source,
        knownBugs: knownBugs.map((b) => ({
          id: b.id,
          description: b.description,
          reports: b.reportCount,
        })),
      },
      db,
    };

    const result = await this.run(context);
    const output = result.output as unknown as ClassificationOutput;

    const ticket = await db.supportTicket.create({
      data: {
        gameId,
        playerId,
        category: output.category,
        message,
        response: output.response,
        status: output.autoResolvable ? 'resolved' : 'escalated',
        robuxValue: output.refundAmount,
        autoResolved: output.autoResolvable,
      },
    });

    if (output.category === 'bug' && output.bugDescription) {
      const existingBug = knownBugs.find((b) =>
        b.description.toLowerCase().includes(output.bugDescription!.toLowerCase().slice(0, 20))
      );

      if (existingBug) {
        const updated = await db.bugTicket.update({
          where: { id: existingBug.id },
          data: { reportCount: { increment: 1 } },
        });

        if (updated.reportCount >= 5) {
          await db.agentRun.create({
            data: {
              creatorId: game.creatorId,
              agentName: 'PlayerSupportAgent',
              gameId,
              input: { bugId: existingBug.id },
              output: {
                alert: `Bug "${output.bugDescription}" reported by ${updated.reportCount} players`,
                bugId: existingBug.id,
              },
              action: 'bug_alert',
              robuxImpact: 0,
              status: 'escalated',
            },
          });
        }
      } else {
        await db.bugTicket.create({
          data: {
            gameId,
            description: output.bugDescription,
            reportCount: 1,
            status: 'open',
          },
        });
      }
    }

    return { ...result, ticketId: ticket.id };
  }
}
