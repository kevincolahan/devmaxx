import { Router } from 'express';
import { db } from '../lib/db';
import { parseCommand, executeCommand } from '../agents/command-executor';
import { withTimeout, AGENT_RUN_TIMEOUT_MS } from '../lib/timeout';

export const commandsRouter = Router();

// ─── Parse a natural language command ───────────────────────

commandsRouter.post('/parse', async (req, res) => {
  const { creatorId, gameId, command } = req.body as {
    creatorId: string;
    gameId: string;
    command: string;
  };

  if (!creatorId || !command) {
    res.status(400).json({ error: 'creatorId and command are required' });
    return;
  }

  // Rate limit: max 10 commands per day per creator
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const commandsToday = await db.agentRun.count({
    where: {
      creatorId,
      agentName: 'CommandExecutor',
      createdAt: { gte: today },
    },
  });

  if (commandsToday >= 10) {
    res.status(429).json({ error: 'Daily command limit reached (10/day). Try again tomorrow.' });
    return;
  }

  // Get game context
  let gameName = 'Your game';
  let genre: string[] = [];
  let currentMetrics: Record<string, unknown> | undefined;

  if (gameId) {
    const game = await db.game.findUnique({ where: { id: gameId } });
    if (game) {
      gameName = game.name;
      genre = game.genre;
    }

    const latestSnapshot = await db.metricSnapshot.findFirst({
      where: { gameId },
      orderBy: { date: 'desc' },
    });

    if (latestSnapshot) {
      currentMetrics = {
        dau: latestSnapshot.dau,
        robuxEarned: latestSnapshot.robuxEarned,
        retentionD1: latestSnapshot.retentionD1,
        retentionD7: latestSnapshot.retentionD7,
        concurrentPeak: latestSnapshot.concurrentPeak,
      };
    }
  }

  try {
    console.log(`[Commands] Parsing: "${command}" for creator ${creatorId}`);

    const parsed = await withTimeout(
      parseCommand(command, { gameName, genre, currentMetrics }),
      AGENT_RUN_TIMEOUT_MS,
      `CommandParse:${creatorId}`
    );

    // Check autopilot — if false, always require confirmation
    const creator = await db.creator.findUnique({ where: { id: creatorId } });
    if (creator && !creator.autopilot && parsed.action !== 'analysis' && parsed.action !== 'unknown') {
      parsed.requiresConfirmation = true;
    }

    console.log(`[Commands] Parsed as: ${parsed.action}, confirm: ${parsed.requiresConfirmation}`);

    res.json({ success: true, parsed });
  } catch (err) {
    console.error('[Commands] Parse failed:', err);
    res.status(500).json({ error: String(err) });
  }
});

// ─── Execute a confirmed command ────────────────────────────

commandsRouter.post('/execute', async (req, res) => {
  const { creatorId, gameId, parsed } = req.body as {
    creatorId: string;
    gameId: string;
    parsed: {
      action: string;
      parameters: Record<string, unknown>;
      confirmation: string;
      requiresConfirmation: boolean;
      estimatedImpact: string;
    };
  };

  if (!creatorId || !parsed) {
    res.status(400).json({ error: 'creatorId and parsed command are required' });
    return;
  }

  try {
    console.log(`[Commands] Executing: ${parsed.action} for creator ${creatorId}`);

    const result = await withTimeout(
      executeCommand(creatorId, gameId, parsed as any, db),
      AGENT_RUN_TIMEOUT_MS,
      `CommandExec:${creatorId}`
    );

    console.log(`[Commands] Result: ${result.success ? 'success' : 'failed'} — ${result.message}`);

    res.json(result);
  } catch (err) {
    console.error('[Commands] Execute failed:', err);
    res.status(500).json({ error: String(err) });
  }
});

// ─── Get command history ────────────────────────────────────

commandsRouter.get('/history/:creatorId', async (req, res) => {
  const { creatorId } = req.params;

  const runs = await db.agentRun.findMany({
    where: { creatorId, agentName: 'CommandExecutor' },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      action: true,
      input: true,
      output: true,
      robuxImpact: true,
      status: true,
      createdAt: true,
    },
  });

  res.json({ commands: runs });
});
