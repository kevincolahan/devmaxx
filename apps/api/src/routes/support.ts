import { Router } from 'express';
import { db } from '../lib/db';
import { PlayerSupportAgent } from '../agents/player-support';

export const supportRouter = Router();

supportRouter.post('/incoming', async (req, res) => {
  const { gameId, playerId, message, source } = req.body as {
    gameId: string;
    playerId: string;
    message: string;
    source?: string;
  };

  if (!gameId || !playerId || !message) {
    res.status(400).json({ error: 'gameId, playerId, and message are required' });
    return;
  }

  const agent = new PlayerSupportAgent();

  try {
    const result = await agent.runFullPipeline(
      gameId,
      playerId,
      message,
      source ?? 'in-game',
      db
    );

    res.json({
      success: true,
      ticketId: result.ticketId,
      category: (result.output as Record<string, unknown>).category,
      response: (result.output as Record<string, unknown>).response,
      autoResolved: (result.output as Record<string, unknown>).autoResolvable,
      status: result.status,
    });
  } catch (err) {
    console.error('PlayerSupportAgent failed:', err);
    res.status(500).json({ error: 'Support agent failed', details: String(err) });
  }
});

supportRouter.get('/tickets', async (req, res) => {
  const { gameId, creatorId, status, limit } = req.query as {
    gameId?: string;
    creatorId?: string;
    status?: string;
    limit?: string;
  };

  const where: Record<string, unknown> = {};
  if (gameId) where.gameId = gameId;
  if (status) where.status = status;
  if (creatorId) {
    const games = await db.game.findMany({
      where: { creatorId },
      select: { id: true },
    });
    where.gameId = { in: games.map((g) => g.id) };
  }

  const tickets = await db.supportTicket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit ?? '50', 10),
    include: { game: { select: { name: true } } },
  });

  res.json({
    tickets: tickets.map((t) => ({
      id: t.id,
      gameId: t.gameId,
      gameName: (t.game as { name: string }).name,
      playerId: t.playerId,
      category: t.category,
      message: t.message,
      response: t.response,
      status: t.status,
      robuxValue: t.robuxValue,
      autoResolved: t.autoResolved,
      createdAt: t.createdAt,
    })),
  });
});

supportRouter.post('/resolve/:id', async (req, res) => {
  const { id } = req.params;
  const { response } = req.body as { response?: string };

  const ticket = await db.supportTicket.findUnique({ where: { id } });
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  await db.supportTicket.update({
    where: { id },
    data: {
      status: 'resolved',
      response: response ?? ticket.response,
    },
  });

  res.json({ success: true });
});
