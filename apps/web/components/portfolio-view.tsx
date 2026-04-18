'use client';

import Link from 'next/link';

/* ──────────────────────────────────────────────
   TYPES
   ────────────────────────────────────────────── */

interface Snapshot {
  date: string;
  dau: number;
  robuxEarned: number;
  retentionD7: number;
  concurrentPeak: number;
}

interface GameData {
  id: string;
  name: string;
  robloxGameId: string;
  healthScore: number;
  snapshots: Snapshot[];
  agentRunCount: number;
}

interface PortfolioViewProps {
  games: GameData[];
  plan: string;
  totalRobuxImpact: number;
}

/* ──────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────── */

const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  creator: 2,
  pro: 5,
  studio: 999,
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function healthColor(score: number): string {
  if (score >= 70) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (score >= 40) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
  return 'text-red-400 bg-red-500/10 border-red-500/30';
}

function healthDot(score: number): string {
  if (score >= 70) return 'bg-emerald-400';
  if (score >= 40) return 'bg-yellow-400';
  return 'bg-red-400';
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="h-8 w-20" />;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 32;
  const step = width / (data.length - 1);

  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ──────────────────────────────────────────────
   COMPONENT
   ────────────────────────────────────────────── */

export function PortfolioView({ games, plan, totalRobuxImpact }: PortfolioViewProps) {
  const gameLimit = PLAN_LIMITS[plan] ?? 1;

  // ─── Single game / empty: show upgrade prompt ────────────
  if (games.length < 2) {
    return (
      <div className="space-y-6">
        {/* Teaser */}
        <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/20 text-3xl">
            &#128202;
          </div>
          <h2 className="mt-4 text-xl font-bold text-white">Unlock Portfolio View</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
            Connect your second game to compare performance, share insights across games, and get cross-game AI recommendations.
          </p>
          {plan === 'free' ? (
            <Link
              href="/pricing"
              className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Upgrade to Creator &rarr;
            </Link>
          ) : (
            <Link
              href="/api/roblox/connect"
              className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Connect another game &rarr;
            </Link>
          )}
        </div>

        {/* Ghost preview */}
        <div className="grid gap-4 md:grid-cols-2">
          {games[0] && (
            <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">{games[0].name}</h3>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${healthColor(games[0].healthScore)}`}>
                  {games[0].healthScore}/100
                </span>
              </div>
              <div className="mt-3 text-sm text-gray-400">
                DAU: {games[0].snapshots[0]?.dau.toLocaleString() ?? '--'}
              </div>
            </div>
          )}
          <div className="rounded-xl border border-dashed border-gray-700/50 bg-[#0F0F1E]/50 p-5 opacity-40">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-600">Your Second Game</h3>
              <span className="rounded-full border border-gray-700 bg-gray-800/50 px-2 py-0.5 text-xs font-bold text-gray-600">
                --/100
              </span>
            </div>
            <div className="mt-3 text-sm text-gray-700">DAU: --</div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Multi-game portfolio ────────────────────────────────
  const totalDau = games.reduce((sum, g) => sum + (g.snapshots[0]?.dau ?? 0), 0);
  const totalRevenue = games.reduce((sum, g) => sum + (g.snapshots[0]?.robuxEarned ?? 0), 0);
  const totalAgentRuns = games.reduce((sum, g) => sum + g.agentRunCount, 0);
  const weightedHealth = games.reduce((sum, g) => {
    const dau = g.snapshots[0]?.dau ?? 1;
    return sum + g.healthScore * dau;
  }, 0) / (totalDau || 1);

  return (
    <div className="space-y-6">
      {/* Portfolio summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] p-4">
          <div className="text-xs font-medium text-gray-500">Total DAU</div>
          <div className="mt-1 text-3xl font-bold text-emerald-400">{formatNumber(totalDau)}</div>
          <div className="mt-0.5 text-xs text-gray-600">across {games.length} games</div>
        </div>
        <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] p-4">
          <div className="text-xs font-medium text-gray-500">Daily Revenue</div>
          <div className="mt-1 text-3xl font-bold text-yellow-400">{formatNumber(totalRevenue)} R$</div>
          <div className="mt-0.5 text-xs text-gray-600">~{formatNumber(totalRevenue * 30 * 0.0035)} USD/mo</div>
        </div>
        <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] p-4">
          <div className="text-xs font-medium text-gray-500">Portfolio Health</div>
          <div className={`mt-1 text-3xl font-bold ${weightedHealth >= 70 ? 'text-emerald-400' : weightedHealth >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
            {Math.round(weightedHealth)}/100
          </div>
          <div className="mt-0.5 text-xs text-gray-600">weighted by DAU</div>
        </div>
        <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] p-4">
          <div className="text-xs font-medium text-gray-500">Agent Runs</div>
          <div className="mt-1 text-3xl font-bold text-indigo-400">{totalAgentRuns}</div>
          <div className="mt-0.5 text-xs text-gray-600">+{formatNumber(totalRobuxImpact)} R$ impact</div>
        </div>
      </div>

      {/* Game cards grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {games.map((game) => {
          const dauData = game.snapshots.map((s) => s.dau).reverse();
          const latestDau = game.snapshots[0]?.dau ?? 0;
          const prevDau = game.snapshots[1]?.dau ?? latestDau;
          const dauChange = latestDau - prevDau;
          const latestRevenue = game.snapshots[0]?.robuxEarned ?? 0;

          return (
            <div key={game.id} className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] p-5 transition hover:border-[rgba(79,70,229,0.3)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${healthDot(game.healthScore)}`} />
                    <h3 className="font-semibold text-white">{game.name}</h3>
                  </div>
                  <div className="mt-0.5 text-xs text-gray-600">ID: {game.robloxGameId}</div>
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${healthColor(game.healthScore)}`}>
                  {game.healthScore}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] text-gray-500">DAU</div>
                  <div className="text-sm font-bold text-white">{formatNumber(latestDau)}</div>
                  <div className={`text-[10px] ${dauChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {dauChange >= 0 ? '\u2191' : '\u2193'} {Math.abs(dauChange).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">Revenue/day</div>
                  <div className="text-sm font-bold text-white">{formatNumber(latestRevenue)} R$</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">Agent Runs</div>
                  <div className="text-sm font-bold text-indigo-400">{game.agentRunCount}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <MiniSparkline
                  data={dauData}
                  color={dauChange >= 0 ? '#4ade80' : '#f87171'}
                />
                <button className="text-xs font-medium text-indigo-400 transition hover:text-indigo-300">
                  View details &rarr;
                </button>
              </div>
            </div>
          );
        })}

        {/* Add another game card */}
        {games.length < gameLimit && (
          <Link
            href="/api/roblox/connect"
            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700/50 bg-[#0F0F1E]/50 p-8 text-center transition hover:border-indigo-500/30"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-800 text-lg text-gray-500">+</div>
            <div className="mt-2 text-sm font-medium text-gray-400">Add Another Game</div>
            <div className="mt-1 text-[10px] text-gray-600">
              {games.length}/{gameLimit === 999 ? '\u221E' : gameLimit} games used
            </div>
          </Link>
        )}
      </div>

      {/* Comparison table (desktop only) */}
      {games.length >= 2 && (
        <div className="hidden overflow-hidden rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(79,70,229,0.1)] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Metric</th>
                {games.map((g) => (
                  <th key={g.id} className="px-4 py-3 text-right">{g.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[rgba(79,70,229,0.05)]">
                <td className="px-4 py-3 text-sm text-gray-400">Health Score</td>
                {games.map((g) => (
                  <td key={g.id} className={`px-4 py-3 text-right text-sm font-bold ${g.healthScore >= 70 ? 'text-emerald-400' : g.healthScore >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {g.healthScore}/100
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[rgba(79,70,229,0.05)]">
                <td className="px-4 py-3 text-sm text-gray-400">DAU</td>
                {games.map((g) => (
                  <td key={g.id} className="px-4 py-3 text-right font-mono text-sm text-white">
                    {(g.snapshots[0]?.dau ?? 0).toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[rgba(79,70,229,0.05)]">
                <td className="px-4 py-3 text-sm text-gray-400">D7 Retention</td>
                {games.map((g) => (
                  <td key={g.id} className="px-4 py-3 text-right font-mono text-sm text-white">
                    {g.snapshots[0] ? `${(g.snapshots[0].retentionD7 * 100).toFixed(1)}%` : '--'}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[rgba(79,70,229,0.05)]">
                <td className="px-4 py-3 text-sm text-gray-400">Revenue/day</td>
                {games.map((g) => (
                  <td key={g.id} className="px-4 py-3 text-right font-mono text-sm text-yellow-400">
                    {formatNumber(g.snapshots[0]?.robuxEarned ?? 0)} R$
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[rgba(79,70,229,0.05)]">
                <td className="px-4 py-3 text-sm text-gray-400">Concurrent Peak</td>
                {games.map((g) => (
                  <td key={g.id} className="px-4 py-3 text-right font-mono text-sm text-white">
                    {(g.snapshots[0]?.concurrentPeak ?? 0).toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-gray-400">Agent Runs</td>
                {games.map((g) => (
                  <td key={g.id} className="px-4 py-3 text-right font-mono text-sm text-indigo-400">
                    {g.agentRunCount}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Cross-game insights */}
      {games.length >= 2 && (
        <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] p-5">
          <h3 className="text-sm font-semibold text-white">Cross-Game Insights</h3>
          <div className="mt-3 space-y-2">
            {(() => {
              const insights: string[] = [];
              const sorted = [...games].sort((a, b) => (b.snapshots[0]?.retentionD7 ?? 0) - (a.snapshots[0]?.retentionD7 ?? 0));
              const best = sorted[0];
              const worst = sorted[sorted.length - 1];

              if (best && worst && best.id !== worst.id) {
                const bestD7 = ((best.snapshots[0]?.retentionD7 ?? 0) * 100).toFixed(0);
                const worstD7 = ((worst.snapshots[0]?.retentionD7 ?? 0) * 100).toFixed(0);
                const diff = (parseFloat(bestD7) - parseFloat(worstD7)).toFixed(0);
                if (parseFloat(diff) > 0) {
                  insights.push(`${worst.name}'s D7 retention (${worstD7}%) is ${diff}pp lower than ${best.name} (${bestD7}%). Consider applying ${best.name}'s engagement hooks to ${worst.name}.`);
                }
              }

              const totalThisWeek = games.reduce((s, g) => s + (g.snapshots[0]?.robuxEarned ?? 0), 0);
              const totalLastWeek = games.reduce((s, g) => s + (g.snapshots[1]?.robuxEarned ?? 0), 0);
              if (totalLastWeek > 0) {
                const change = ((totalThisWeek - totalLastWeek) / totalLastWeek * 100).toFixed(0);
                insights.push(`Combined daily revenue ${parseInt(change) >= 0 ? 'up' : 'down'} ${Math.abs(parseInt(change))}% across your portfolio.`);
              }

              const maxRuns = Math.max(...games.map((g) => g.agentRunCount));
              const minRuns = Math.min(...games.map((g) => g.agentRunCount));
              if (maxRuns > 0 && minRuns > 0 && maxRuns / minRuns >= 2) {
                const maxGame = games.find((g) => g.agentRunCount === maxRuns);
                insights.push(`${maxGame?.name} has ${(maxRuns / minRuns).toFixed(0)}x more agent activity than your other games.`);
              }

              if (insights.length === 0) {
                insights.push('All games performing consistently. Keep monitoring for divergences.');
              }

              return insights.map((insight, i) => (
                <div key={i} className="flex gap-2 text-sm text-gray-400">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-[9px] font-bold text-indigo-400">
                    {i + 1}
                  </span>
                  {insight}
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Studio export button */}
      {plan === 'studio' && games.length >= 2 && (
        <div className="flex justify-end">
          <button className="rounded-lg border border-gray-700 px-4 py-2 text-xs font-medium text-gray-400 transition hover:border-gray-500 hover:text-white">
            Export Portfolio Report (PDF)
          </button>
        </div>
      )}
    </div>
  );
}
