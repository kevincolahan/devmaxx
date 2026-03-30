export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { apiKey } = (await req.json()) as { apiKey: string };

  if (!apiKey || apiKey.length < 10) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 400 });
  }

  const creator = await db.creator.findUnique({
    where: { email: session.user.email },
  });

  if (!creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  }

  if (!creator.robloxUserId) {
    return NextResponse.json({ error: 'Connect Roblox account first' }, { status: 400 });
  }

  await db.creator.update({
    where: { email: session.user.email },
    data: { robloxApiKey: apiKey },
  });

  if (creator.robloxUserId) {
    try {
      await discoverGamesWithApiKey(creator.id, creator.robloxUserId, apiKey);
    } catch (err) {
      console.error('Game discovery with API key failed:', err);
    }
  }

  return NextResponse.json({ success: true });
}

async function discoverGamesWithApiKey(
  creatorId: string,
  robloxUserId: string,
  apiKey: string
) {
  const existingGames = await db.game.findMany({
    where: { creatorId },
    select: { robloxGameId: true },
  });
  const existingIds = new Set(existingGames.map((g) => g.robloxGameId));

  const gamesRes = await fetch(
    `https://games.roblox.com/v2/users/${robloxUserId}/games?sortOrder=Desc&limit=50`,
    { headers: { Accept: 'application/json' } }
  );

  if (!gamesRes.ok) return;

  const gamesData = (await gamesRes.json()) as {
    data?: Array<{
      id: number;
      name: string;
    }>;
  };

  for (const game of gamesData.data ?? []) {
    const gameId = String(game.id);
    if (existingIds.has(gameId)) continue;

    await db.game.create({
      data: {
        creatorId,
        robloxGameId: gameId,
        name: game.name || `Game ${gameId}`,
        genre: [],
        healthScore: 50,
        competitors: [],
      },
    });
  }
}
