export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { token, guildId, creatorId } = (await req.json()) as {
    token?: string;
    guildId?: string;
    creatorId?: string;
  };

  if (!token || !guildId || !creatorId) {
    return NextResponse.json({ error: 'Missing token, guildId, or creatorId' }, { status: 400 });
  }

  // Verify the logged-in user owns this creatorId
  const creator = await db.creator.findUnique({ where: { id: creatorId } });
  if (!creator || creator.email !== session.user.email) {
    return NextResponse.json({ error: 'Creator ID does not match logged-in user' }, { status: 403 });
  }

  // Validate token
  const linkToken = await db.discordLinkToken.findUnique({ where: { token } });
  if (!linkToken) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }
  if (linkToken.usedAt) {
    return NextResponse.json({ error: 'Token already used' }, { status: 400 });
  }
  if (new Date() > linkToken.expiresAt) {
    return NextResponse.json({ error: 'Token expired' }, { status: 400 });
  }
  if (linkToken.guildId !== guildId) {
    return NextResponse.json({ error: 'Token and guildId mismatch' }, { status: 400 });
  }

  // Mark token as used
  await db.discordLinkToken.update({
    where: { id: linkToken.id },
    data: { usedAt: new Date() },
  });

  // Link the Discord server to the creator
  await db.discordServer.upsert({
    where: { guildId },
    create: {
      guildId,
      guildName: linkToken.guildName,
      creatorId: creator.id,
    },
    update: {
      creatorId: creator.id,
    },
  });

  // Save guildId on the creator record
  await db.creator.update({
    where: { id: creator.id },
    data: { discordGuildId: guildId },
  });

  console.log(`[Discord Link] Linked guild ${guildId} (${linkToken.guildName}) to creator ${creator.email}`);

  return NextResponse.json({ success: true, guildName: linkToken.guildName });
}
