'use client';

import { useState } from 'react';

interface BriefData {
  revenue: {
    thisWeek: number;
    lastWeek: number;
    fourWeekAvg: number;
    changePercent: number;
  };
  playerHealth: {
    dauTrend: string;
    dauThisWeek: number;
    dauLastWeek: number;
    d7Retention: number;
    d7RetentionChange: number;
  };
  topThree: Array<{
    title: string;
    description: string;
    impact: 'positive' | 'negative' | 'neutral';
  }>;
  nextActions: Array<{
    action: string;
    estimatedImpact: string;
    effortLevel: string;
  }>;
  agentActivity: {
    totalRuns: number;
    totalRobuxImpact: number;
    topAgent: string;
    ticketsResolved: number;
    ticketsEscalated: number;
    contentGenerated: number;
  };
}

interface GrowthBriefPreviewProps {
  brief: BriefData | null;
  sentAt: string | null;
  creatorId?: string;
  gameId?: string;
}

function formatAgent(name: string): string {
  return name.replace(/Agent$/, '').replace(/([A-Z])/g, ' $1').trim();
}

export function GrowthBriefPreview({ brief, sentAt, creatorId, gameId }: GrowthBriefPreviewProps) {
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const [appliedIdxs, setAppliedIdxs] = useState<Set<number>>(new Set());

  async function handleApplyAction(idx: number, action: BriefData['nextActions'][0]) {
    if (!creatorId) return;
    setApplyingIdx(idx);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'apply-brief-action',
          creatorId,
          gameId,
          actionText: action.action,
          estimatedImpact: action.estimatedImpact,
          effortLevel: action.effortLevel,
        }),
      });
      if (res.ok) {
        setAppliedIdxs((prev) => new Set(prev).add(idx));
      } else {
        const data = await res.json();
        alert(`Failed: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${String(err)}`);
    } finally {
      setApplyingIdx(null);
    }
  }

  if (!brief) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 font-semibold text-white">Growth Brief</h3>
        <div className="flex h-32 items-center justify-center text-gray-500">
          No growth brief sent yet. Briefs are generated weekly on Sunday evenings.
        </div>
      </div>
    );
  }

  const changeColor = brief.revenue.changePercent >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="space-y-4">
      {sentAt && (
        <p className="text-sm text-gray-400">
          Last sent: {new Date(sentAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      <div className="rounded-xl border border-indigo-500/20 bg-gray-900 p-6">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Revenue</h4>
        <p className="mt-2 text-3xl font-bold">{brief.revenue.thisWeek.toLocaleString()} R$</p>
        <p className={`mt-1 text-sm ${changeColor}`}>
          {brief.revenue.changePercent >= 0 ? '+' : ''}{brief.revenue.changePercent.toFixed(1)}% vs last week ({brief.revenue.lastWeek.toLocaleString()} R$)
        </p>
        <p className="mt-1 text-xs text-gray-500">4-week avg: {brief.revenue.fourWeekAvg.toLocaleString()} R$</p>
      </div>

      <div className="rounded-xl border border-purple-500/20 bg-gray-900 p-6">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400">Player Health</h4>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400">DAU</p>
            <p className="text-2xl font-bold">{brief.playerHealth.dauThisWeek.toLocaleString()}</p>
            <p className={`text-sm ${brief.playerHealth.dauThisWeek >= brief.playerHealth.dauLastWeek ? 'text-green-400' : 'text-red-400'}`}>
              {brief.playerHealth.dauTrend} from {brief.playerHealth.dauLastWeek.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">D7 Retention</p>
            <p className="text-2xl font-bold">{(brief.playerHealth.d7Retention * 100).toFixed(1)}%</p>
            <p className={`text-sm ${brief.playerHealth.d7RetentionChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {brief.playerHealth.d7RetentionChange >= 0 ? '+' : ''}{(brief.playerHealth.d7RetentionChange * 100).toFixed(1)}pp
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-yellow-500/20 bg-gray-900 p-6">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-yellow-400">Top 3 This Week</h4>
        <div className="mt-3 space-y-3">
          {brief.topThree.map((item, i) => (
            <div key={i} className={`border-l-2 pl-3 ${item.impact === 'positive' ? 'border-green-400' : item.impact === 'negative' ? 'border-red-400' : 'border-gray-600'}`}>
              <p className="font-medium text-white">{i + 1}. {item.title}</p>
              <p className="text-sm text-gray-400">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-emerald-500/20 bg-gray-900 p-6">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Next 3 Actions</h4>
        <div className="mt-3 space-y-3">
          {brief.nextActions.map((item, i) => (
            <div key={i}>
              <p className="font-medium text-white">{i + 1}. {item.action}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-300">Impact: {item.estimatedImpact}</span>
                <span className="rounded bg-indigo-900/50 px-2 py-0.5 text-xs text-indigo-300">Effort: {item.effortLevel}</span>
                {creatorId && !appliedIdxs.has(i) && (
                  <button
                    onClick={() => handleApplyAction(i, item)}
                    disabled={applyingIdx === i}
                    className="rounded-md bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                  >
                    {applyingIdx === i ? 'Applying...' : 'Apply'}
                  </button>
                )}
                {appliedIdxs.has(i) && (
                  <span className="text-xs text-green-400">Applied</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-pink-500/20 bg-gray-900 p-6">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-pink-400">Agent Activity</h4>
        <div className="mt-3 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{brief.agentActivity.totalRuns}</p>
            <p className="text-xs text-gray-400">Runs</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-400">+{brief.agentActivity.totalRobuxImpact.toLocaleString()}</p>
            <p className="text-xs text-gray-400">R$ Impact</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{brief.agentActivity.ticketsResolved}</p>
            <p className="text-xs text-gray-400">Tickets</p>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-gray-500">Top agent: {formatAgent(brief.agentActivity.topAgent)}</p>
      </div>
    </div>
  );
}
