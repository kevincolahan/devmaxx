import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import { scheduleOutcomeFollowUp } from '../agents/outcome-tracking';

export interface AgentContext {
  creatorId: string;
  gameId?: string;
  inputData: Record<string, unknown>;
  db: PrismaClient;
}

export interface AgentResult {
  action: string;
  output: Record<string, unknown>;
  robuxImpact?: number;
  status: 'success' | 'failed' | 'escalated';
}

export abstract class BaseAgent {
  protected client = new Anthropic();
  protected agentName: string;

  constructor(agentName: string) {
    this.agentName = agentName;
  }

  async run(context: AgentContext): Promise<AgentResult> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const userPrompt = this.buildUserPrompt(context);

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const result = await this.parseResponse(response, context);
      await this.executeActions(result, context);
      await this.logRun(context, result);
      return result;
    } catch (error) {
      const failed: AgentResult = {
        action: 'error',
        output: { error: String(error) },
        status: 'failed',
      };
      await this.logRun(context, failed);
      throw error;
    }
  }

  private async logRun(context: AgentContext, result: AgentResult) {
    const run = await context.db.agentRun.create({
      data: {
        creatorId: context.creatorId,
        agentName: this.agentName,
        gameId: context.gameId,
        input: context.inputData as Record<string, unknown> as never,
        output: result.output as Record<string, unknown> as never,
        action: result.action,
        robuxImpact: result.robuxImpact ?? 0,
        status: result.status,
      },
    });

    // Auto-schedule outcome follow-up for runs with positive robuxImpact and a game
    if ((result.robuxImpact ?? 0) > 0 && context.gameId && result.status === 'success') {
      try {
        await scheduleOutcomeFollowUp(context.db, run.id, context.gameId);
      } catch (err) {
        console.error(`[BaseAgent] Failed to schedule outcome follow-up for ${run.id}:`, err);
      }
    }
  }

  abstract buildSystemPrompt(ctx: AgentContext): string;
  abstract buildUserPrompt(ctx: AgentContext): string;
  abstract parseResponse(
    r: Anthropic.Message,
    ctx: AgentContext
  ): Promise<AgentResult>;
  abstract executeActions(
    r: AgentResult,
    ctx: AgentContext
  ): Promise<void>;
}
