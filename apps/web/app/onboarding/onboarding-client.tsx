'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface OnboardingClientProps {
  hasRobloxOAuth: boolean;
  robloxUsername: string | null;
  robloxDisplayName: string | null;
  hasApiKey: boolean;
}

export function OnboardingClient({
  hasRobloxOAuth,
  robloxUsername,
  robloxDisplayName,
  hasApiKey,
}: OnboardingClientProps) {
  const searchParams = useSearchParams();
  const startAtApiKey = searchParams.get('step') === 'apikey';

  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(hasApiKey);

  const step1Complete = hasRobloxOAuth;
  const step2Complete = saved;

  async function handleSaveApiKey() {
    if (!apiKey.trim()) {
      setError('Please enter your API key');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/roblox/apikey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to save API key');
        setSaving(false);
        return;
      }

      setSaved(true);
      setSaving(false);

      window.location.href = '/dashboard?roblox=connected';
    } catch {
      setError('Network error. Please try again.');
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-center">Connect Your Roblox Account</h1>
        <p className="mt-2 text-center text-gray-400">
          Two quick steps to activate your AI agents.
        </p>

        <div className="mt-10 space-y-6">
          {/* Step 1: OAuth */}
          <div className={`rounded-xl border p-6 ${step1Complete ? 'border-green-400/30 bg-green-400/5' : 'border-gray-700 bg-gray-900'}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${step1Complete ? 'bg-green-400/20 text-green-400' : 'bg-brand-500/20 text-brand-400'}`}>
                {step1Complete ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : '1'}
              </div>
              <div>
                <h2 className="font-semibold text-white">Connect with Roblox (OAuth)</h2>
                <p className="text-sm text-gray-400">
                  {step1Complete
                    ? `Connected as ${robloxDisplayName ?? robloxUsername ?? 'Roblox User'}`
                    : 'Sign in with your Roblox account to verify your identity.'}
                </p>
              </div>
            </div>
            {!step1Complete && (
              <button
                onClick={() => { window.location.href = '/api/roblox/connect'; }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 font-semibold text-white transition hover:bg-brand-500"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.164 0L0 18.627l18.836 5.373L24 5.373 5.164 0zM13.637 15.836l-5.473-1.527 1.527-5.473 5.473 1.527-1.527 5.473z" />
                </svg>
                Connect with Roblox
              </button>
            )}
          </div>

          {/* Step 2: API Key */}
          <div className={`rounded-xl border p-6 ${step2Complete ? 'border-green-400/30 bg-green-400/5' : step1Complete || startAtApiKey ? 'border-gray-700 bg-gray-900' : 'border-gray-800 bg-gray-900/50 opacity-50'}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${step2Complete ? 'bg-green-400/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                {step2Complete ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : '2'}
              </div>
              <div>
                <h2 className="font-semibold text-white">Add API Key for Agent Access</h2>
                <p className="text-sm text-gray-400">
                  {step2Complete
                    ? 'API key saved. Agents are ready to run.'
                    : 'Your API key lets agents read analytics and optimize your games.'}
                </p>
              </div>
            </div>

            {(step1Complete || startAtApiKey) && !step2Complete && (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg bg-gray-800/50 p-4 text-sm text-gray-300">
                  <p className="font-medium text-white">How to get your API key:</p>
                  <ol className="mt-2 list-inside list-decimal space-y-1.5 text-gray-400">
                    <li>Go to <a href="https://create.roblox.com/dashboard/credentials" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300 underline">create.roblox.com/dashboard/credentials</a></li>
                    <li>Click <strong className="text-white">Create API Key</strong></li>
                    <li>Name it <strong className="text-white">Devmaxx</strong></li>
                    <li>Add these API Systems:
                      <ul className="ml-4 mt-1 list-inside list-disc space-y-0.5">
                        <li>Universe &rarr; Read (for analytics)</li>
                        <li>DataStore &rarr; Read &amp; Write</li>
                        <li>Place &rarr; Read</li>
                      </ul>
                    </li>
                    <li>Under Security, add <strong className="text-white">0.0.0.0/0</strong> to allowed IPs</li>
                    <li>Copy the generated key and paste below</li>
                  </ol>
                </div>

                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your Roblox Open Cloud API key"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />

                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}

                <button
                  onClick={handleSaveApiKey}
                  disabled={saving}
                  className="w-full rounded-lg bg-brand-600 py-3 font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save API Key & Activate Agents'}
                </button>
              </div>
            )}
          </div>
        </div>

        {step1Complete && !step2Complete && (
          <p className="mt-6 text-center text-sm text-gray-500">
            You can skip this step and add your API key later from the dashboard.{' '}
            <a href="/dashboard" className="text-brand-400 hover:text-brand-300">
              Go to Dashboard
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
