export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const session = await auth();
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  if (!session?.user?.email) {
    return NextResponse.redirect(new URL('/login', baseUrl));
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  if (error) {
    console.error('Roblox OAuth error:', error);
    return NextResponse.redirect(new URL('/dashboard?error=roblox_denied', baseUrl));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard?error=roblox_missing_params', baseUrl));
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get('roblox_oauth_state')?.value;

  if (state !== storedState) {
    return NextResponse.redirect(new URL('/dashboard?error=roblox_state_mismatch', baseUrl));
  }

  cookieStore.delete('roblox_oauth_state');

  const redirectUri = `${baseUrl}/api/roblox/callback`;

  const tokenRes = await fetch('https://apis.roblox.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.ROBLOX_OAUTH_CLIENT_ID!,
      client_secret: process.env.ROBLOX_OAUTH_CLIENT_SECRET!,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error('Roblox token exchange failed:', text);
    return NextResponse.redirect(new URL('/dashboard?error=roblox_token_failed', baseUrl));
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    id_token?: string;
  };

  const userInfoRes = await fetch('https://apis.roblox.com/oauth/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  let robloxUserId: string | null = null;
  let robloxUsername: string | null = null;
  let robloxDisplayName: string | null = null;

  if (userInfoRes.ok) {
    const userInfo = (await userInfoRes.json()) as {
      sub?: string;
      preferred_username?: string;
      nickname?: string;
      name?: string;
    };
    robloxUserId = userInfo.sub ?? null;
    robloxUsername = userInfo.preferred_username ?? null;
    robloxDisplayName = userInfo.nickname ?? userInfo.name ?? null;
  }

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  await db.creator.update({
    where: { email: session.user.email },
    data: {
      robloxUserId,
      robloxUsername,
      robloxDisplayName,
      robloxAccessToken: tokenData.access_token,
      robloxRefreshToken: tokenData.refresh_token,
      robloxTokenExpiresAt: expiresAt,
    },
  });

  if (robloxUserId) {
    try {
      await discoverAndCreateGames(session.user.email, robloxUserId, tokenData.access_token);
    } catch (err) {
      console.error('Game discovery failed:', err);
    }
  }

  return NextResponse.redirect(new URL('/dashboard?roblox=connected', baseUrl));
}

async function discoverAndCreateGames(
  creatorEmail: string,
  robloxUserId: string,
  accessToken: string
) {
  const creator = await db.creator.findUniqueOrThrow({
    where: { email: creatorEmail },
    include: { games: true },
  });

  const existingGameIds = new Set(creator.games.map((g) => g.robloxGameId));

  const gamesRes = await fetch(
    `https://games.roblox.com/v2/users/${robloxUserId}/games?sortOrder=Desc&limit=50`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!gamesRes.ok) {
    const universeRes = await fetch(
      `https://apis.roblox.com/cloud/v2/users/${robloxUserId}/universes?maxPageSize=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!universeRes.ok) {
      console.error('Both game discovery methods failed');
      return;
    }

    const universeData = (await universeRes.json()) as {
      universes?: Array<{
        path: string;
        displayName: string;
        description?: string;
      }>;
    };

    for (const universe of universeData.universes ?? []) {
      const universeId = universe.path.split('/').pop() ?? '';
      if (!universeId || existingGameIds.has(universeId)) continue;

      await db.game.create({
        data: {
          creatorId: creator.id,
          robloxGameId: universeId,
          name: universe.displayName || `Game ${universeId}`,
          genre: [],
          healthScore: 50,
          competitors: [],
        },
      });
    }

    return;
  }

  const gamesData = (await gamesRes.json()) as {
    data?: Array<{
      id: number;
      name: string;
      description?: string;
      rootPlace?: { id: number };
      creator?: { type: string };
    }>;
  };

  for (const game of gamesData.data ?? []) {
    const gameId = String(game.id);
    if (existingGameIds.has(gameId)) continue;

    await db.game.create({
      data: {
        creatorId: creator.id,
        robloxGameId: gameId,
        name: game.name || `Game ${gameId}`,
        genre: [],
        healthScore: 50,
        competitors: [],
      },
    });
  }
}
