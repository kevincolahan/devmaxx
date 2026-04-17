export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { message, gameId, history } = (await req.json()) as {
    message: string;
    gameId?: string;
    history?: ChatMessage[];
  };

  if (!message || typeof message !== 'string') {
    return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── Fetch creator + full context ──────────────────────────

  const creator = await db.creator.findUnique({
    where: { email: session.user.email },
    include: {
      games: true,
    },
  });

  if (!creator) {
    return new Response(JSON.stringify({ error: 'Creator not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const gameIds = gameId
    ? [gameId]
    : creator.games.map((g) => g.id);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [snapshots, agentRuns, priceTests, tickets, contentPieces, competitorSnapshots] =
    await Promise.all([
      db.metricSnapshot.findMany({
        where: { gameId: { in: gameIds }, date: { gte: thirtyDaysAgo } },
        orderBy: { date: 'desc' },
        include: { game: { select: { name: true } } },
      }),
      db.agentRun.findMany({
        where: { creatorId: creator.id, createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      db.priceTest.findMany({
        where: { gameId: { in: gameIds } },
        orderBy: { startedAt: 'desc' },
        take: 20,
        include: { game: { select: { name: true } } },
      }),
      db.supportTicket.findMany({
        where: { gameId: { in: gameIds } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { game: { select: { name: true } } },
      }),
      db.contentPiece.findMany({
        where: { creatorId: creator.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      db.competitorSnapshot.findMany({
        where: { watchingGameId: { in: gameIds }, updatedAt: { gte: sevenDaysAgo } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
    ]);

  // ─── Build data context ────────────────────────────────────

  const dataContext: Record<string, unknown> = {
    games: creator.games.map((g) => ({
      name: g.name,
      id: g.id,
      robloxGameId: g.robloxGameId,
      healthScore: g.healthScore,
      genre: g.genre,
      competitors: g.competitors,
    })),
    metricSnapshots: snapshots.map((s) => ({
      game: s.game.name,
      date: s.date.toISOString().split('T')[0],
      dau: s.dau,
      mau: s.mau,
      concurrentPeak: s.concurrentPeak,
      avgSessionSec: s.avgSessionSec,
      retentionD1: s.retentionD1,
      retentionD7: s.retentionD7,
      retentionD30: s.retentionD30,
      robuxEarned: s.robuxEarned,
      newPlayers: s.newPlayers,
      returningPlayers: s.returningPlayers,
    })),
    recentAgentRuns: agentRuns.map((r) => ({
      agent: r.agentName,
      action: r.action,
      robuxImpact: r.robuxImpact,
      status: r.status,
      date: r.createdAt.toISOString().split('T')[0],
    })),
    priceTests: priceTests.map((t) => ({
      game: t.game.name,
      item: t.itemName,
      priceA: t.priceA,
      priceB: t.priceB,
      exposuresA: t.exposuresA,
      exposuresB: t.exposuresB,
      revenueA: t.revenueA,
      revenueB: t.revenueB,
      status: t.status,
      winner: t.winner,
    })),
    supportTickets: tickets.map((t) => ({
      game: t.game.name,
      category: t.category,
      status: t.status,
      robuxValue: t.robuxValue,
      autoResolved: t.autoResolved,
      date: t.createdAt.toISOString().split('T')[0],
    })),
    contentPieces: contentPieces.map((c) => ({
      type: c.type,
      platform: c.platform,
      status: c.status,
      qualityScore: c.qualityScore,
    })),
    competitorSnapshots: competitorSnapshots.map((c) => ({
      competitor: c.name,
      concurrent: c.concurrent,
      rating: c.rating,
      date: c.updatedAt.toISOString().split('T')[0],
    })),
  };

  // ─── System prompt ─────────────────────────────────────────

  const today = new Date().toISOString().split('T')[0];
  const gameNames = creator.games.map((g) => g.name).join(', ') || 'none';

  const systemPrompt = `You are Devmaxx AI, a business advisor for Roblox game creators. You have access to real data from the creator's connected games. Always be specific — reference actual numbers from the data. Be concise, actionable, and direct. Never be vague. If data is missing, say so honestly.

Today's date: ${today}
Creator plan: ${creator.plan}
Autopilot: ${creator.autopilot ? 'enabled' : 'disabled'}
Connected games: ${creator.games.length} (${gameNames})

Format rules:
- Keep responses under 200 words unless the question requires detailed analysis
- Bold **key metrics** and numbers
- Use bullet points for lists of recommendations
- Format Robux amounts as "X R$"
- Be conversational but data-driven
- End with 2-3 specific follow-up questions the creator might want to ask, formatted as:
  ---
  follow_up: ["question 1", "question 2", "question 3"]

CREATOR'S BUSINESS DATA:
${JSON.stringify(dataContext, null, 2)}`;

  // ─── Build messages ────────────────────────────────────────

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  if (history && Array.isArray(history)) {
    for (const msg of history.slice(-10)) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
  }

  messages.push({ role: 'user', content: message });

  // ─── Stream response via SSE ───────────────────────────────

  const client = new Anthropic();

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const data = JSON.stringify({ type: 'text', text: event.delta.text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }

        const finalMessage = await stream.finalMessage();
        const fullText = finalMessage.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('');

        // Extract follow-up questions if present
        const followUpMatch = fullText.match(/follow_up:\s*\[([^\]]+)\]/);
        let followUps: string[] = [];
        if (followUpMatch) {
          try {
            followUps = JSON.parse(`[${followUpMatch[1]}]`);
          } catch {
            // Parse manually if JSON fails
            followUps = followUpMatch[1]
              .split(',')
              .map((s) => s.trim().replace(/^["']|["']$/g, ''))
              .filter(Boolean);
          }
        }

        const doneData = JSON.stringify({
          type: 'done',
          followUps,
          usage: {
            inputTokens: finalMessage.usage.input_tokens,
            outputTokens: finalMessage.usage.output_tokens,
          },
        });
        controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
        controller.close();
      } catch (err) {
        const errorData = JSON.stringify({ type: 'error', error: String(err) });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
