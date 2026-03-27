import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentContext, AgentResult } from '../lib/base-agent';
import {
  refreshAccessToken,
  fetchDeveloperProducts,
  updateProductPrice,
  DeveloperProduct,
} from '../lib/roblox';

// ─── Phase A: Test Creation ───────────────────────────────────

interface TestSelectionOutput {
  selectedItems: Array<{
    itemId: string;
    itemName: string;
    currentPrice: number;
    variantPrice: number;
    rationale: string;
  }>;
  skippedReason?: string;
}

export class PricingTestCreatorAgent extends BaseAgent {
  constructor() {
    super('PricingOptimizationAgent');
  }

  buildSystemPrompt(_ctx: AgentContext): string {
    return `You are a Roblox pricing optimization expert for Devmaxx. You select items for A/B price tests to maximize DevEx revenue.

Selection criteria — pick up to 3 items:
1. Active items with sales in the last 7 days (highest revenue potential first)
2. Items NOT tested in the last 30 days
3. Items priced >= 5 Robux (never test below this)

For each selected item, compute a variant price:
- Variant should be ±15-25% of current price
- If item seems underpriced for its category, test HIGHER
- If item has declining sales, test LOWER
- Never drop below 50% of the current price
- Round to nearest 5 Robux

Respond ONLY with valid JSON:
{
  "selectedItems": [
    {
      "itemId": "product_id",
      "itemName": "Product Name",
      "currentPrice": 100,
      "variantPrice": 120,
      "rationale": "Why this item and this price"
    }
  ],
  "skippedReason": null
}

If no items are eligible for testing, return an empty selectedItems array with a skippedReason.`;
  }

  buildUserPrompt(ctx: AgentContext): string {
    const input = ctx.inputData as unknown as {
      gameName: string;
      products: DeveloperProduct[];
      recentTests: Array<{ itemId: string; completedAt: string | null }>;
      genre: string[];
    };

    let prompt = `Select items for A/B price testing in "${input.gameName}" (genre: ${input.genre.join(', ') || 'unknown'}).\n\n`;
    prompt += `AVAILABLE PRODUCTS (${input.products.length} total):\n`;
    prompt += JSON.stringify(input.products, null, 2) + '\n\n';

    if (input.recentTests.length > 0) {
      prompt += `RECENTLY TESTED (exclude these):\n`;
      prompt += JSON.stringify(input.recentTests, null, 2) + '\n\n';
    }

    prompt += `Select up to 3 items. Remember: minimum price 5 Robux, variant ±15-25%, never below 50% of current.`;
    return prompt;
  }

  async parseResponse(r: Anthropic.Message, _ctx: AgentContext): Promise<AgentResult> {
    const text = r.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let selection: TestSelectionOutput;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      selection = JSON.parse(jsonMatch[0]) as TestSelectionOutput;
    } catch {
      return {
        action: 'selection_failed',
        output: { error: 'Failed to parse selection', rawResponse: text },
        status: 'failed',
      };
    }

    if (selection.selectedItems.length === 0) {
      return {
        action: 'no_eligible_items',
        output: { reason: selection.skippedReason ?? 'No items eligible for testing' },
        robuxImpact: 0,
        status: 'success',
      };
    }

    return {
      action: 'tests_created',
      output: { selectedItems: selection.selectedItems },
      robuxImpact: 0,
      status: 'success',
    };
  }

  async executeActions(_result: AgentResult, _ctx: AgentContext): Promise<void> {
    // Test creation happens in runFullPipeline after parseResponse
  }

  async runFullPipeline(
    creatorId: string,
    gameId: string,
    db: import('@prisma/client').PrismaClient
  ): Promise<AgentResult> {
    const game = await db.game.findUniqueOrThrow({
      where: { id: gameId },
      include: { creator: true },
    });

    const creator = game.creator;
    const accessToken = await refreshAccessToken(creatorId, db);

    const products = await fetchDeveloperProducts(game.robloxGameId, accessToken);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTests = await db.priceTest.findMany({
      where: {
        gameId,
        startedAt: { gte: thirtyDaysAgo },
      },
      select: { itemId: true, completedAt: true },
    });

    const context: AgentContext = {
      creatorId,
      gameId,
      inputData: {
        gameName: game.name,
        products,
        recentTests: recentTests.map((t) => ({
          itemId: t.itemId,
          completedAt: t.completedAt?.toISOString() ?? null,
        })),
        genre: game.genre,
      },
      db,
    };

    const result = await this.run(context);

    if (result.action === 'tests_created') {
      const items = (result.output as { selectedItems: TestSelectionOutput['selectedItems'] }).selectedItems;

      for (const item of items) {
        if (item.variantPrice < 5) continue;
        if (item.variantPrice < item.currentPrice * 0.5) continue;

        await db.priceTest.create({
          data: {
            gameId,
            itemId: item.itemId,
            itemName: item.itemName,
            priceA: item.currentPrice,
            priceB: item.variantPrice,
            status: 'running',
          },
        });

        if (creator.autopilot) {
          try {
            await updateProductPrice(
              game.robloxGameId,
              item.itemId,
              item.variantPrice,
              accessToken
            );
          } catch (err) {
            console.error(`Failed to set variant price for ${item.itemId}:`, err);
          }
        }
      }
    }

    return result;
  }
}

// ─── Phase B: Test Evaluation ─────────────────────────────────

interface EvalItem {
  testId: string;
  itemName: string;
  priceA: number;
  priceB: number;
  exposuresA: number;
  exposuresB: number;
  revenueA: number;
  revenueB: number;
  rpeA: number;
  rpeB: number;
  hoursRunning: number;
}

interface EvalOutput {
  evaluations: Array<{
    testId: string;
    winner: 'A' | 'B' | 'inconclusive';
    confidence: number;
    reasoning: string;
    estimatedAnnualImpact: number;
  }>;
}

export class PricingTestEvaluatorAgent extends BaseAgent {
  constructor() {
    super('PricingOptimizationAgent');
  }

  buildSystemPrompt(_ctx: AgentContext): string {
    return `You are a statistical analyst evaluating A/B price tests for Roblox game items.

For each test, you receive:
- priceA (original), priceB (variant)
- exposuresA, exposuresB (number of players who saw each price)
- revenueA, revenueB (total Robux earned from each)
- rpeA, rpeB (revenue per exposure)
- hoursRunning

Your job:
1. Calculate if the difference is statistically significant (p < 0.05)
   Use revenue per exposure as your metric
2. Declare a winner: A, B, or inconclusive
3. Estimate annualized Robux impact of implementing the winner
4. Provide confidence level (0-100)

Tests should conclude when:
- At least 500 exposures per variant, OR
- 72 hours have passed

Respond ONLY with valid JSON:
{
  "evaluations": [
    {
      "testId": "test_id",
      "winner": "A",
      "confidence": 87,
      "reasoning": "Explanation of statistical analysis",
      "estimatedAnnualImpact": 15000
    }
  ]
}`;
  }

  buildUserPrompt(ctx: AgentContext): string {
    const input = ctx.inputData as unknown as {
      gameName: string;
      tests: EvalItem[];
    };

    let prompt = `Evaluate the following price tests for "${input.gameName}":\n\n`;
    prompt += JSON.stringify(input.tests, null, 2);
    prompt += `\n\nDeclare winners where statistically significant (p < 0.05). Mark as inconclusive if not enough data.`;
    return prompt;
  }

  async parseResponse(r: Anthropic.Message, _ctx: AgentContext): Promise<AgentResult> {
    const text = r.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let evalOutput: EvalOutput;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      evalOutput = JSON.parse(jsonMatch[0]) as EvalOutput;
    } catch {
      return {
        action: 'evaluation_failed',
        output: { error: 'Failed to parse evaluation', rawResponse: text },
        status: 'failed',
      };
    }

    const totalImpact = evalOutput.evaluations.reduce(
      (sum, e) => sum + e.estimatedAnnualImpact,
      0
    );

    return {
      action: 'tests_evaluated',
      output: { evaluations: evalOutput.evaluations },
      robuxImpact: totalImpact,
      status: 'success',
    };
  }

  async executeActions(_result: AgentResult, _ctx: AgentContext): Promise<void> {
    // Implementation happens in runFullPipeline
  }

  async runFullPipeline(
    db: import('@prisma/client').PrismaClient
  ): Promise<AgentResult> {
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

    const readyTests = await db.priceTest.findMany({
      where: {
        status: 'running',
        OR: [
          { exposuresA: { gte: 500 }, exposuresB: { gte: 500 } },
          { startedAt: { lte: seventyTwoHoursAgo } },
        ],
      },
      include: {
        game: { include: { creator: true } },
      },
    });

    if (readyTests.length === 0) {
      return {
        action: 'no_tests_ready',
        output: { message: 'No tests ready for evaluation' },
        robuxImpact: 0,
        status: 'success',
      };
    }

    const gameGroups = new Map<string, typeof readyTests>();
    for (const test of readyTests) {
      const group = gameGroups.get(test.gameId) ?? [];
      group.push(test);
      gameGroups.set(test.gameId, group);
    }

    const allEvaluations: EvalOutput['evaluations'] = [];

    for (const [gameId, tests] of gameGroups) {
      const game = tests[0].game;
      const creator = game.creator;

      const evalItems: EvalItem[] = tests.map((t) => ({
        testId: t.id,
        itemName: t.itemName,
        priceA: t.priceA,
        priceB: t.priceB,
        exposuresA: t.exposuresA,
        exposuresB: t.exposuresB,
        revenueA: t.revenueA,
        revenueB: t.revenueB,
        rpeA: t.exposuresA > 0 ? t.revenueA / t.exposuresA : 0,
        rpeB: t.exposuresB > 0 ? t.revenueB / t.exposuresB : 0,
        hoursRunning: (Date.now() - t.startedAt.getTime()) / (1000 * 60 * 60),
      }));

      const context: AgentContext = {
        creatorId: creator.id,
        gameId,
        inputData: { gameName: game.name, tests: evalItems },
        db,
      };

      const result = await this.run(context);

      if (result.action === 'tests_evaluated') {
        const evals = (result.output as { evaluations: EvalOutput['evaluations'] }).evaluations;

        for (const evaluation of evals) {
          allEvaluations.push(evaluation);

          await db.priceTest.update({
            where: { id: evaluation.testId },
            data: {
              status: 'complete',
              winner: evaluation.winner,
              completedAt: new Date(),
            },
          });

          if (creator.autopilot && evaluation.winner === 'B') {
            const test = tests.find((t) => t.id === evaluation.testId);
            if (test) {
              try {
                const accessToken = await refreshAccessToken(creator.id, db);
                await updateProductPrice(
                  game.robloxGameId,
                  test.itemId,
                  test.priceB,
                  accessToken
                );
              } catch (err) {
                console.error(`Failed to auto-implement winning price for ${test.itemId}:`, err);
              }
            }
          }

          if (creator.autopilot && evaluation.winner === 'A') {
            const test = tests.find((t) => t.id === evaluation.testId);
            if (test) {
              try {
                const accessToken = await refreshAccessToken(creator.id, db);
                await updateProductPrice(
                  game.robloxGameId,
                  test.itemId,
                  test.priceA,
                  accessToken
                );
              } catch (err) {
                console.error(`Failed to revert price for ${test.itemId}:`, err);
              }
            }
          }

          if (!creator.autopilot) {
            await db.contentPiece.create({
              data: {
                gameId,
                creatorId: creator.id,
                type: 'pricing_recommendation',
                content: JSON.stringify({
                  testId: evaluation.testId,
                  winner: evaluation.winner,
                  confidence: evaluation.confidence,
                  reasoning: evaluation.reasoning,
                  estimatedAnnualImpact: evaluation.estimatedAnnualImpact,
                }),
                status: 'draft',
              },
            });
          }
        }
      }
    }

    return {
      action: 'evaluation_complete',
      output: { evaluations: allEvaluations, testsEvaluated: allEvaluations.length },
      robuxImpact: allEvaluations.reduce((sum, e) => sum + e.estimatedAnnualImpact, 0),
      status: 'success',
    };
  }
}
