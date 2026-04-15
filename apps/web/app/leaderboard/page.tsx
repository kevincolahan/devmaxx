'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';

/* ──────────────────────────────────────────────
   TYPES
   ────────────────────────────────────────────── */

interface LeaderboardGame {
  rank: number;
  universeId: string;
  name: string;
  creatorName: string;
  playing: number;
  visits: number;
  thumbnailUrl: string;
  genre: string;
  estimatedMonthlyDevEx: number;
  weekOverWeekChange: number;
}

type SortTab = 'players' | 'devex' | 'rising';

/* ──────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────── */

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function trendIcon(change: number): { icon: string; color: string } {
  if (change > 0.02) return { icon: '\u2191', color: 'text-emerald-400' };
  if (change < -0.02) return { icon: '\u2193', color: 'text-red-400' };
  return { icon: '\u2192', color: 'text-gray-500' };
}

function rankBadge(rank: number): { bg: string; glow: string; text: string } {
  if (rank === 1) return { bg: 'bg-yellow-500/20', glow: 'shadow-yellow-500/30', text: 'text-yellow-400' };
  if (rank === 2) return { bg: 'bg-gray-300/10', glow: 'shadow-gray-300/20', text: 'text-gray-300' };
  if (rank === 3) return { bg: 'bg-amber-600/15', glow: 'shadow-amber-600/20', text: 'text-amber-500' };
  return { bg: 'bg-gray-800', glow: '', text: 'text-gray-400' };
}

function genreBadgeColor(genre: string): string {
  const map: Record<string, string> = {
    Adventure: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    RPG: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    Simulator: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Tycoon: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    Horror: 'bg-red-500/15 text-red-400 border-red-500/30',
    FPS: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    Racing: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    Roleplay: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    Obby: 'bg-lime-500/15 text-lime-400 border-lime-500/30',
    Fighting: 'bg-red-600/15 text-red-300 border-red-600/30',
  };
  return map[genre] ?? 'bg-gray-700/30 text-gray-400 border-gray-600/30';
}

function shareUrl(game: LeaderboardGame): string {
  const text = encodeURIComponent(
    `My game ${game.name} is ranked #${game.rank} on the Devmaxx Roblox leaderboard \uD83C\uDFAE devmaxx.app/leaderboard`
  );
  return `https://x.com/intent/tweet?text=${text}`;
}

/* ──────────────────────────────────────────────
   HOOKS
   ────────────────────────────────────────────── */

function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === 0) return;
    const from = prevTarget.current;
    prevTarget.current = target;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(from + (target - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [target, duration]);

  return count;
}

/* ──────────────────────────────────────────────
   COMPONENT
   ────────────────────────────────────────────── */

export default function LeaderboardPage() {
  const [games, setGames] = useState<LeaderboardGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<SortTab>('players');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const totalPlayers = useCountUp(
    games.reduce((sum, g) => sum + g.playing, 0)
  );
  const totalDevEx = useCountUp(
    Math.round(games.reduce((sum, g) => sum + g.estimatedMonthlyDevEx, 0))
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setGames(data.games ?? []);
      setUpdatedAt(data.updatedAt ?? null);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sort games based on active tab
  const sortedGames = [...games].sort((a, b) => {
    if (tab === 'devex') return b.estimatedMonthlyDevEx - a.estimatedMonthlyDevEx;
    if (tab === 'rising') return b.visits - a.visits; // visits as proxy for growth until WoW data
    return b.playing - a.playing;
  }).map((g, i) => ({ ...g, rank: i + 1 }));

  const tabs: { key: SortTab; label: string; emoji: string }[] = [
    { key: 'players', label: 'Top by Players', emoji: '\uD83C\uDFC6' },
    { key: 'devex', label: 'Top by Est. DevEx', emoji: '\uD83D\uDCB0' },
    { key: 'rising', label: 'Rising', emoji: '\uD83D\uDE80' },
  ];

  return (
    <>
      {/* SEO meta is handled by metadata export below via generateMetadata — for client component we set title manually */}
      <main className="relative min-h-screen overflow-hidden bg-gray-950">
        {/* ── Animated grid background ── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.04]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'linear-gradient(rgba(79,70,229,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(79,70,229,0.3) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        {/* ── Top Nav ── */}
        <nav className="relative z-10 border-b border-gray-800/50 bg-gray-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-xl font-bold text-white">
              Devmaxx
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/leaderboard" className="text-sm font-medium text-indigo-400">
                Leaderboard
              </Link>
              <Link href="/devex-calculator" className="text-sm text-gray-400 transition hover:text-white">
                DevEx Calculator
              </Link>
              <Link href="/pricing" className="text-sm text-gray-400 transition hover:text-white">
                Pricing
              </Link>
              <Link
                href="/login"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Sign in
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Header ── */}
        <section className="relative mx-auto max-w-7xl px-4 pb-8 pt-12 text-center sm:pt-16">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Top Roblox Games by Players &amp; Estimated DevEx
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-400">
            Live leaderboard of the top Roblox games ranked by concurrent players and estimated monthly DevEx earnings. Updated daily.
          </p>

          {/* ── Stats bar ── */}
          {games.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400">{formatNumber(totalPlayers)}</div>
                <div className="text-xs text-gray-500">Total Players Live</div>
              </div>
              <div className="h-8 w-px bg-gray-800" />
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{formatUSD(totalDevEx)}</div>
                <div className="text-xs text-gray-500">Est. Monthly DevEx</div>
              </div>
              <div className="h-8 w-px bg-gray-800" />
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-400">{games.length}</div>
                <div className="text-xs text-gray-500">Games Tracked</div>
              </div>
            </div>
          )}

          {updatedAt && (
            <p className="mt-4 text-xs text-gray-600">
              Last updated: {new Date(updatedAt).toLocaleString()}
            </p>
          )}
        </section>

        {/* ── Tabs ── */}
        <section className="relative mx-auto max-w-7xl px-4 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  tab === t.key
                    ? 'bg-indigo-600/20 text-indigo-400 ring-1 ring-indigo-500/40'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Table ── */}
        <section className="relative mx-auto max-w-7xl px-4 pb-20">
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
              <p className="text-sm text-gray-500">Loading leaderboard data from Roblox...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-8 text-center">
              <p className="text-red-400">Failed to load leaderboard. Please try again later.</p>
              <button onClick={fetchData} className="mt-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/30">
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50 md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3 text-center w-16">Rank</th>
                      <th className="px-4 py-3">Game</th>
                      <th className="px-4 py-3 text-right">Players</th>
                      <th className="px-4 py-3 text-right">Visits</th>
                      <th className="px-4 py-3 text-right">Est. DevEx/mo</th>
                      <th className="px-4 py-3 text-center">Genre</th>
                      <th className="px-4 py-3 text-center">Trend</th>
                      <th className="px-4 py-3 text-center w-20"></th>
                      <th className="px-4 py-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGames.map((game, idx) => {
                      const badge = rankBadge(game.rank);
                      const trend = trendIcon(game.weekOverWeekChange);
                      return (
                        <tr
                          key={game.universeId}
                          className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
                          style={{ animationDelay: `${idx * 30}ms` }}
                        >
                          {/* Rank */}
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${badge.bg} ${badge.text} ${badge.glow ? `shadow-lg ${badge.glow}` : ''}`}
                            >
                              {game.rank}
                            </span>
                          </td>

                          {/* Game info */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {game.thumbnailUrl ? (
                                <img
                                  src={game.thumbnailUrl}
                                  alt={game.name}
                                  className="h-10 w-10 rounded-lg object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 text-gray-600">
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
                                  </svg>
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-white">{game.name}</div>
                                <div className="text-xs text-gray-500">by {game.creatorName}</div>
                              </div>
                            </div>
                          </td>

                          {/* Concurrent players */}
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-sm font-semibold text-emerald-400">
                              {formatNumber(game.playing)}
                            </span>
                          </td>

                          {/* Visits */}
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-sm text-gray-400">
                              {formatNumber(game.visits)}
                            </span>
                          </td>

                          {/* Est. DevEx */}
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-sm font-semibold text-yellow-400">
                              {formatUSD(game.estimatedMonthlyDevEx)}
                            </span>
                          </td>

                          {/* Genre */}
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${genreBadgeColor(game.genre)}`}>
                              {game.genre}
                            </span>
                          </td>

                          {/* Trend */}
                          <td className="px-4 py-3 text-center">
                            <span className={`text-lg font-bold ${trend.color}`}>{trend.icon}</span>
                          </td>

                          {/* CTA */}
                          <td className="px-4 py-3 text-center">
                            <Link
                              href="/login"
                              className="inline-block whitespace-nowrap rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-semibold text-indigo-400 ring-1 ring-indigo-500/30 transition hover:bg-indigo-600/30 hover:text-indigo-300"
                            >
                              Track free &rarr;
                            </Link>
                          </td>

                          {/* Share */}
                          <td className="px-4 py-3 text-center">
                            <a
                              href={shareUrl(game)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-800 hover:text-white"
                              title="Share on X"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                              </svg>
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {sortedGames.map((game) => {
                  const badge = rankBadge(game.rank);
                  const trend = trendIcon(game.weekOverWeekChange);
                  return (
                    <div
                      key={game.universeId}
                      className="rounded-xl border border-gray-800 bg-gray-900/50 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${badge.bg} ${badge.text} ${badge.glow ? `shadow-lg ${badge.glow}` : ''}`}
                        >
                          {game.rank}
                        </span>
                        {game.thumbnailUrl ? (
                          <img
                            src={game.thumbnailUrl}
                            alt={game.name}
                            className="h-12 w-12 shrink-0 rounded-lg object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-gray-600">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
                            </svg>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-white truncate">{game.name}</div>
                          <div className="text-xs text-gray-500">by {game.creatorName}</div>
                        </div>
                        <span className={`text-lg font-bold ${trend.color}`}>{trend.icon}</span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-3">
                        <div>
                          <div className="text-xs text-gray-500">Players</div>
                          <div className="font-mono text-sm font-semibold text-emerald-400">{formatNumber(game.playing)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Visits</div>
                          <div className="font-mono text-sm text-gray-400">{formatNumber(game.visits)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Est. DevEx/mo</div>
                          <div className="font-mono text-sm font-semibold text-yellow-400">{formatUSD(game.estimatedMonthlyDevEx)}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${genreBadgeColor(game.genre)}`}>
                          {game.genre}
                        </span>
                        <div className="flex items-center gap-2">
                          <a
                            href={shareUrl(game)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-800 hover:text-white"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                          </a>
                          <Link
                            href="/login"
                            className="rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-semibold text-indigo-400 ring-1 ring-indigo-500/30 transition hover:bg-indigo-600/30"
                          >
                            Track free &rarr;
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CTA banner below table */}
              <div className="mt-8 rounded-xl border border-indigo-500/20 bg-indigo-600/5 p-6 text-center sm:p-8">
                <h3 className="text-lg font-bold text-white sm:text-xl">Is your game on this list?</h3>
                <p className="mt-2 text-sm text-gray-400">
                  Connect your Roblox game to Devmaxx and get AI-powered pricing optimization, competitor tracking, and weekly growth briefs.
                </p>
                <Link
                  href="/login"
                  className="mt-4 inline-block rounded-lg bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
                >
                  Track your game free &rarr;
                </Link>
              </div>
            </>
          )}
        </section>

        {/* ── Footer ── */}
        <footer className="relative border-t border-gray-800 px-4 py-12">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div>
                <div className="text-lg font-bold text-white">Devmaxx</div>
                <p className="mt-1 text-sm text-gray-600">Built for Roblox creators, by a creator.</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
                <Link href="/leaderboard" className="font-medium text-indigo-400 transition hover:text-indigo-300">Leaderboard</Link>
                <Link href="/pricing" className="transition hover:text-gray-300">Pricing</Link>
                <Link href="/devex-calculator" className="transition hover:text-gray-300">DevEx Calculator</Link>
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
    </>
  );
}
