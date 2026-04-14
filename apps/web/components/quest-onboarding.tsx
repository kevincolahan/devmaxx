'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface QuestOnboardingProps {
  hasRobloxOAuth: boolean;
  robloxUsername: string | null;
  robloxDisplayName: string | null;
  hasApiKey: boolean;
}

const STEPS = [
  {
    id: 'oauth',
    icon: '\uD83D\uDD17',
    name: 'Connect Your Game',
    description: 'Sign in with your Roblox account to verify your identity.',
    xp: 500,
  },
  {
    id: 'apikey',
    icon: '\uD83D\uDD11',
    name: 'Add API Key',
    description: 'Let agents read your analytics and optimize your games.',
    xp: 500,
  },
  {
    id: 'activate',
    icon: '\uD83D\uDE80',
    name: 'Activate Agents',
    description: 'Your agents start running automatically.',
    xp: 200,
  },
];

export function QuestOnboarding({
  hasRobloxOAuth,
  robloxUsername,
  robloxDisplayName,
  hasApiKey,
}: QuestOnboardingProps) {
  const searchParams = useSearchParams();
  const startAtApiKey = searchParams.get('step') === 'apikey';

  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(hasApiKey);

  const step1Complete = hasRobloxOAuth;
  const step2Complete = saved;
  const allComplete = step1Complete && step2Complete;

  const completedSteps = (step1Complete ? 1 : 0) + (step2Complete ? 1 : 0) + (allComplete ? 1 : 0);
  const totalXP = STEPS.slice(0, completedSteps).reduce((sum, s) => sum + s.xp, 0);

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

  function getStepStatus(idx: number): 'complete' | 'active' | 'locked' {
    if (idx === 0) return step1Complete ? 'complete' : 'active';
    if (idx === 1) return step2Complete ? 'complete' : (step1Complete || startAtApiKey) ? 'active' : 'locked';
    return allComplete ? 'complete' : 'locked';
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Quest header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-400">
            ACTIVE QUEST
          </div>
          <h1 className="mt-4 text-3xl font-bold text-white">First Contact</h1>
          <p className="mt-2 text-gray-400">
            Complete these quests to activate your AI agents.
          </p>
        </div>

        {/* Overall progress */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-gray-400">
              Step {Math.min(completedSteps + 1, 3)} of 3
            </span>
            <span className="font-medium text-indigo-400">+{totalXP} XP earned</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-700"
              style={{ width: `${(completedSteps / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Quest steps */}
        <div className="mt-8 space-y-4">
          {STEPS.map((step, idx) => {
            const status = getStepStatus(idx);

            return (
              <div
                key={step.id}
                className={`rounded-xl border p-5 transition-all ${
                  status === 'complete'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : status === 'active'
                      ? 'border-indigo-500/40 bg-gray-900'
                      : 'border-gray-800 bg-gray-900/50 opacity-50'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon / status */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${
                      status === 'complete'
                        ? 'bg-emerald-500/20'
                        : status === 'active'
                          ? 'bg-indigo-500/20'
                          : 'bg-gray-800'
                    }`}
                  >
                    {status === 'complete' ? (
                      <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span>{step.icon}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-white">{step.name}</h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          status === 'complete'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-indigo-500/10 text-indigo-400'
                        }`}
                      >
                        +{step.xp} XP
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-400">
                      {status === 'complete' && idx === 0
                        ? `Connected as ${robloxDisplayName ?? robloxUsername ?? 'Roblox User'}`
                        : status === 'complete' && idx === 1
                          ? 'API key saved. Agents are ready.'
                          : status === 'complete' && idx === 2
                            ? 'Agents activated!'
                            : step.description}
                    </p>
                  </div>
                </div>

                {/* Step 1: OAuth button */}
                {idx === 0 && status === 'active' && (
                  <button
                    onClick={() => { window.location.href = '/api/roblox/connect'; }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 font-semibold text-white transition hover:bg-indigo-500"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M5.164 0L0 18.627l18.836 5.373L24 5.373 5.164 0zM13.637 15.836l-5.473-1.527 1.527-5.473 5.473 1.527-1.527 5.473z" />
                    </svg>
                    Connect with Roblox
                  </button>
                )}

                {/* Step 2: API Key input */}
                {idx === 1 && status === 'active' && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-lg bg-gray-800/50 p-4 text-sm text-gray-300">
                      <p className="font-medium text-white">How to get your API key:</p>
                      <ol className="mt-2 list-inside list-decimal space-y-1.5 text-gray-400">
                        <li>Go to <a href="https://create.roblox.com/dashboard/credentials" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline hover:text-indigo-300">create.roblox.com/dashboard/credentials</a></li>
                        <li>Click <strong className="text-white">Create API Key</strong></li>
                        <li>Name it <strong className="text-white">Devmaxx</strong></li>
                        <li>Add API Systems:
                          <ul className="ml-4 mt-1 list-inside list-disc space-y-0.5">
                            <li>Universe &rarr; Read</li>
                            <li>DataStore &rarr; Read &amp; Write</li>
                            <li>Place &rarr; Read</li>
                          </ul>
                        </li>
                        <li>Under Security, add <strong className="text-white">0.0.0.0/0</strong> to allowed IPs</li>
                        <li>Copy the key and paste below</li>
                      </ol>
                    </div>

                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Paste your Roblox Open Cloud API key"
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />

                    {error && <p className="text-sm text-red-400">{error}</p>}

                    <button
                      onClick={handleSaveApiKey}
                      disabled={saving}
                      className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save API Key & Activate Agents'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {step1Complete && !step2Complete && (
          <p className="mt-6 text-center text-sm text-gray-500">
            You can skip this quest and add your API key later.{' '}
            <a href="/dashboard" className="text-indigo-400 hover:text-indigo-300">
              Go to Dashboard
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
