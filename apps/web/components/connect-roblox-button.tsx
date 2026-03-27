'use client';

interface ConnectRobloxButtonProps {
  isConnected: boolean;
  robloxUserId: string | null;
}

export function ConnectRobloxButton({ isConnected, robloxUserId }: ConnectRobloxButtonProps) {
  async function handleConnect() {
    // Placeholder — Phase 1 Roblox OAuth flow will redirect to:
    // https://apis.roblox.com/oauth/v1/authorize
    // with client_id, redirect_uri, scope, response_type=code
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_ROBLOX_OAUTH_CLIENT_ID ?? '',
      redirect_uri: `${window.location.origin}/api/roblox/callback`,
      response_type: 'code',
      scope: 'universe.place:read universe.analyticsservice:read universe.datastoreservice:read economy:read',
      state: crypto.randomUUID(),
    });

    window.location.href = `https://apis.roblox.com/oauth/v1/authorize?${params.toString()}`;
  }

  if (isConnected) {
    return (
      <div className="rounded-xl border border-green-400/30 bg-green-400/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-400/20">
            <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-green-400">Roblox Connected</p>
            <p className="text-xs text-gray-400">User ID: {robloxUserId}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-6 py-4 font-semibold text-white transition hover:border-brand-500 hover:bg-gray-800"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.164 0L0 18.627l18.836 5.373L24 5.373 5.164 0zM13.637 15.836l-5.473-1.527 1.527-5.473 5.473 1.527-1.527 5.473z" />
      </svg>
      Connect Roblox Account
    </button>
  );
}
