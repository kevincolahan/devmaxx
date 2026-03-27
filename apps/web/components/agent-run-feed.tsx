'use client';

interface AgentRun {
  id: string;
  agentName: string;
  action: string;
  robuxImpact: number | null;
  status: string;
  createdAt: string;
}

interface AgentRunFeedProps {
  runs: AgentRun[];
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'success':
      return 'bg-green-400/10 text-green-400';
    case 'failed':
      return 'bg-red-400/10 text-red-400';
    case 'escalated':
      return 'bg-yellow-400/10 text-yellow-400';
    default:
      return 'bg-gray-400/10 text-gray-400';
  }
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

export function AgentRunFeed({ runs }: AgentRunFeedProps) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 font-semibold text-white">Recent Agent Runs</h3>
        <div className="flex h-32 items-center justify-center text-gray-500">
          No agent runs yet. Connect your Roblox account to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h3 className="mb-4 font-semibold text-white">Recent Agent Runs</h3>
      <div className="space-y-3">
        {runs.map((run) => (
          <div
            key={run.id}
            className="flex items-center justify-between rounded-lg border border-gray-800 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadge(run.status)}`}
              >
                {run.status}
              </span>
              <div>
                <p className="text-sm font-medium text-white">
                  {formatAgentName(run.agentName)}
                </p>
                <p className="text-xs text-gray-400">{run.action}</p>
              </div>
            </div>
            <div className="text-right">
              <p
                className={`text-sm font-medium ${
                  (run.robuxImpact ?? 0) > 0
                    ? 'text-green-400'
                    : (run.robuxImpact ?? 0) < 0
                      ? 'text-red-400'
                      : 'text-gray-500'
                }`}
              >
                {formatRobux(run.robuxImpact)}
              </p>
              <p className="text-xs text-gray-500">{timeAgo(run.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
