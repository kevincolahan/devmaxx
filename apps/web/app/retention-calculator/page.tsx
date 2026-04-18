'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';

/* ──────────────────────────────────────────────
   BENCHMARK DATA
   ────────────────────────────────────────────── */

type Genre = 'tycoon' | 'simulator' | 'obby' | 'rpg' | 'roleplay' | 'fighting' | 'horror' | 'adventure' | 'other';

interface GenreBenchmark {
  d1: number; d7: number; d30: number;
  top10_d1: number; top10_d7: number; top10_d30: number;
}

const BENCHMARKS: Record<Genre, GenreBenchmark> = {
  tycoon:    { d1: 28, d7: 13, d30: 6,  top10_d1: 48, top10_d7: 26, top10_d30: 13 },
  simulator: { d1: 25, d7: 11, d30: 5,  top10_d1: 45, top10_d7: 23, top10_d30: 11 },
  obby:      { d1: 20, d7: 8,  d30: 3,  top10_d1: 38, top10_d7: 17, top10_d30: 7 },
  rpg:       { d1: 32, d7: 16, d30: 8,  top10_d1: 52, top10_d7: 30, top10_d30: 15 },
  roleplay:  { d1: 30, d7: 14, d30: 7,  top10_d1: 50, top10_d7: 28, top10_d30: 14 },
  fighting:  { d1: 22, d7: 10, d30: 4,  top10_d1: 40, top10_d7: 20, top10_d30: 9 },
  horror:    { d1: 18, d7: 7,  d30: 3,  top10_d1: 35, top10_d7: 15, top10_d30: 6 },
  adventure: { d1: 26, d7: 12, d30: 5,  top10_d1: 46, top10_d7: 24, top10_d30: 11 },
  other:     { d1: 24, d7: 11, d30: 5,  top10_d1: 43, top10_d7: 22, top10_d30: 10 },
};

const GENRE_LABELS: Record<Genre, string> = {
  tycoon: 'Tycoon', simulator: 'Simulator', obby: 'Obby', rpg: 'RPG',
  roleplay: 'Roleplay', fighting: 'Fighting', horror: 'Horror',
  adventure: 'Adventure', other: 'Other',
};

/* ──────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────── */

function calcScore(d1: number, d7: number, d30: number, bench: GenreBenchmark): number {
  const d1Score = Math.min(100, (d1 / bench.top10_d1) * 100);
  const d7Score = Math.min(100, (d7 / bench.top10_d7) * 100);
  const d30Score = Math.min(100, (d30 / bench.top10_d30) * 100);
  return Math.round(d1Score * 0.3 + d7Score * 0.4 + d30Score * 0.3);
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 70) return 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/30';
  if (score >= 40) return 'from-yellow-600/20 to-yellow-600/5 border-yellow-500/30';
  return 'from-red-600/20 to-red-600/5 border-red-500/30';
}

function scoreBarColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function cellColor(yours: number, avg: number, top10: number): string {
  if (yours >= top10) return 'text-emerald-400 font-bold';
  if (yours >= avg) return 'text-emerald-400';
  if (yours >= avg * 0.7) return 'text-yellow-400';
  return 'text-red-400';
}

function getDiagnosis(d1: number, d7: number, d30: number, bench: GenreBenchmark): string[] {
  const tips: string[] = [];

  if (d1 < bench.d1) {
    tips.push('Your D1 retention is below genre average. Focus on improving the first-time user experience: tutorial flow, initial rewards, and first 5 minutes of gameplay.');
  } else if (d1 >= bench.top10_d1) {
    tips.push('Your D1 retention is top-tier. Players love the first impression. Now focus on converting that into long-term engagement.');
  }

  const d1_to_d7_dropoff = d1 > 0 ? ((d1 - d7) / d1) * 100 : 0;
  if (d1_to_d7_dropoff > 70 && d1 >= bench.d1) {
    tips.push(`Your D1 is strong but you lose ${Math.round(d1_to_d7_dropoff)}% by day 7. Add engagement hooks for days 3-7: daily rewards, progression milestones, social features, or limited-time events.`);
  }

  if (d7 >= bench.d7 && d30 < bench.d30) {
    tips.push('D7 retention is solid but D30 drops off. Your mid-game content may be thin. Consider adding endgame systems, competitive leaderboards, or seasonal content to keep veteran players engaged.');
  }

  if (d30 >= bench.top10_d30) {
    tips.push('Your D30 retention is exceptional. Your core players are loyal. Focus on new player acquisition and monetization optimization to maximize revenue from this engaged base.');
  }

  if (d7 < bench.d7 * 0.7) {
    tips.push('D7 retention needs attention. Players are leaving before they get hooked. Test adding: friend invites, daily login streaks, progression unlocks at day 3/5/7.');
  }

  if (tips.length === 0) {
    tips.push('Your retention is roughly in line with genre averages. Focus on incremental improvements: A/B test your onboarding, add one more daily engagement hook, and track where players churn most.');
  }

  return tips.slice(0, 3);
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/* ──────────────────────────────────────────────
   COMPONENT
   ────────────────────────────────────────────── */

export default function RetentionCalculatorPage() {
  const [genre, setGenre] = useState<Genre>('simulator');
  const [d1, setD1] = useState(25);
  const [d7, setD7] = useState(11);
  const [d30, setD30] = useState(5);
  const [dau, setDau] = useState<string>('');
  const [dailyRobux, setDailyRobux] = useState<string>('');

  const bench = BENCHMARKS[genre];
  const score = useMemo(() => calcScore(d1, d7, d30, bench), [d1, d7, d30, bench]);
  const diagnosis = useMemo(() => getDiagnosis(d1, d7, d30, bench), [d1, d7, d30, bench]);

  const dauNum = parseInt(dau, 10) || 0;
  const robuxNum = parseInt(dailyRobux, 10) || 0;

  const hasRevenue = dauNum > 0 && robuxNum > 0;
  const currentMonthlyUSD = hasRevenue ? robuxNum * 30 * 0.0035 : 0;
  const d7UpsideMultiplier = d7 > 0 ? bench.top10_d7 / d7 : 1;
  const projectedMonthlyUSD = currentMonthlyUSD * d7UpsideMultiplier;
  const uplift = projectedMonthlyUSD - currentMonthlyUSD;

  const shareText = encodeURIComponent(
    `My Roblox game has ${d7}% D7 retention \u2014 scored ${score}/100 on the Devmaxx benchmark tool. devmaxx.app/retention-calculator`
  );

  return (
    <main className="relative min-h-screen bg-gray-950">
      {/* Grid background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(79,70,229,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(79,70,229,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 border-b border-gray-800/50 bg-gray-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-white">Devmaxx</Link>
          <div className="flex items-center gap-6">
            <Link href="/leaderboard" className="text-sm text-gray-400 transition hover:text-white">Leaderboard</Link>
            <Link href="/devex-calculator" className="text-sm text-gray-400 transition hover:text-white">DevEx Calculator</Link>
            <Link href="/retention-calculator" className="text-sm font-medium text-indigo-400">Retention Calculator</Link>
            <Link href="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500">Sign in</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-4 pb-8 pt-12 text-center sm:pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          Is Your Roblox Game&rsquo;s Retention Good?
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-400">
          Enter your numbers and see how you compare to the top 10% of games in your genre.
        </p>
      </section>

      <div className="relative mx-auto max-w-5xl px-4 pb-20">
        <div className="grid gap-8 lg:grid-cols-5">

          {/* ── LEFT: Inputs (2 cols) ── */}
          <div className="space-y-6 lg:col-span-2">
            {/* Genre selector */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-400">Game Genre</label>
              <select
                value={genre}
                onChange={(e) => {
                  const g = e.target.value as Genre;
                  setGenre(g);
                  setD1(BENCHMARKS[g].d1);
                  setD7(BENCHMARKS[g].d7);
                  setD30(BENCHMARKS[g].d30);
                }}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                {Object.entries(GENRE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* D1 Slider */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-400">D1 Retention</label>
                <span className="text-sm font-bold text-white">{d1}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={d1}
                onChange={(e) => setD1(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-500"
              />
              <div className="mt-1 flex justify-between text-[10px] text-gray-600">
                <span>0%</span>
                <span>Genre avg: {bench.d1}%</span>
                <span>100%</span>
              </div>
            </div>

            {/* D7 Slider */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-400">D7 Retention</label>
                <span className="text-sm font-bold text-white">{d7}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={d7}
                onChange={(e) => setD7(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-500"
              />
              <div className="mt-1 flex justify-between text-[10px] text-gray-600">
                <span>0%</span>
                <span>Genre avg: {bench.d7}%</span>
                <span>100%</span>
              </div>
            </div>

            {/* D30 Slider */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-400">D30 Retention</label>
                <span className="text-sm font-bold text-white">{d30}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={d30}
                onChange={(e) => setD30(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-500"
              />
              <div className="mt-1 flex justify-between text-[10px] text-gray-600">
                <span>0%</span>
                <span>Genre avg: {bench.d30}%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Optional: DAU */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-400">Current DAU (optional)</label>
              <input
                type="number" value={dau} onChange={(e) => setDau(e.target.value)}
                placeholder="e.g. 500"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Optional: Daily Robux */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-400">Avg Daily Revenue in Robux (optional)</label>
              <input
                type="number" value={dailyRobux} onChange={(e) => setDailyRobux(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* ── RIGHT: Results (3 cols) ── */}
          <div className="space-y-6 lg:col-span-3">

            {/* Score card */}
            <div className={`rounded-xl border bg-gradient-to-br p-6 text-center ${scoreBg(score)}`}>
              <div className="text-sm font-medium text-gray-400">Your Retention Score</div>
              <div className={`mt-2 text-5xl font-bold ${scoreColor(score)}`}>{score}<span className="text-2xl text-gray-500">/100</span></div>
              <div className="mx-auto mt-4 h-3 w-full max-w-xs overflow-hidden rounded-full bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${scoreBarColor(score)}`}
                  style={{ width: `${score}%` }}
                />
              </div>
              <div className="mt-3 text-xs text-gray-500">
                {score >= 70 ? 'Top tier — your retention is strong' : score >= 40 ? 'Average — room for improvement' : 'Below average — prioritize retention'}
              </div>
            </div>

            {/* Comparison table */}
            <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Metric</th>
                    <th className="px-4 py-3 text-center">Yours</th>
                    <th className="px-4 py-3 text-center">{GENRE_LABELS[genre]} Avg</th>
                    <th className="px-4 py-3 text-center">Top 10%</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-300">D1 Retention</td>
                    <td className={`px-4 py-3 text-center text-sm font-mono ${cellColor(d1, bench.d1, bench.top10_d1)}`}>{d1}%</td>
                    <td className="px-4 py-3 text-center text-sm font-mono text-gray-500">{bench.d1}%</td>
                    <td className="px-4 py-3 text-center text-sm font-mono text-indigo-400">{bench.top10_d1}%</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-300">D7 Retention</td>
                    <td className={`px-4 py-3 text-center text-sm font-mono ${cellColor(d7, bench.d7, bench.top10_d7)}`}>{d7}%</td>
                    <td className="px-4 py-3 text-center text-sm font-mono text-gray-500">{bench.d7}%</td>
                    <td className="px-4 py-3 text-center text-sm font-mono text-indigo-400">{bench.top10_d7}%</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-300">D30 Retention</td>
                    <td className={`px-4 py-3 text-center text-sm font-mono ${cellColor(d30, bench.d30, bench.top10_d30)}`}>{d30}%</td>
                    <td className="px-4 py-3 text-center text-sm font-mono text-gray-500">{bench.d30}%</td>
                    <td className="px-4 py-3 text-center text-sm font-mono text-indigo-400">{bench.top10_d30}%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Revenue impact (if data provided) */}
            {hasRevenue && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-600/5 p-5">
                <h3 className="text-sm font-semibold text-emerald-400">Revenue Impact</h3>
                <p className="mt-1 text-xs text-gray-400">If you improved D7 retention to top-10% level ({bench.top10_d7}%):</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-gray-500">Current monthly</div>
                    <div className="text-lg font-bold text-white">{formatUSD(currentMonthlyUSD)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Projected monthly</div>
                    <div className="text-lg font-bold text-emerald-400">{formatUSD(projectedMonthlyUSD)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Potential upside</div>
                    <div className="text-lg font-bold text-yellow-400">
                      +{formatUSD(uplift)} (+{currentMonthlyUSD > 0 ? Math.round((uplift / currentMonthlyUSD) * 100) : 0}%)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Diagnosis */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
              <h3 className="text-sm font-semibold text-white">Diagnosis</h3>
              <div className="mt-3 space-y-3">
                {diagnosis.map((tip, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-[10px] font-bold text-indigo-400">
                      {i + 1}
                    </div>
                    <p className="text-sm leading-relaxed text-gray-400">{tip}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Share + CTA */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href={`https://x.com/intent/tweet?text=${shareText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-5 py-3 text-sm font-semibold text-gray-300 transition hover:border-gray-500 hover:text-white"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Share your score
              </a>
              <Link
                href="/login"
                className="flex-1 rounded-lg bg-indigo-600 px-5 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
              >
                Track these metrics automatically &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-16 rounded-xl border border-indigo-500/20 bg-indigo-600/5 p-8 text-center">
          <h3 className="text-xl font-bold text-white">Stop guessing your retention numbers</h3>
          <p className="mt-2 text-sm text-gray-400">
            Connect your Roblox game to Devmaxx and get AI-powered retention analysis, competitor benchmarking, and weekly growth briefs. Free tier available.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
          >
            Connect your game free &rarr;
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative border-t border-gray-800 px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div>
              <div className="text-lg font-bold text-white">Devmaxx</div>
              <p className="mt-1 text-sm text-gray-600">Built for Roblox creators, by a creator.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <Link href="/leaderboard" className="transition hover:text-gray-300">Leaderboard</Link>
              <Link href="/pricing" className="transition hover:text-gray-300">Pricing</Link>
              <Link href="/devex-calculator" className="transition hover:text-gray-300">DevEx Calculator</Link>
              <Link href="/retention-calculator" className="font-medium text-indigo-400 transition hover:text-indigo-300">Retention Calculator</Link>
              <Link href="/privacy" className="transition hover:text-gray-300">Privacy</Link>
              <Link href="/terms" className="transition hover:text-gray-300">Terms</Link>
              <a href="https://x.com/devmaxxapp" target="_blank" rel="noopener noreferrer" className="transition hover:text-gray-300">@devmaxxapp</a>
              <a href="https://linkedin.com/company/devmax" target="_blank" rel="noopener noreferrer" className="transition hover:text-gray-300">LinkedIn</a>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-gray-700">Devmaxx &middot; devmaxx.app &middot; Maxx your DevEx</p>
        </div>
      </footer>
    </main>
  );
}
