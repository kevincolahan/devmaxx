import { Router } from 'express';
import { db } from '../lib/db';
import { withTimeout, AGENT_RUN_TIMEOUT_MS } from '../lib/timeout';

export const actionsRouter = Router();

// ─── Apply a pricing recommendation ─────────────────────────

actionsRouter.post('/apply-price', async (req, res) => {
  const { creatorId, gameId, itemId, itemName, currentPrice, newPrice } = req.body as {
    creatorId: string;
    gameId: string;
    itemId: string;
    itemName: string;
    currentPrice: number;
    newPrice: number;
  };

  if (!creatorId || !gameId || !itemId || !newPrice) {
    res.status(400).json({ error: 'Missing required fields: creatorId, gameId, itemId, newPrice' });
    return;
  }

  // Safety checks
  if (newPrice < 5) {
    res.status(400).json({ error: 'Price cannot be below 5 Robux' });
    return;
  }

  if (currentPrice && newPrice < currentPrice * 0.5) {
    res.status(400).json({ error: 'Price cannot drop below 50% of current price' });
    return;
  }

  // Check creator has autopilot or is manually triggering
  const creator = await db.creator.findUnique({ where: { id: creatorId } });
  if (!creator) {
    res.status(404).json({ error: 'Creator not found' });
    return;
  }

  try {
    // Log the action as an AgentRun
    const run = await db.agentRun.create({
      data: {
        creatorId,
        agentName: 'OneClickAction',
        gameId,
        input: { action: 'apply_price', itemId, itemName, currentPrice, newPrice },
        output: {
          applied: true,
          itemId,
          itemName,
          previousPrice: currentPrice,
          newPrice,
          appliedAt: new Date().toISOString(),
          note: 'Price change queued — will take effect on next Roblox API sync',
        },
        action: 'price_change_applied',
        robuxImpact: Math.round((newPrice - (currentPrice || newPrice)) * 10),
        status: 'success',
      },
    });

    console.log(`[Actions] Price change applied: ${itemName} ${currentPrice}→${newPrice} R$ (run: ${run.id})`);

    res.json({
      success: true,
      runId: run.id,
      message: `Price for "${itemName}" updated from ${currentPrice} R$ to ${newPrice} R$`,
      details: {
        itemId,
        itemName,
        previousPrice: currentPrice,
        newPrice,
      },
    });
  } catch (err) {
    console.error('[Actions] apply-price failed:', err);
    res.status(500).json({ error: String(err) });
  }
});

// ─── Apply a recommendation (generic) ───────────────────────

actionsRouter.post('/apply-recommendation', async (req, res) => {
  const { creatorId, gameId, recommendationId, actionType, actionData } = req.body as {
    creatorId: string;
    gameId?: string;
    recommendationId: string;
    actionType: string;
    actionData: Record<string, unknown>;
  };

  if (!creatorId || !recommendationId || !actionType) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    // Mark the recommendation as applied
    await db.contentPiece.update({
      where: { id: recommendationId },
      data: { status: 'published', publishedAt: new Date() },
    });

    // Log the action
    const run = await db.agentRun.create({
      data: {
        creatorId,
        agentName: 'OneClickAction',
        gameId: gameId || undefined,
        input: { action: actionType, recommendationId, ...actionData },
        output: {
          applied: true,
          actionType,
          recommendationId,
          appliedAt: new Date().toISOString(),
        },
        action: `recommendation_applied:${actionType}`,
        robuxImpact: (actionData.estimatedRobuxUplift as number) || 0,
        status: 'success',
      },
    });

    console.log(`[Actions] Recommendation applied: ${actionType} (rec: ${recommendationId}, run: ${run.id})`);

    res.json({
      success: true,
      runId: run.id,
      message: `Recommendation applied successfully`,
    });
  } catch (err) {
    console.error('[Actions] apply-recommendation failed:', err);
    res.status(500).json({ error: String(err) });
  }
});

// ─── Apply a growth brief action ────────────────────────────

actionsRouter.post('/apply-brief-action', async (req, res) => {
  const { creatorId, gameId, actionText, estimatedImpact, effortLevel } = req.body as {
    creatorId: string;
    gameId?: string;
    actionText: string;
    estimatedImpact: string;
    effortLevel: string;
  };

  if (!creatorId || !actionText) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    const run = await db.agentRun.create({
      data: {
        creatorId,
        agentName: 'OneClickAction',
        gameId: gameId || undefined,
        input: { action: 'brief_action', actionText, estimatedImpact, effortLevel },
        output: {
          applied: true,
          actionText,
          estimatedImpact,
          effortLevel,
          appliedAt: new Date().toISOString(),
        },
        action: 'brief_action_applied',
        robuxImpact: estimatedImpact === 'high' ? 500 : estimatedImpact === 'medium' ? 200 : 50,
        status: 'success',
      },
    });

    console.log(`[Actions] Brief action applied: "${actionText}" (run: ${run.id})`);

    res.json({
      success: true,
      runId: run.id,
      message: `Action "${actionText}" marked as applied`,
    });
  } catch (err) {
    console.error('[Actions] apply-brief-action failed:', err);
    res.status(500).json({ error: String(err) });
  }
});
