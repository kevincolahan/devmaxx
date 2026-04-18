'use client';

import { useState } from 'react';
import Link from 'next/link';

interface DiscordLinkClientProps {
  status: 'ready' | 'error';
  message?: string;
  guildName?: string;
  guildId?: string;
  token?: string;
  creatorEmail?: string;
  creatorId?: string;
}

export function DiscordLinkClient({
  status,
  message,
  guildName,
  guildId,
  token,
  creatorEmail,
  creatorId,
}: DiscordLinkClientProps) {
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLink() {
    if (!token || !guildId || !creatorId) return;
    setLinking(true);
    setError(null);

    try {
      const res = await fetch('/api/discord/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, guildId, creatorId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to link');
        return;
      }

      setLinked(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setLinking(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        {/* Error state */}
        {status === 'error' && (
          <div className="rounded-2xl border border-red-500/20 bg-[#0F0F1E] p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-3xl">
              &#10060;
            </div>
            <h1 className="mt-4 text-xl font-bold text-white">Link Failed</h1>
            <p className="mt-2 text-sm text-gray-400">{message}</p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Go to Dashboard
            </Link>
          </div>
        )}

        {/* Ready to link */}
        {status === 'ready' && !linked && (
          <div className="rounded-2xl border border-[rgba(79,70,229,0.2)] bg-[#0F0F1E] p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#5865F2]/20">
              <svg className="h-8 w-8 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
              </svg>
            </div>
            <h1 className="mt-4 text-xl font-bold text-white">Link Discord Server</h1>
            <p className="mt-2 text-sm text-gray-400">
              Connect <strong className="text-white">{guildName}</strong> to your Devmaxx account
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Signed in as {creatorEmail}
            </p>

            <div className="mt-6 rounded-lg bg-[#141428] p-4 text-left text-sm text-gray-400">
              <p>This will enable:</p>
              <ul className="mt-2 space-y-1">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> /devmaxx status with your real game data
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> Weekly GrowthBrief in your server
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> Automatic DAU and competitor alerts
                </li>
              </ul>
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-400">{error}</p>
            )}

            <button
              onClick={handleLink}
              disabled={linking}
              className="mt-6 w-full rounded-lg bg-[#5865F2] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#4752C4] disabled:opacity-50"
            >
              {linking ? 'Linking...' : 'Link This Server'}
            </button>

            <Link
              href="/dashboard"
              className="mt-3 block text-xs text-gray-600 transition hover:text-gray-400"
            >
              Cancel
            </Link>
          </div>
        )}

        {/* Success */}
        {linked && (
          <div className="rounded-2xl border border-emerald-500/20 bg-[#0F0F1E] p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-3xl">
              &#10004;
            </div>
            <h1 className="mt-4 text-xl font-bold text-white">Server Linked!</h1>
            <p className="mt-2 text-sm text-gray-400">
              <strong className="text-white">{guildName}</strong> is now connected to your Devmaxx account.
            </p>

            <div className="mt-6 rounded-lg bg-[#141428] p-4 text-left text-sm text-gray-400">
              <p className="font-medium text-white">Try these in Discord:</p>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                <li className="text-indigo-400">/devmaxx status</li>
                <li className="text-indigo-400">/devmaxx brief</li>
                <li className="text-indigo-400">/devmaxx alerts on</li>
              </ul>
            </div>

            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Go to Dashboard
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
