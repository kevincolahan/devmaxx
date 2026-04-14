'use client';

interface Snapshot {
  dau: number;
  retentionD1: number;
  retentionD7: number;
  robuxEarned: number;
}

interface HealthScoreCardProps {
  gameName: string;
  score: number;
  robloxGameId: string;
  latestSnapshot?: Snapshot | null;
  prevSnapshot?: Snapshot | null;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-400';
  if (score >= 60) return 'bg-yellow-400';
  if (score >= 40) return 'bg-orange-400';
  return 'bg-red-400';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'border-emerald-500/30 bg-emerald-500/5';
  if (score >= 60) return 'border-yellow-500/30 bg-yellow-500/5';
  if (score >= 40) return 'border-orange-500/30 bg-orange-500/5';
  return 'border-red-500/30 bg-red-500/5';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'EXCELLENT';
  if (score >= 60) return 'GOOD';
  if (score >= 40) return 'FAIR';
  return 'NEEDS ATTENTION';
}

function pctChange(current: number, prev: number): { label: string; positive: boolean } | null {
  if (!prev || prev === 0) return null;
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct === 0) return null;
  return { label: `${pct > 0 ? '+' : ''}${pct}%`, positive: pct > 0 };
}

function statBar(value: number, max: number): number {
  return Math.min(100, Math.max(5, (value / max) * 100));
}

export function HealthScoreCard({
  gameName,
  score,
  robloxGameId,
  latestSnapshot,
  prevSnapshot,
}: HealthScoreCardProps) {
  const dauChange = latestSnapshot && prevSnapshot ? pctChange(latestSnapshot.dau, prevSnapshot.dau) : null;
  const retChange = latestSnapshot && prevSnapshot ? pctChange(latestSnapshot.retentionD7, prevSnapshot.retentionD7) : null;
  const revChange = latestSnapshot && prevSnapshot ? pctChange(latestSnapshot.robuxEarned, prevSnapshot.robuxEarned) : null;

  return (
    <div className={`rounded-xl border p-6 ${getScoreBg(score)}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">{gameName}</h3>
          <p className="text-xs text-gray-500">ID: {robloxGameId}</p>
        </div>
        <div className="text-right">
          <div className={`text-xs font-bold uppercase tracking-wider ${getScoreColor(score)}`}>
            {getScoreLabel(score)}
          </div>
        </div>
      </div>

      {/* Health bar */}
      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs font-medium text-gray-400">GAME HEALTH</span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score}/100</span>
      </div>

      {/* Stat rows */}
      {latestSnapshot && (
        <div className="mt-4 space-y-2.5">
          <div className="flex items-center gap-3">
            <span className="w-20 text-xs text-gray-500">DAU</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${statBar(latestSnapshot.dau, 10000)}%` }} />
            </div>
            <span className="w-16 text-right text-xs font-medium text-white">
              {latestSnapshot.dau.toLocaleString()}
            </span>
            {dauChange && (
              <span className={`w-10 text-right text-xs font-medium ${dauChange.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {dauChange.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-20 text-xs text-gray-500">Retention</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${statBar(latestSnapshot.retentionD7 * 100, 100)}%` }} />
            </div>
            <span className="w-16 text-right text-xs font-medium text-white">
              {Math.round(latestSnapshot.retentionD7 * 100)}%
            </span>
            {retChange && (
              <span className={`w-10 text-right text-xs font-medium ${retChange.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {retChange.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-20 text-xs text-gray-500">Revenue</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${statBar(latestSnapshot.robuxEarned, 50000)}%` }} />
            </div>
            <span className="w-16 text-right text-xs font-medium text-white">
              {latestSnapshot.robuxEarned.toLocaleString()}R$
            </span>
            {revChange && (
              <span className={`w-10 text-right text-xs font-medium ${revChange.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {revChange.label}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
