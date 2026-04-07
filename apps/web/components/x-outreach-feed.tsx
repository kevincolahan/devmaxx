'use client';

import { useEffect, useState } from 'react';

interface OutreachLog {
  id: string;
  tweetId: string;
  authorId: string;
  authorUsername: string;
  tweetContent: string;
  category: string;
  replyDrafted: string | null;
  replyPosted: boolean;
  postedAt: string | null;
  tweetUrl: string | null;
  replyUrl: string | null;
  createdAt: string;
}

interface OutreachStats {
  repliedThisWeek: number;
  totalThisWeek: number;
  engagementRate: number;
}

const CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
  analytics_question: { label: 'Analytics Q', color: 'bg-blue-500/10 text-blue-400' },
  monetization_help: { label: 'Monetization', color: 'bg-green-500/10 text-green-400' },
  frustration: { label: 'Frustration', color: 'bg-amber-500/10 text-amber-400' },
  milestone: { label: 'Milestone', color: 'bg-purple-500/10 text-purple-400' },
  general_roblox: { label: 'General', color: 'bg-gray-500/10 text-gray-400' },
  skip: { label: 'Skipped', color: 'bg-gray-500/10 text-gray-400' },
};

type FilterType = 'all' | 'replied' | 'pending';

export function XOutreachFeed() {
  const [logs, setLogs] = useState<OutreachLog[]>([]);
  const [stats, setStats] = useState<OutreachStats>({ repliedThisWeek: 0, totalThisWeek: 0, engagementRate: 0 });
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/outreach')
      .then((res) => res.json())
      .then((data) => {
        setLogs(data.logs ?? []);
        setStats(data.stats ?? { repliedThisWeek: 0, totalThisWeek: 0, engagementRate: 0 });
      })
      .catch((err) => console.error('Failed to load outreach data:', err))
      .finally(() => setLoading(false));
  }, []);

  const filteredLogs = logs.filter((l) => {
    if (filter === 'all') return true;
    if (filter === 'replied') return l.replyPosted;
    if (filter === 'pending') return !l.replyPosted && l.replyDrafted;
    return true;
  });

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-500">
        Loading outreach data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Replies This Week</div>
          <div className="mt-1 text-2xl font-bold text-blue-400">{stats.repliedThisWeek}</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Tweets Scanned</div>
          <div className="mt-1 text-2xl font-bold">{stats.totalThisWeek}</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Reply Rate</div>
          <div className="mt-1 text-2xl font-bold text-green-400">{stats.engagementRate}%</div>
        </div>
      </div>

      {/* Feed */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-white">Outreach Replies</h3>
          <div className="flex gap-1">
            {(['all', 'replied', 'pending'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  filter === f
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-gray-500">
            {logs.length === 0
              ? 'No outreach activity yet. The agent scans every 4 hours.'
              : `No ${filter} outreach items.`}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => {
              const categoryStyle = CATEGORY_STYLES[log.category] ?? CATEGORY_STYLES.skip;

              return (
                <div key={log.id} className="rounded-lg border border-gray-800 p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://x.com/${log.authorUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-white hover:text-blue-400"
                      >
                        @{log.authorUsername}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryStyle.color}`}>
                        {categoryStyle.label}
                      </span>
                      {log.replyPosted && (
                        <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                          Replied
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Original tweet */}
                  <p className="mt-2 text-sm text-gray-300">{log.tweetContent}</p>

                  {/* Our reply */}
                  {log.replyDrafted && (
                    <div className="mt-3 rounded-md border border-gray-700 bg-gray-800/50 p-3">
                      <div className="mb-1 text-xs font-medium text-gray-500">
                        {log.replyPosted ? 'Reply posted' : 'Draft reply'}
                      </div>
                      <p className="text-sm text-gray-300">{log.replyDrafted}</p>
                      {log.replyUrl && (
                        <a
                          href={log.replyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs text-blue-400 hover:underline"
                        >
                          View reply on X
                        </a>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-2 flex items-center gap-3">
                    {log.tweetUrl && (
                      <a
                        href={log.tweetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-gray-300"
                      >
                        View original tweet
                      </a>
                    )}
                    <span className="text-xs text-gray-600">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
