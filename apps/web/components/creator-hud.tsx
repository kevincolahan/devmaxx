'use client';

import { getLevelForXP, LEVEL_THRESHOLDS } from '@/lib/levels';

interface CreatorHudProps {
  displayName: string | null;
  email: string;
  xp: number;
  level: number;
  levelTitle: string;
  plan: string;
  totalGames: number;
  totalRuns: number;
  totalRobuxImpact: number;
}

export function CreatorHud({
  displayName,
  email,
  xp,
  plan,
  totalGames,
  totalRuns,
  totalRobuxImpact,
}: CreatorHudProps) {
  const levelInfo = getLevelForXP(xp);
  const nextThreshold = LEVEL_THRESHOLDS.find((t) => t.level === levelInfo.level + 1);

  const name = displayName || email.split('@')[0];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      {/* Top row: name + level badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 text-lg font-bold text-indigo-400">
            {levelInfo.level}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{name}&apos;s Studio</h1>
            <p className="text-sm text-gray-400">
              Level {levelInfo.level} &mdash; {levelInfo.title}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-400">
          {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
        </span>
      </div>

      {/* XP progress bar */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-indigo-400">
            {xp.toLocaleString()} XP
          </span>
          {nextThreshold && (
            <span className="text-gray-500">
              {nextThreshold.xp.toLocaleString()} XP to Level {nextThreshold.level}
            </span>
          )}
          {!nextThreshold && (
            <span className="text-emerald-400">MAX LEVEL</span>
          )}
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-700 ease-out"
            style={{ width: `${levelInfo.progress}%` }}
          />
        </div>
      </div>

      {/* Stat chips */}
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-1.5 text-sm">
          <span className="text-gray-500">Games</span>
          <span className="font-semibold text-white">{totalGames}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-1.5 text-sm">
          <span className="text-gray-500">Agent Runs</span>
          <span className="font-semibold text-white">{totalRuns}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-1.5 text-sm">
          <span className="text-gray-500">Robux Impact</span>
          <span className={`font-semibold ${totalRobuxImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalRobuxImpact >= 0 ? '+' : ''}{totalRobuxImpact.toLocaleString()} R$
          </span>
        </div>
      </div>
    </div>
  );
}
