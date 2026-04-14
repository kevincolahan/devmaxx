'use client';

import { useState, useEffect } from 'react';

interface Prospect {
  id: string;
  robloxGameId: string;
  gameName: string;
  creatorUsername: string;
  concurrentPlayers: number;
  visitCount: number;
  hasGamePasses: boolean;
  gamePassCount: number;
  gamePassPriceMin: number | null;
  gamePassPriceMax: number | null;
  socialLinks: Record<string, string> | null;
  prospectScore: number;
  outreachStatus: string;
  outreachMessage: string | null;
  signedUp: boolean;
  scannedAt: string;
}

type Filter = 'all' | 'high_score' | 'contacted' | 'signed_up';

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-emerald-400 bg-emerald-500/10';
  if (score >= 6) return 'text-indigo-400 bg-indigo-500/10';
  if (score >= 4) return 'text-yellow-400 bg-yellow-500/10';
  return 'text-gray-400 bg-gray-500/10';
}

function getStatusBadge(status: string, signedUp: boolean) {
  if (signedUp) return { label: 'Signed Up', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
  switch (status) {
    case 'contacted': return { label: 'Contacted', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    case 'queued': return { label: 'Queued', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' };
    case 'replied': return { label: 'Replied', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' };
    default: return { label: 'Pending', color: 'bg-gray-500/10 text-gray-400 border-gray-500/30' };
  }
}

function formatVisits(visits: number): string {
  if (visits >= 1_000_000_000) return `${(visits / 1_000_000_000).toFixed(1)}B`;
  if (visits >= 1_000_000) return `${(visits / 1_000_000).toFixed(1)}M`;
  if (visits >= 1_000) return `${(visits / 1_000).toFixed(1)}K`;
  return String(visits);
}

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  high_score: 'High Score',
  contacted: 'Contacted',
  signed_up: 'Signed Up',
};

export function ProspectsTab() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/prospects')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((data) => {
        setProspects(data.prospects ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  async function markContacted(id: string) {
    setMarkingId(id);
    try {
      const res = await fetch('/api/prospects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, outreachStatus: 'contacted' }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setProspects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, outreachStatus: 'contacted' } : p))
      );
    } catch (err) {
      setError(`Failed to update: ${err}`);
    } finally {
      setMarkingId(null);
    }
  }

  const filtered = prospects.filter((p) => {
    if (filter === 'high_score') return p.prospectScore >= 7;
    if (filter === 'contacted') return p.outreachStatus === 'contacted' || p.outreachStatus === 'replied';
    if (filter === 'signed_up') return p.signedUp;
    return true;
  });

  const stats = {
    total: prospects.length,
    queued: prospects.filter((p) => p.outreachStatus === 'queued').length,
    contacted: prospects.filter((p) => ['contacted', 'replied'].includes(p.outreachStatus)).length,
    signedUp: prospects.filter((p) => p.signedUp).length,
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex h-32 items-center justify-center text-gray-500">Loading prospects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-400">
        Failed to load prospects: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-xs text-gray-500">Total Prospects</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{stats.queued}</div>
          <div className="text-xs text-gray-500">Outreach Queued</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{stats.contacted}</div>
          <div className="text-xs text-gray-500">Contacted</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{stats.signedUp}</div>
          <div className="text-xs text-gray-500">Signed Up</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'high_score', 'contacted', 'signed_up'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === f ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Prospect cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center text-gray-500">
            No prospects in this filter.
          </div>
        )}
        {filtered.map((prospect) => {
          const status = getStatusBadge(prospect.outreachStatus, prospect.signedUp);
          const socials = prospect.socialLinks as Record<string, string> | null;

          return (
            <div key={prospect.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{prospect.gameName}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${getScoreColor(prospect.prospectScore)}`}>
                      {prospect.prospectScore}/10
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-400">
                    by <span className="text-gray-300">{prospect.creatorUsername}</span>
                    {socials?.twitter && (
                      <> &middot; <a href={`https://x.com/${socials.twitter}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">@{socials.twitter}</a></>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {prospect.outreachStatus !== 'contacted' && prospect.outreachStatus !== 'replied' && !prospect.signedUp && (
                    <button
                      onClick={() => markContacted(prospect.id)}
                      disabled={markingId === prospect.id}
                      className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition hover:bg-blue-500/20 disabled:opacity-50"
                    >
                      {markingId === prospect.id ? 'Updating...' : 'Mark Contacted'}
                    </button>
                  )}
                  <div className="text-right text-xs text-gray-500">
                    {new Date(prospect.scannedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Playing: </span>
                  <span className="font-medium text-white">{prospect.concurrentPlayers.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Visits: </span>
                  <span className="font-medium text-white">{formatVisits(prospect.visitCount)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Game Passes: </span>
                  <span className="font-medium text-white">
                    {prospect.hasGamePasses ? `${prospect.gamePassCount}` : 'None'}
                    {prospect.gamePassPriceMin !== null && ` (${prospect.gamePassPriceMin}-${prospect.gamePassPriceMax} R$)`}
                  </span>
                </div>
              </div>

              {/* Draft outreach message */}
              {prospect.outreachMessage && (
                <div className="mt-3 rounded-lg bg-gray-800/50 p-3 text-xs text-gray-400">
                  <span className="font-medium text-gray-300">Draft: </span>
                  {prospect.outreachMessage}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
