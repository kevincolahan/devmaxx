'use client';

import { useState } from 'react';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────

interface OverviewData {
  totalCreators: number;
  creatorsByPlan: Array<{ plan: string; count: number }>;
  totalGames: number;
  agentRunsToday: number;
  totalAgentRuns: number;
  totalRobuxImpact: number;
  failedRunsToday: number;
}

interface UserData {
  id: string;
  email: string;
  plan: string;
  billingPeriod: string;
  autopilot: boolean;
  xp: number;
  level: number;
  levelTitle: string;
  robloxUsername: string | null;
  games: Array<{ id: string; name: string }>;
  agentRunCount: number;
  createdAt: string;
}

interface AgentHealthData {
  name: string;
  lastRun: string | null;
  totalRuns: number;
  successCount: number;
  failedCount: number;
  successRate: number;
}

interface ProspectData {
  id: string;
  robloxGameId: string;
  gameName: string;
  creatorUsername: string;
  concurrentPlayers: number;
  visitCount: number;
  prospectScore: number;
  outreachStatus: string;
  outreachMessage: string | null;
  signedUp: boolean;
  twitterHandle: string | null;
  socialScore: number | null;
  enrichedAt: string | null;
  scannedAt: string;
}

interface RecentRun {
  id: string;
  agentName: string;
  action: string;
  robuxImpact: number | null;
  status: string;
  creatorEmail: string;
  createdAt: string;
}

interface AdminData {
  overview: OverviewData;
  users: UserData[];
  agentHealth: AgentHealthData[];
  prospects: ProspectData[];
  recentRuns: RecentRun[];
}

type AdminTab = 'overview' | 'users' | 'agents' | 'prospects' | 'runs';

// ─── Helpers ────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function planColor(plan: string): string {
  const map: Record<string, string> = {
    free: 'bg-gray-700/50 text-gray-400',
    creator: 'bg-indigo-500/15 text-indigo-400',
    pro: 'bg-emerald-500/15 text-emerald-400',
    studio: 'bg-yellow-500/15 text-yellow-400',
  };
  return map[plan] ?? map.free;
}

function statusDot(rate: number): string {
  if (rate >= 95) return 'bg-emerald-400';
  if (rate >= 80) return 'bg-yellow-400';
  return 'bg-red-400';
}

// ─── Component ──────────────────────────────────────────────

export function AdminClient({ data }: { data: AdminData }) {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [prospectFilter, setProspectFilter] = useState<string>('all');
  const [bulkAction, setBulkAction] = useState<string>('');
  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const { overview, users, agentHealth, prospects, recentRuns } = data;

  const paidUsers = users.filter((u) => u.plan !== 'free').length;
  const mrr = users.reduce((sum, u) => {
    const prices: Record<string, number> = { free: 0, creator: 49, pro: 99, studio: 249 };
    return sum + (prices[u.plan] ?? 0);
  }, 0);

  const tabs: { key: AdminTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'users', label: `Users (${users.length})` },
    { key: 'agents', label: `Agents (${agentHealth.length})` },
    { key: 'prospects', label: `Prospects (${prospects.length})` },
    { key: 'runs', label: 'Recent Runs' },
  ];

  const filteredProspects = prospects.filter((p) => {
    if (prospectFilter === 'high') return p.prospectScore >= 7;
    if (prospectFilter === 'enriched') return p.enrichedAt !== null;
    if (prospectFilter === 'contacted') return p.outreachStatus === 'contacted';
    if (prospectFilter === 'signed') return p.signedUp;
    return true;
  });

  function toggleProspect(id: string) {
    setSelectedProspects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllProspects() {
    if (selectedProspects.size === filteredProspects.length) {
      setSelectedProspects(new Set());
    } else {
      setSelectedProspects(new Set(filteredProspects.map((p) => p.id)));
    }
  }

  async function executeBulkAction() {
    if (!bulkAction || selectedProspects.size === 0) return;
    setBulkLoading(true);
    try {
      for (const id of selectedProspects) {
        await fetch('/api/prospects', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, outreachStatus: bulkAction }),
        });
      }
      window.location.reload();
    } catch {
      setBulkLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080810]">
      {/* Header */}
      <header className="border-b border-[rgba(79,70,229,0.15)] bg-[#0A0A16]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-300">&larr; Dashboard</Link>
            <span className="text-gray-700">|</span>
            <h1 className="text-lg font-bold text-white">Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-400">ADMIN</span>
            <span className="text-xs text-gray-500">kevin@devmaxx.app</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-[rgba(79,70,229,0.1)] bg-[#0A0A16]">
        <div className="mx-auto flex max-w-7xl gap-1 px-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
                tab === t.key
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6">

        {/* ═══════════════ OVERVIEW ═══════════════ */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Top stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] p-5">
                <div className="text-xs font-medium text-gray-500">MRR</div>
                <div className="mt-1 text-3xl font-bold text-emerald-400">${mrr.toLocaleString()}</div>
                <div className="mt-1 text-xs text-gray-600">{paidUsers} paid users</div>
              </div>
              <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] p-5">
                <div className="text-xs font-medium text-gray-500">Total Users</div>
                <div className="mt-1 text-3xl font-bold text-indigo-400">{overview.totalCreators}</div>
                <div className="mt-1 text-xs text-gray-600">{overview.totalGames} games connected</div>
              </div>
              <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] p-5">
                <div className="text-xs font-medium text-gray-500">Agent Runs Today</div>
                <div className="mt-1 text-3xl font-bold text-yellow-400">{overview.agentRunsToday}</div>
                <div className="mt-1 text-xs text-gray-600">{overview.totalAgentRuns.toLocaleString()} all time</div>
              </div>
              <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] p-5">
                <div className="text-xs font-medium text-gray-500">Failed Today</div>
                <div className={`mt-1 text-3xl font-bold ${overview.failedRunsToday > 0 ? 'text-red-400' : 'text-gray-600'}`}>
                  {overview.failedRunsToday}
                </div>
                <div className="mt-1 text-xs text-gray-600">{formatNumber(overview.totalRobuxImpact)} R$ total impact</div>
              </div>
            </div>

            {/* Plan breakdown */}
            <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] p-5">
              <h3 className="text-sm font-semibold text-white">Users by Plan</h3>
              <div className="mt-3 flex flex-wrap gap-3">
                {overview.creatorsByPlan.map((p) => (
                  <div key={p.plan} className="flex items-center gap-2 rounded-lg bg-[#141428] px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${planColor(p.plan)}`}>
                      {p.plan}
                    </span>
                    <span className="text-sm font-bold text-white">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent runs */}
            <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] p-5">
              <h3 className="mb-3 text-sm font-semibold text-white">Recent Agent Runs</h3>
              <div className="space-y-2">
                {recentRuns.slice(0, 15).map((run) => (
                  <div key={run.id} className="flex items-center justify-between rounded-lg bg-[#141428] px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${run.status === 'success' ? 'bg-emerald-400' : run.status === 'failed' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                      <span className="font-medium text-white">{run.agentName}</span>
                      <span className="text-gray-500">{run.action}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {run.robuxImpact !== null && run.robuxImpact > 0 && (
                        <span className="text-yellow-400">+{run.robuxImpact} R$</span>
                      )}
                      <span className="text-gray-600">{run.creatorEmail.split('@')[0]}</span>
                      <span className="text-gray-600">{timeAgo(run.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ USERS ═══════════════ */}
        {tab === 'users' && (
          <div className="overflow-hidden rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(79,70,229,0.1)] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Games</th>
                  <th className="px-4 py-3 text-right">Runs</th>
                  <th className="px-4 py-3 text-right">XP</th>
                  <th className="px-4 py-3 text-right">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-[rgba(79,70,229,0.05)] transition hover:bg-[rgba(79,70,229,0.05)]">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-white">{user.robloxUsername ?? user.email.split('@')[0]}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${planColor(user.plan)}`}>
                        {user.plan}
                      </span>
                      {user.autopilot && (
                        <span className="ml-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">AP</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-white">Lv {user.level}</div>
                      <div className="text-[10px] text-gray-500">{user.levelTitle}</div>
                    </td>
                    <td className="px-4 py-3">
                      {user.games.length > 0 ? (
                        <div className="space-y-0.5">
                          {user.games.map((g) => (
                            <div key={g.id} className="text-xs text-gray-300">{g.name}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono text-gray-300">{user.agentRunCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono text-indigo-400">{user.xp.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══════════════ AGENTS ═══════════════ */}
        {tab === 'agents' && (
          <div className="overflow-hidden rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(79,70,229,0.1)] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total Runs</th>
                  <th className="px-4 py-3 text-right">Success</th>
                  <th className="px-4 py-3 text-right">Failed</th>
                  <th className="px-4 py-3 text-right">Success Rate</th>
                  <th className="px-4 py-3 text-right">Last Run</th>
                </tr>
              </thead>
              <tbody>
                {agentHealth.map((agent) => (
                  <tr key={agent.name} className="border-b border-[rgba(79,70,229,0.05)] transition hover:bg-[rgba(79,70,229,0.05)]">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-white">{agent.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${statusDot(agent.successRate)}`} />
                        <span className="text-xs text-gray-400">
                          {agent.successRate >= 95 ? 'Healthy' : agent.successRate >= 80 ? 'Degraded' : 'Failing'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono text-gray-300">{agent.totalRuns}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono text-emerald-400">{agent.successCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-mono ${agent.failedCount > 0 ? 'text-red-400' : 'text-gray-600'}`}>
                        {agent.failedCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-bold ${agent.successRate >= 95 ? 'text-emerald-400' : agent.successRate >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {agent.successRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">
                      {agent.lastRun ? timeAgo(agent.lastRun) : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══════════════ PROSPECTS ═══════════════ */}
        {tab === 'prospects' && (
          <div className="space-y-4">
            {/* Filters + bulk actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {(['all', 'high', 'enriched', 'contacted', 'signed'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setProspectFilter(f)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      prospectFilter === f ? 'bg-indigo-600/20 text-indigo-400' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'high' ? 'Score 7+' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              {selectedProspects.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{selectedProspects.size} selected</span>
                  <select
                    value={bulkAction}
                    onChange={(e) => setBulkAction(e.target.value)}
                    className="rounded-lg border border-gray-700 bg-[#141428] px-2 py-1 text-xs text-gray-300"
                  >
                    <option value="">Bulk action...</option>
                    <option value="queued">Mark Queued</option>
                    <option value="contacted">Mark Contacted</option>
                    <option value="replied">Mark Replied</option>
                  </select>
                  <button
                    onClick={executeBulkAction}
                    disabled={!bulkAction || bulkLoading}
                    className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {bulkLoading ? 'Applying...' : 'Apply'}
                  </button>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(79,70,229,0.1)] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedProspects.size === filteredProspects.length && filteredProspects.length > 0}
                        onChange={toggleAllProspects}
                        className="rounded border-gray-600"
                      />
                    </th>
                    <th className="px-3 py-3">Game</th>
                    <th className="px-3 py-3">Creator</th>
                    <th className="px-3 py-3 text-right">Score</th>
                    <th className="px-3 py-3 text-right">Players</th>
                    <th className="px-3 py-3">Social</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Scanned</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProspects.map((p) => (
                    <tr key={p.id} className="border-b border-[rgba(79,70,229,0.05)] transition hover:bg-[rgba(79,70,229,0.05)]">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedProspects.has(p.id)}
                          onChange={() => toggleProspect(p.id)}
                          className="rounded border-gray-600"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-white">{p.gameName}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-sm text-gray-300">{p.creatorUsername}</div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          p.prospectScore >= 8 ? 'bg-emerald-500/10 text-emerald-400' :
                          p.prospectScore >= 6 ? 'bg-indigo-500/10 text-indigo-400' :
                          'bg-gray-500/10 text-gray-400'
                        }`}>
                          {p.prospectScore}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm text-gray-300">
                        {formatNumber(p.concurrentPlayers)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {p.twitterHandle && (
                            <a href={`https://x.com/${p.twitterHandle}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-white" title={`@${p.twitterHandle}`}>
                              X
                            </a>
                          )}
                          {p.socialScore !== null && p.socialScore > 0 && (
                            <span className="text-[10px] text-indigo-400">{p.socialScore}/10</span>
                          )}
                          {p.enrichedAt && (
                            <span className="text-[10px] text-emerald-500">E</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          p.signedUp ? 'bg-emerald-500/10 text-emerald-400' :
                          p.outreachStatus === 'contacted' ? 'bg-blue-500/10 text-blue-400' :
                          p.outreachStatus === 'queued' ? 'bg-yellow-500/10 text-yellow-400' :
                          'bg-gray-500/10 text-gray-400'
                        }`}>
                          {p.signedUp ? 'Signed Up' : p.outreachStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-600">
                        {timeAgo(p.scannedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════ RECENT RUNS ═══════════════ */}
        {tab === 'runs' && (
          <div className="overflow-hidden rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(79,70,229,0.1)] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Creator</th>
                  <th className="px-4 py-3 text-right">Impact</th>
                  <th className="px-4 py-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id} className="border-b border-[rgba(79,70,229,0.05)] transition hover:bg-[rgba(79,70,229,0.05)]">
                    <td className="px-4 py-3">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                        run.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                        run.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                        'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        {run.status === 'success' ? '\u2713' : run.status === 'failed' ? '\u2717' : '!'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-white">{run.agentName}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{run.action}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{run.creatorEmail}</td>
                    <td className="px-4 py-3 text-right">
                      {run.robuxImpact !== null && run.robuxImpact > 0 ? (
                        <span className="font-mono text-sm text-yellow-400">+{run.robuxImpact} R$</span>
                      ) : (
                        <span className="text-xs text-gray-600">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">{timeAgo(run.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </main>
    </div>
  );
}
