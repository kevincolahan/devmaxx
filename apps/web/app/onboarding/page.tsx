import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { OnboardingClient } from './onboarding-client';

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/login');
  }

  const creator = await db.creator.findUnique({
    where: { email: session.user.email },
  });

  if (creator?.robloxUserId && creator?.robloxApiKey) {
    redirect('/dashboard');
  }

  return (
    <OnboardingClient
      hasRobloxOAuth={!!creator?.robloxUserId}
      robloxUsername={creator?.robloxUsername ?? null}
      robloxDisplayName={creator?.robloxDisplayName ?? null}
      hasApiKey={!!creator?.robloxApiKey}
    />
  );
}
