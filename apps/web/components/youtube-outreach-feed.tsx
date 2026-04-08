'use client';

import { useEffect, useState } from 'react';

interface YouTubeLog {
  id: string;
  videoId: string;
  channelId: string;
  videoTitle: string;
  commentDrafted: string | null;
  commentPosted: boolean;
  qualityScore: number;
  postedAt: string | null;
  commentUrl: string | null;
  createdAt: string;
}

interface YouTubeStats {
  commentsThisWeek: number;
  totalScanned: number;
}

function getNextThursday(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilThu = day <= 4 ? 4 - day : 11 - day;
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + (daysUntilThu === 0 && now.getUTCHours() >= 14 ? 7 : daysUntilThu));
  next.setUTCHours(14, 0, 0, 0);
  return next.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function YouTubeOutreachFeed() {
  const [logs, setLogs] = useState<YouTubeLog[]>([]);
  const [stats, setStats] = useState<YouTubeStats>({ commentsThisWeek: 0, totalScanned: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/youtube-outreach')
      .then((res) => res.json())
      .then((data) => {
        setLogs(data.logs ?? []);
        setStats(data.stats ?? { commentsThisWeek: 0, totalScanned: 0 });
      })
      .catch((err) => console.error('Failed to load YouTube outreach data:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-500">
        Loading YouTube outreach data...
      </div>
    );
  }

  const postedLogs = logs.filter((l) => l.commentPosted);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Comments This Week</div>
          <div className="mt-1 text-2xl font-bold text-red-400">{stats.commentsThisWeek}</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Videos Scanned</div>
          <div className="mt-1 text-2xl font-bold">{stats.totalScanned}</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Next Scheduled</div>
          <div className="mt-1 text-lg font-bold text-brand-400">{getNextThursday()}</div>
          <div className="text-xs text-gray-500">2pm UTC</div>
        </div>
      </div>

      {/* Comments list */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h4 className="mb-4 font-semibold text-white">Recent Comments</h4>

        {postedLogs.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-gray-500">
            No YouTube comments posted yet. The agent runs every Thursday at 2pm UTC.
          </div>
        ) : (
          <div className="space-y-3">
            {postedLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-gray-800 p-4">
                <div className="flex items-start justify-between">
                  <a
                    href={`https://www.youtube.com/watch?v=${log.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-white hover:text-red-400"
                  >
                    {log.videoTitle}
                  </a>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                      YouTube
                    </span>
                    {log.qualityScore > 0 && (
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                        {log.qualityScore}/10
                      </span>
                    )}
                  </div>
                </div>

                {log.commentDrafted && (
                  <div className="mt-3 rounded-md border border-gray-700 bg-gray-800/50 p-3">
                    <div className="mb-1 text-xs font-medium text-gray-500">
                      {log.commentPosted ? 'Comment posted' : 'Draft'}
                    </div>
                    <p className="text-sm text-gray-300">{log.commentDrafted}</p>
                    {log.commentUrl && (
                      <a
                        href={log.commentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-red-400 hover:underline"
                      >
                        View on YouTube
                      </a>
                    )}
                  </div>
                )}

                <div className="mt-2 text-xs text-gray-600">
                  {log.postedAt && new Date(log.postedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
