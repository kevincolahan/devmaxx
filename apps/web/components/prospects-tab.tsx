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
  twitterHandle: string | null;
  twitterFollowers: number | null;
  youtubeChannel: string | null;
  youtubeSubscribers: number | null;
  twitchHandle: string | null;
  redditUsername: string | null;
  devforumUsername: string | null;
  devforumTrustLevel: number | null;
  enrichedAt: string | null;
  socialScore: number | null;
}

type Filter = 'all' | 'high_score' | 'contacted' | 'signed_up' | 'enriched';

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-emerald-400 bg-emerald-500/10';
  if (score >= 6) return 'text-indigo-400 bg-indigo-500/10';
  if (score >= 4) return 'text-yellow-400 bg-yellow-500/10';
  return 'text-gray-400 bg-gray-500/10';
}

function getSocialScoreColor(score: number): string {
  if (score >= 7) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (score >= 4) return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
  if (score >= 1) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
  return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
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

function formatFollowers(count: number | null): string {
  if (count === null) return '';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  high_score: 'High Score',
  contacted: 'Contacted',
  signed_up: 'Signed Up',
  enriched: 'Enriched',
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
    if (filter === 'enriched') return p.enrichedAt !== null;
    return true;
  });

  const stats = {
    total: prospects.length,
    queued: prospects.filter((p) => p.outreachStatus === 'queued').length,
    contacted: prospects.filter((p) => ['contacted', 'replied'].includes(p.outreachStatus)).length,
    signedUp: prospects.filter((p) => p.signedUp).length,
    enriched: prospects.filter((p) => p.enrichedAt !== null).length,
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
      <div className="grid gap-4 sm:grid-cols-5">
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
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
          <div className="text-2xl font-bold text-indigo-400">{stats.enriched}</div>
          <div className="text-xs text-gray-500">Enriched</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'high_score', 'contacted', 'signed_up', 'enriched'] as const).map((f) => (
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
                    {prospect.socialScore !== null && prospect.socialScore > 0 && (
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getSocialScoreColor(prospect.socialScore)}`}>
                        Social {prospect.socialScore}/10
                      </span>
                    )}
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

                  {/* Social icons row */}
                  {prospect.enrichedAt && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {prospect.twitterHandle && (
                        <a
                          href={`https://x.com/${prospect.twitterHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-300 transition hover:bg-gray-700 hover:text-white"
                          title={`@${prospect.twitterHandle}${prospect.twitterFollowers ? ` (${formatFollowers(prospect.twitterFollowers)} followers)` : ''}`}
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                          @{prospect.twitterHandle}
                          {prospect.twitterFollowers !== null && (
                            <span className="text-gray-500">{formatFollowers(prospect.twitterFollowers)}</span>
                          )}
                        </a>
                      )}
                      {prospect.youtubeChannel && (
                        <a
                          href={`https://youtube.com/channel/${prospect.youtubeChannel}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-gray-800 px-2 py-1 text-xs text-red-400 transition hover:bg-gray-700 hover:text-red-300"
                          title={`YouTube${prospect.youtubeSubscribers ? ` (${formatFollowers(prospect.youtubeSubscribers)} subs)` : ''}`}
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                          </svg>
                          YouTube
                          {prospect.youtubeSubscribers !== null && (
                            <span className="text-gray-500">{formatFollowers(prospect.youtubeSubscribers)}</span>
                          )}
                        </a>
                      )}
                      {prospect.twitchHandle && (
                        <a
                          href={`https://twitch.tv/${prospect.twitchHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-gray-800 px-2 py-1 text-xs text-purple-400 transition hover:bg-gray-700 hover:text-purple-300"
                          title={`Twitch: ${prospect.twitchHandle}`}
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                          </svg>
                          {prospect.twitchHandle}
                        </a>
                      )}
                      {prospect.redditUsername && (
                        <a
                          href={`https://reddit.com/user/${prospect.redditUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-gray-800 px-2 py-1 text-xs text-orange-400 transition hover:bg-gray-700 hover:text-orange-300"
                          title={`Reddit: u/${prospect.redditUsername}`}
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
                          </svg>
                          u/{prospect.redditUsername}
                        </a>
                      )}
                      {prospect.devforumUsername && (
                        <a
                          href={`https://devforum.roblox.com/u/${prospect.devforumUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-gray-800 px-2 py-1 text-xs text-blue-400 transition hover:bg-gray-700 hover:text-blue-300"
                          title={`DevForum: ${prospect.devforumUsername} (TL${prospect.devforumTrustLevel ?? '?'})`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                          </svg>
                          DevForum TL{prospect.devforumTrustLevel ?? '?'}
                        </a>
                      )}
                      {!prospect.twitterHandle && !prospect.youtubeChannel && !prospect.twitchHandle && !prospect.redditUsername && !prospect.devforumUsername && (
                        <span className="text-xs text-gray-600">No social profiles found</span>
                      )}
                    </div>
                  )}
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
                    <div>{new Date(prospect.scannedAt).toLocaleDateString()}</div>
                    {prospect.enrichedAt && (
                      <div className="text-indigo-500">Enriched {new Date(prospect.enrichedAt).toLocaleDateString()}</div>
                    )}
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
