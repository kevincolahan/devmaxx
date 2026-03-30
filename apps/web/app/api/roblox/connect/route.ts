export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL('/login', process.env.NEXTAUTH_URL ?? 'http://localhost:3000'));
  }

  let creator = await db.creator.findUnique({
    where: { email: session.user.email },
  });

  if (!creator) {
    creator = await db.creator.create({
      data: { email: session.user.email },
    });
  }

  const state = crypto.randomUUID();

  const cookieStore = await cookies();
  cookieStore.set('roblox_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: process.env.ROBLOX_OAUTH_CLIENT_ID ?? '7693506342195446653',
    redirect_uri: `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/roblox/callback`,
    response_type: 'code',
    scope: 'openid profile',
    state,
  });

  return NextResponse.redirect(
    `https://apis.roblox.com/oauth/v1/authorize?${params.toString()}`
  );
}
