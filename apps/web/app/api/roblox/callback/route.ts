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
      client_id: process.env.ROBLOX_OAUTH_CLIENT_ID ?? '7693506342195446653',
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

  const creator = await db.creator.findUnique({
    where: { email: session.user.email },
  });

  if (creator?.robloxApiKey) {
    return NextResponse.redirect(new URL('/dashboard?roblox=connected', baseUrl));
  }

  return NextResponse.redirect(new URL('/onboarding?step=apikey', baseUrl));
}
