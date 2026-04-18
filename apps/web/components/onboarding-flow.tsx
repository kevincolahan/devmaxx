'use client';

import { useState } from 'react';
import Link from 'next/link';

interface OnboardingFlowProps {
  creatorId: string;
  currentStep: number;
  isRobloxConnected: boolean;
  robloxUsername: string | null;
  hasApiKey: boolean;
  hasGames: boolean;
  onComplete: () => void;
  onDismiss: () => void;
}

const STEPS = [
  { label: 'Connect Roblox', xp: 500 },
  { label: 'Add API Key', xp: 300 },
  { label: 'Track Competitor', xp: 200 },
  { label: 'Revenue Goal', xp: 100 },
  { label: 'All Set', xp: 500 },
];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
              i < current
                ? 'bg-emerald-500 text-white'
                : i === current
                ? 'bg-indigo-600 text-white ring-2 ring-indigo-400/30'
                : 'bg-gray-800 text-gray-500'
            }`}
          >
            {i < current ? (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              i + 1
            )}
          </div>
          {i < total - 1 && (
            <div className={`mx-1 h-0.5 w-6 sm:w-10 ${i < current ? 'bg-emerald-500' : 'bg-gray-800'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function XpBadge({ xp }: { xp: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
      +{xp} XP
    </span>
  );
}

export function OnboardingFlow({
  creatorId,
  currentStep,
  isRobloxConnected,
  robloxUsername,
  hasApiKey,
  hasGames,
  onComplete,
  onDismiss,
}: OnboardingFlowProps) {
  const [step, setStep] = useState(() => {
    // Auto-advance based on current state
    if (currentStep >= 5) return 5;
    if (!isRobloxConnected) return 0;
    if (!hasApiKey) return 1;
    return Math.max(currentStep, 2);
  });
  const [apiKey, setApiKey] = useState('');
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [competitorSearch, setCompetitorSearch] = useState('');
  const [revenueGoal, setRevenueGoal] = useState(1000);
  const [saving, setSaving] = useState(false);

  async function saveStep(nextStep: number) {
    setSaving(true);
    try {
      await fetch('/api/xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'agent_run' }),
      });

      // Update onboarding step on the server
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://devmaxx-production.up.railway.app';
      await fetch(`${API_BASE}/api/onboarding/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, step: nextStep }),
      }).catch(() => {});

      setStep(nextStep);
    } catch {
      // Continue anyway
      setStep(nextStep);
    } finally {
      setSaving(false);
    }
  }

  async function submitApiKey() {
    if (!apiKey.trim()) return;
    setApiKeyLoading(true);
    setApiKeyError(null);
    try {
      const res = await fetch('/api/roblox/apikey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setApiKeyError(data.error || 'Failed to save API key');
        return;
      }
      await saveStep(2);
    } catch (err) {
      setApiKeyError(String(err));
    } finally {
      setApiKeyLoading(false);
    }
  }

  if (step >= 5) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-[rgba(79,70,229,0.2)] bg-[#0F0F1E] p-6 shadow-2xl sm:p-8">
        {/* Close/skip */}
        <button
          onClick={onDismiss}
          className="absolute right-4 top-4 text-gray-500 transition hover:text-gray-300"
          title="Skip for now"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Progress */}
        <div className="mb-6">
          <StepIndicator current={step} total={5} />
          <p className="mt-3 text-center text-xs text-gray-500">
            Step {step + 1} of 5 &middot; {STEPS[step]?.label}
          </p>
        </div>

        {/* ═══ STEP 0: Connect Roblox ═══ */}
        {step === 0 && (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/20 text-3xl">
              &#127918;
            </div>
            <h2 className="mt-4 text-xl font-bold text-white">Connect Your Roblox Account</h2>
            <p className="mt-2 text-sm text-gray-400">
              This lets Devmaxx read your game analytics and run agents on your behalf.
            </p>

            {isRobloxConnected ? (
              <div className="mt-6">
                <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Connected as @{robloxUsername ?? 'Unknown'}
                </div>
                <div className="mt-3"><XpBadge xp={500} /></div>
                <button
                  onClick={() => saveStep(1)}
                  disabled={saving}
                  className="mt-4 w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="mt-6">
                <Link
                  href="/api/roblox/connect"
                  className="inline-block rounded-lg bg-indigo-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  Connect Roblox Account
                </Link>
                <div className="mt-3"><XpBadge xp={500} /></div>
              </div>
            )}

            <button
              onClick={() => saveStep(1)}
              className="mt-4 text-xs text-gray-600 transition hover:text-gray-400"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* ═══ STEP 1: API Key ═══ */}
        {step === 1 && (
          <div>
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-600/20 text-3xl">
                &#128273;
              </div>
              <h2 className="mt-4 text-xl font-bold text-white">Add Your API Key</h2>
              <p className="mt-2 text-sm text-gray-400">
                Agents need this to read your game&rsquo;s analytics, player data, and revenue.
              </p>
            </div>

            {hasApiKey ? (
              <div className="mt-6 text-center">
                <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  API Key saved
                </div>
                <div className="mt-3"><XpBadge xp={300} /></div>
                <button
                  onClick={() => saveStep(2)}
                  disabled={saving}
                  className="mt-4 w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            ) : (
              <>
                <div className="mt-5 rounded-lg bg-[#141428] p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">How to get your API key</h4>
                  <ol className="mt-3 space-y-2 text-xs text-gray-400">
                    <li className="flex gap-2">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[9px] font-bold text-gray-300">1</span>
                      Go to <a href="https://create.roblox.com/credentials" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">create.roblox.com/credentials</a>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[9px] font-bold text-gray-300">2</span>
                      Click &ldquo;Create API Key&rdquo;
                    </li>
                    <li className="flex gap-2">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[9px] font-bold text-gray-300">3</span>
                      Name it &ldquo;Devmaxx&rdquo;
                    </li>
                    <li className="flex gap-2">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[9px] font-bold text-gray-300">4</span>
                      Add permissions: <code className="rounded bg-gray-800 px-1 text-indigo-300">universe:read</code>, <code className="rounded bg-gray-800 px-1 text-indigo-300">universe-places:read</code>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[9px] font-bold text-gray-300">5</span>
                      Set Accepted IP: <code className="rounded bg-gray-800 px-1 text-indigo-300">0.0.0.0/0</code>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[9px] font-bold text-gray-300">6</span>
                      Copy the key and paste below
                    </li>
                  </ol>
                </div>

                <div className="mt-4">
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your API key here"
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
                  />
                  {apiKeyError && (
                    <p className="mt-2 text-xs text-red-400">{apiKeyError}</p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <XpBadge xp={300} />
                  <button
                    onClick={submitApiKey}
                    disabled={!apiKey.trim() || apiKeyLoading}
                    className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {apiKeyLoading ? 'Saving...' : 'Save API Key'}
                  </button>
                </div>

                <button
                  onClick={() => saveStep(2)}
                  className="mt-3 w-full text-center text-xs text-gray-600 transition hover:text-gray-400"
                >
                  Skip for now
                </button>
              </>
            )}
          </div>
        )}

        {/* ═══ STEP 2: Add Competitor ═══ */}
        {step === 2 && (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-600/20 text-3xl">
              &#128269;
            </div>
            <h2 className="mt-4 text-xl font-bold text-white">Track a Competitor Game</h2>
            <p className="mt-2 text-sm text-gray-400">
              Track a rival game to see when they update, surge, or drop. Know before your players leave.
            </p>

            <div className="mt-6">
              <input
                type="text"
                value={competitorSearch}
                onChange={(e) => setCompetitorSearch(e.target.value)}
                placeholder="Enter a Roblox game name or ID"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-2 text-xs text-gray-600">
                You can add this later from your dashboard too.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <XpBadge xp={200} />
              <button
                onClick={() => saveStep(3)}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {competitorSearch.trim() ? 'Add & Continue' : 'Continue'}
              </button>
            </div>

            <button
              onClick={() => saveStep(3)}
              className="mt-3 text-xs text-gray-600 transition hover:text-gray-400"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* ═══ STEP 3: Revenue Goal ═══ */}
        {step === 3 && (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/20 text-3xl">
              &#127919;
            </div>
            <h2 className="mt-4 text-xl font-bold text-white">Set Your Revenue Goal</h2>
            <p className="mt-2 text-sm text-gray-400">
              What&rsquo;s your monthly DevEx target? Agents will optimize toward this.
            </p>

            <div className="mt-6">
              <div className="text-3xl font-bold text-emerald-400">
                ${revenueGoal >= 10000 ? '10,000+' : revenueGoal.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-gray-500">per month</div>
              <input
                type="range"
                min={100}
                max={10000}
                step={100}
                value={revenueGoal}
                onChange={(e) => setRevenueGoal(parseInt(e.target.value, 10))}
                className="mt-4 w-full accent-emerald-500"
              />
              <div className="mt-1 flex justify-between text-[10px] text-gray-600">
                <span>$100</span>
                <span>$10,000+</span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <XpBadge xp={100} />
              <button
                onClick={() => saveStep(4)}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                Set Goal & Continue
              </button>
            </div>

            <button
              onClick={() => saveStep(4)}
              className="mt-3 text-xs text-gray-600 transition hover:text-gray-400"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* ═══ STEP 4: Complete ═══ */}
        {step === 4 && (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/20 text-3xl">
              &#127881;
            </div>
            <h2 className="mt-4 text-xl font-bold text-white">You&rsquo;re All Set!</h2>
            <p className="mt-2 text-sm text-gray-400">
              Your first GrowthBrief arrives Sunday at 6pm UTC.
            </p>

            <div className="mt-6 rounded-lg bg-[#141428] p-4 text-left">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">What&rsquo;s in your GrowthBrief</h4>
              <ul className="mt-2 space-y-1.5 text-xs text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> DAU, retention, and revenue trends
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> Competitor movements
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> Pricing optimization recommendations
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> Top 3 actions to grow this week
                </li>
              </ul>
            </div>

            <div className="mt-4"><XpBadge xp={500} /></div>

            <button
              onClick={() => {
                saveStep(5);
                onComplete();
              }}
              className="mt-4 w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Setup Banner (shown on dashboard when onboarding incomplete) ── */

export function OnboardingBanner({
  step,
  onResume,
}: {
  step: number;
  onResume: () => void;
}) {
  if (step >= 5) return null;

  const remaining = 5 - step;

  return (
    <div className="mb-6 flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-600/5 px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-sm">
          &#128640;
        </div>
        <div>
          <p className="text-sm font-medium text-white">Complete your setup</p>
          <p className="text-xs text-gray-400">{remaining} step{remaining !== 1 ? 's' : ''} remaining to unlock all agents</p>
        </div>
      </div>
      <button
        onClick={onResume}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
      >
        Continue setup
      </button>
    </div>
  );
}
