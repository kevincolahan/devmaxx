import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { DiscordLinkClient } from './link-client';

export default async function DiscordLinkPage({
  searchParams,
}: {
  searchParams: { token?: string; guildId?: string };
}) {
  const session = await auth();

  if (!session?.user?.email) {
    // Redirect to login, then back here
    const returnUrl = `/discord/link?token=${searchParams.token ?? ''}&guildId=${searchParams.guildId ?? ''}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(returnUrl)}`);
  }

  const token = searchParams.token;
  const guildId = searchParams.guildId;

  if (!token || !guildId) {
    return (
      <DiscordLinkClient
        status="error"
        message="Missing token or guildId. Use /devmaxx connect in Discord to get a new link."
      />
    );
  }

  // Validate token
  const linkToken = await db.discordLinkToken.findUnique({ where: { token } });

  if (!linkToken) {
    return (
      <DiscordLinkClient
        status="error"
        message="Invalid link token. Use /devmaxx connect in Discord to get a new link."
      />
    );
  }

  if (linkToken.usedAt) {
    return (
      <DiscordLinkClient
        status="error"
        message="This link has already been used. Use /devmaxx connect in Discord to get a new one."
      />
    );
  }

  if (new Date() > linkToken.expiresAt) {
    return (
      <DiscordLinkClient
        status="error"
        message="This link has expired. Use /devmaxx connect in Discord to get a new one (valid for 15 minutes)."
      />
    );
  }

  if (linkToken.guildId !== guildId) {
    return (
      <DiscordLinkClient
        status="error"
        message="Token and server ID do not match."
      />
    );
  }

  // Find the creator
  const creator = await db.creator.findUnique({
    where: { email: session.user.email },
  });

  if (!creator) {
    return (
      <DiscordLinkClient
        status="error"
        message="No Devmaxx account found. Sign up at devmaxx.app first."
      />
    );
  }

  return (
    <DiscordLinkClient
      status="ready"
      guildName={linkToken.guildName}
      guildId={guildId}
      token={token}
      creatorEmail={creator.email}
      creatorId={creator.id}
    />
  );
}
