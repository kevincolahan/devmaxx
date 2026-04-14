'use client';

interface AgentRun {
  id: string;
  agentName: string;
  action: string;
  robuxImpact: number | null;
  actualRobuxImpact: number | null;
  followUpCompleted: boolean;
  status: string;
  createdAt: string;
}

interface AgentRunFeedProps {
  runs: AgentRun[];
}

function formatAgentName(name: string): string {
  return name
    .replace(/Agent$/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}

function formatRobux(impact: number | null): string {
  if (impact === null || impact === 0) return '--';
  const prefix = impact > 0 ? '+' : '';
  return `${prefix}${impact.toLocaleString()} R$`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getRunIcon(status: string) {
  if (status === 'success') return { symbol: '\u2726', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  if (status === 'failed') return { symbol: '\u2717', color: 'text-red-400', bg: 'bg-red-500/10' };
  if (status === 'escalated') return { symbol: '!', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
  return { symbol: '\u25CC', color: 'text-gray-400', bg: 'bg-gray-500/10' };
}

function getActionLabel(status: string) {
  if (status === 'success') return 'QUEST COMPLETE';
  if (status === 'failed') return 'QUEST FAILED';
  if (status === 'escalated') return 'NEEDS REVIEW';
  return 'RUNNING';
}

export function AgentRunFeed({ runs }: AgentRunFeedProps) {
  const measuredRuns = runs.filter((r) => r.followUpCompleted && r.actualRobuxImpact !== null);
  const totalMeasured = measuredRuns.reduce((sum, r) => sum + (r.actualRobuxImpact ?? 0), 0);

  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 font-semibold text-white">Agent Quest Log</h3>
        <div className="flex h-32 items-center justify-center text-gray-500">
          No quests completed yet. Connect your Roblox account to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-white">Agent Quest Log</h3>
        {measuredRuns.length > 0 && (
          <div className="text-right">
            <span className="text-xs text-gray-500">Measured Impact</span>
            <span className={`ml-2 text-sm font-bold ${totalMeasured >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalMeasured >= 0 ? '+' : ''}{totalMeasured.toLocaleString()} R$
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {runs.map((run) => {
          const icon = getRunIcon(run.status);

          return (
            <div
              key={run.id}
              className="rounded-lg border border-gray-800 px-4 py-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${icon.bg} text-sm font-bold ${icon.color}`}>
                    {icon.symbol}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${icon.color}`}>
                        {getActionLabel(run.status)}
                      </span>
                      {run.status === 'success' && (
                        <span className="rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-bold text-indigo-400">
                          +50 XP
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-white">
                      {formatAgentName(run.agentName)}
                    </p>
                    <p className="text-xs text-gray-500">{run.action}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-medium ${
                      (run.robuxImpact ?? 0) > 0
                        ? 'text-emerald-400'
                        : (run.robuxImpact ?? 0) < 0
                          ? 'text-red-400'
                          : 'text-gray-500'
                    }`}
                  >
                    {formatRobux(run.robuxImpact)}
                    {(run.robuxImpact ?? 0) > 0 && !run.followUpCompleted && (
                      <span className="ml-1 text-xs text-gray-500">est.</span>
                    )}
                  </p>
                  {run.followUpCompleted && run.actualRobuxImpact !== null && (
                    <p className={`text-xs font-medium ${
                      run.actualRobuxImpact > 0 ? 'text-blue-400' : run.actualRobuxImpact < 0 ? 'text-red-400' : 'text-gray-500'
                    }`}>
                      {formatRobux(run.actualRobuxImpact)} measured
                    </p>
                  )}
                  <p className="text-xs text-gray-500">{timeAgo(run.createdAt)}</p>
                </div>
              </div>
              {run.status === 'failed' && (
                <p className="mt-2 text-xs text-red-400/70">
                  Quest failed &mdash; will retry on next scheduled run
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
