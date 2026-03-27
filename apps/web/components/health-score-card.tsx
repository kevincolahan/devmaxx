'use client';

interface HealthScoreCardProps {
  gameName: string;
  score: number;
  robloxGameId: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-400/10 border-green-400/30';
  if (score >= 60) return 'bg-yellow-400/10 border-yellow-400/30';
  if (score >= 40) return 'bg-orange-400/10 border-orange-400/30';
  return 'bg-red-400/10 border-red-400/30';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Attention';
}

export function HealthScoreCard({ gameName, score, robloxGameId }: HealthScoreCardProps) {
  return (
    <div className={`rounded-xl border p-6 ${getScoreBg(score)}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-white">{gameName}</h3>
          <p className="mt-1 text-xs text-gray-400">ID: {robloxGameId}</p>
        </div>
        <div className="text-right">
          <p className={`text-4xl font-bold ${getScoreColor(score)}`}>{score}</p>
          <p className={`text-sm ${getScoreColor(score)}`}>{getScoreLabel(score)}</p>
        </div>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-800">
        <div
          className={`h-full rounded-full transition-all ${
            score >= 80
              ? 'bg-green-400'
              : score >= 60
                ? 'bg-yellow-400'
                : score >= 40
                  ? 'bg-orange-400'
                  : 'bg-red-400'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
