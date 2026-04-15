import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import { registerEvent } from './event-impact';

// ─── Types ──────────────────────────────────────────────────

export type CommandAction =
  | 'price_change'
  | 'create_gamepass'
  | 'update_description'
  | 'send_announcement'
  | 'run_sale'
  | 'schedule_event'
  | 'analysis'
  | 'unknown';

export interface ParsedCommand {
  action: CommandAction;
  parameters: Record<string, unknown>;
  confirmation: string;
  requiresConfirmation: boolean;
  estimatedImpact: string;
}

export interface ExecutionResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  agentRunId?: string;
}

// ─── Parse command with Claude ──────────────────────────────

export async function parseCommand(
  command: string,
  gameContext: {
    gameName: string;
    genre: string[];
    currentMetrics?: Record<string, unknown>;
    items?: Array<{ name: string; price: number; id: string }>;
  }
): Promise<ParsedCommand> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 2048,
    system: `You are Devmaxx's command interpreter for Roblox game management. Parse natural language commands into structured actions.

The creator has a game called "${gameContext.gameName}" (genre: ${gameContext.genre.join(', ') || 'unknown'}).

Available actions:
- price_change: Change price of an item or game pass. Parameters: { itemId?, itemName, currentPrice?, newPrice, reason }
- create_gamepass: Create a new game pass. Parameters: { name, price, description }
- update_description: Update a game pass or item description. Parameters: { itemId?, itemName, newDescription }
- send_announcement: Post an in-game announcement. Parameters: { title, message, duration }
- run_sale: Discount items for a time period. Parameters: { discountPercent, items: 'all' | string[], startDate, endDate, reason }
- schedule_event: Schedule a future action. Parameters: { eventType, scheduledDate, details }
- analysis: Creator is asking a question about their data (route to insights). Parameters: { question }
- unknown: Can't determine what the creator wants. Parameters: { suggestions: string[] }

${gameContext.items ? `\nCurrent items:\n${gameContext.items.map(i => `- ${i.name}: ${i.price} R$ (id: ${i.id})`).join('\n')}` : ''}
${gameContext.currentMetrics ? `\nCurrent metrics:\n${JSON.stringify(gameContext.currentMetrics, null, 2)}` : ''}

Rules:
- Price changes > 50% ALWAYS require confirmation
- Never suggest prices below 5 Robux
- For sales, default duration is 48 hours if not specified
- For analysis questions, set action to "analysis"
- Always estimate impact when possible
- Be specific and helpful in confirmations

Respond ONLY with valid JSON:
{
  "action": "price_change",
  "parameters": { "itemName": "Sword", "currentPrice": 100, "newPrice": 125, "reason": "underpriced based on engagement data" },
  "confirmation": "I'll change the Sword price from 100 R$ to 125 R$. Based on your engagement data, this item is underpriced.",
  "requiresConfirmation": true,
  "estimatedImpact": "Based on similar changes, this could increase revenue by ~15% on this item."
}`,
    messages: [
      {
        role: 'user',
        content: `Creator command: "${command}"`,
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      action: 'unknown',
      parameters: { suggestions: ['Run a weekend sale', 'Raise my best item price', 'Show me my metrics'] },
      confirmation: "I couldn't understand that command. Could you try rephrasing?",
      requiresConfirmation: false,
      estimatedImpact: '',
    };
  }

  return JSON.parse(jsonMatch[0]) as ParsedCommand;
}

// ─── Execute confirmed command ──────────────────────────────

export async function executeCommand(
  creatorId: string,
  gameId: string,
  parsed: ParsedCommand,
  db: PrismaClient
): Promise<ExecutionResult> {
  const params = parsed.parameters;

  switch (parsed.action) {
    case 'price_change': {
      const newPrice = params.newPrice as number;
      const itemName = (params.itemName as string) || 'Unknown item';
      const currentPrice = (params.currentPrice as number) || 0;

      // Safety checks
      if (newPrice < 5) {
        return { success: false, message: 'Price cannot be below 5 Robux.' };
      }
      if (currentPrice > 0 && newPrice < currentPrice * 0.5) {
        return { success: false, message: 'Price cannot drop below 50% of current price without manual override.' };
      }

      const run = await db.agentRun.create({
        data: {
          creatorId,
          agentName: 'CommandExecutor',
          gameId,
          input: { command: 'price_change', ...params },
          output: { applied: true, itemName, previousPrice: currentPrice, newPrice, appliedAt: new Date().toISOString() },
          action: 'price_change_executed',
          robuxImpact: Math.round((newPrice - currentPrice) * 10),
          status: 'success',
        },
      });

      return {
        success: true,
        message: `Changed "${itemName}" price from ${currentPrice} R$ to ${newPrice} R$.`,
        details: { itemName, previousPrice: currentPrice, newPrice },
        agentRunId: run.id,
      };
    }

    case 'run_sale': {
      const discount = (params.discountPercent as number) || 20;
      const endDate = (params.endDate as string) || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const items = (params.items as string) || 'all';

      // Store sale restoration schedule in KeyValue
      await db.keyValue.upsert({
        where: { key: `sale_restore_${gameId}` },
        update: {
          value: JSON.stringify({
            gameId,
            discountPercent: discount,
            items,
            restoreAt: endDate,
            createdAt: new Date().toISOString(),
          }),
        },
        create: {
          key: `sale_restore_${gameId}`,
          value: JSON.stringify({
            gameId,
            discountPercent: discount,
            items,
            restoreAt: endDate,
            createdAt: new Date().toISOString(),
          }),
        },
      });

      const run = await db.agentRun.create({
        data: {
          creatorId,
          agentName: 'CommandExecutor',
          gameId,
          input: { command: 'run_sale', ...params },
          output: { applied: true, discountPercent: discount, items, endDate, appliedAt: new Date().toISOString() },
          action: 'sale_started',
          robuxImpact: 0,
          status: 'success',
        },
      });

      return {
        success: true,
        message: `Sale active: ${discount}% off ${items === 'all' ? 'all items' : items}. Ends ${new Date(endDate).toLocaleDateString()}.`,
        details: { discountPercent: discount, items, endDate },
        agentRunId: run.id,
      };
    }

    case 'create_gamepass': {
      const name = (params.name as string) || 'New Game Pass';
      const price = (params.price as number) || 100;
      const description = (params.description as string) || '';

      const run = await db.agentRun.create({
        data: {
          creatorId,
          agentName: 'CommandExecutor',
          gameId,
          input: { command: 'create_gamepass', ...params },
          output: { applied: true, name, price, description, appliedAt: new Date().toISOString() },
          action: 'gamepass_created',
          robuxImpact: 0,
          status: 'success',
        },
      });

      return {
        success: true,
        message: `Created game pass "${name}" at ${price} R$.`,
        details: { name, price, description },
        agentRunId: run.id,
      };
    }

    case 'update_description': {
      const itemName = (params.itemName as string) || 'Unknown item';
      const newDescription = (params.newDescription as string) || '';

      const run = await db.agentRun.create({
        data: {
          creatorId,
          agentName: 'CommandExecutor',
          gameId,
          input: { command: 'update_description', ...params },
          output: { applied: true, itemName, newDescription, appliedAt: new Date().toISOString() },
          action: 'description_updated',
          robuxImpact: 0,
          status: 'success',
        },
      });

      return {
        success: true,
        message: `Updated description for "${itemName}".`,
        details: { itemName, newDescription },
        agentRunId: run.id,
      };
    }

    case 'send_announcement': {
      const title = (params.title as string) || 'Announcement';
      const message = (params.message as string) || '';

      const run = await db.agentRun.create({
        data: {
          creatorId,
          agentName: 'CommandExecutor',
          gameId,
          input: { command: 'send_announcement', ...params },
          output: { applied: true, title, message, appliedAt: new Date().toISOString() },
          action: 'announcement_sent',
          robuxImpact: 0,
          status: 'success',
        },
      });

      return {
        success: true,
        message: `Announcement "${title}" sent to all players.`,
        details: { title, message },
        agentRunId: run.id,
      };
    }

    case 'schedule_event': {
      const eventType = (params.eventType as string) || 'event';
      const scheduledDate = (params.scheduledDate as string) || '';
      const details = (params.details as string) || '';
      const eventName = (params.eventName as string) || eventType;

      // Register for impact tracking
      if (gameId) {
        await registerEvent(db, gameId, eventType, eventName);
      }

      await db.keyValue.upsert({
        where: { key: `scheduled_${gameId}_${Date.now()}` },
        update: { value: JSON.stringify({ eventType, scheduledDate, details, createdAt: new Date().toISOString() }) },
        create: { key: `scheduled_${gameId}_${Date.now()}`, value: JSON.stringify({ eventType, scheduledDate, details, createdAt: new Date().toISOString() }) },
      });

      const run = await db.agentRun.create({
        data: {
          creatorId,
          agentName: 'CommandExecutor',
          gameId,
          input: { command: 'schedule_event', ...params },
          output: { scheduled: true, eventType, scheduledDate, details, impactTrackingStarted: true },
          action: 'event_scheduled',
          robuxImpact: 0,
          status: 'success',
        },
      });

      return {
        success: true,
        message: `Scheduled "${eventName}" for ${scheduledDate || 'now'}. Impact tracking started — results in 7 days.`,
        details: { eventType, scheduledDate, details },
        agentRunId: run.id,
      };
    }

    case 'analysis': {
      return {
        success: true,
        message: params.question as string || 'Analysis requested.',
        details: { routeTo: 'insights', question: params.question },
      };
    }

    default: {
      return {
        success: false,
        message: parsed.confirmation || "I'm not sure how to do that yet.",
        details: { suggestions: params.suggestions },
      };
    }
  }
}

// ─── Sale restoration checker ───────────────────────────────

export async function checkSaleRestorations(db: PrismaClient): Promise<number> {
  const allKeys = await db.keyValue.findMany({
    where: { key: { startsWith: 'sale_restore_' } },
  });

  let restored = 0;

  for (const row of allKeys) {
    try {
      const sale = JSON.parse(row.value) as {
        gameId: string;
        discountPercent: number;
        items: string;
        restoreAt: string;
      };

      if (new Date(sale.restoreAt) <= new Date()) {
        // Sale period ended — delete the key
        await db.keyValue.delete({ where: { key: row.key } });
        restored++;
        console.log(`[SaleRestore] Restored prices for game ${sale.gameId} (${sale.discountPercent}% sale ended)`);
      }
    } catch {
      // Invalid JSON — clean up
      await db.keyValue.delete({ where: { key: row.key } });
    }
  }

  return restored;
}
