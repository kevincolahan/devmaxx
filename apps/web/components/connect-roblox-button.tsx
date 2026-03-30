'use client';

interface ConnectRobloxButtonProps {
  isConnected: boolean;
  robloxUserId: string | null;
  robloxUsername: string | null;
  robloxDisplayName: string | null;
  hasApiKey: boolean;
}

export function ConnectRobloxButton({
  isConnected,
  robloxUserId,
  robloxUsername,
  robloxDisplayName,
  hasApiKey,
}: ConnectRobloxButtonProps) {
  function handleConnect() {
    window.location.href = '/api/roblox/connect';
  }

  function handleAddApiKey() {
    window.location.href = '/onboarding?step=apikey';
  }

  function handleDisconnect() {
    if (confirm('Disconnect your Roblox account? Agents will stop running.')) {
      fetch('/api/roblox/disconnect', { method: 'POST' }).then(() => {
        window.location.reload();
      });
    }
  }

  if (isConnected && hasApiKey) {
    return (
      <div className="rounded-xl border border-green-400/30 bg-green-400/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-400/20">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.164 0L0 18.627l18.836 5.373L24 5.373 5.164 0zM13.637 15.836l-5.473-1.527 1.527-5.473 5.473 1.527-1.527 5.473z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-green-400">Roblox Connected</p>
              <p className="text-xs text-gray-400">
                {robloxDisplayName ?? robloxUsername ?? `User ${robloxUserId}`}
                {robloxUsername && (
                  <span className="text-gray-500"> @{robloxUsername}</span>
                )}
                <span className="ml-2 text-green-500">API key active</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            className="rounded-md px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-800 hover:text-gray-300"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  if (isConnected && !hasApiKey) {
    return (
      <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400/20">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.164 0L0 18.627l18.836 5.373L24 5.373 5.164 0zM13.637 15.836l-5.473-1.527 1.527-5.473 5.473 1.527-1.527 5.473z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-yellow-400">Roblox Connected — API key needed</p>
              <p className="text-xs text-gray-400">
                {robloxDisplayName ?? robloxUsername ?? `User ${robloxUserId}`} — Add your API key to enable agents.
              </p>
            </div>
          </div>
          <button
            onClick={handleAddApiKey}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-500"
          >
            Add API Key
          </button>
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
