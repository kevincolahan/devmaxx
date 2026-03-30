export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db.creator.update({
    where: { email: session.user.email },
    data: {
      robloxUserId: null,
      robloxUsername: null,
      robloxDisplayName: null,
      robloxAccessToken: null,
      robloxRefreshToken: null,
      robloxTokenExpiresAt: null,
    },
  });

  return NextResponse.json({ success: true });
}
