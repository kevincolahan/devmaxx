'use client';

import { useState } from 'react';

interface MentionItem {
  id: string;
  mentionId: string;
  authorUsername: string;
  authorFollowers: number;
  content: string;
  category: string;
  replyDrafted: string | null;
  replyPosted: boolean;
  replyTweetId: string | null;
  processedAt: string;
}

interface MentionsFeedProps {
  mentions: MentionItem[];
}

const CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
  question: { label: 'Question', color: 'bg-blue-500/10 text-blue-400' },
  positive: { label: 'Positive', color: 'bg-green-500/10 text-green-400' },
  roblox_help: { label: 'Roblox Help', color: 'bg-purple-500/10 text-purple-400' },
  negative: { label: 'Negative', color: 'bg-red-500/10 text-red-400' },
  irrelevant: { label: 'Irrelevant', color: 'bg-gray-500/10 text-gray-400' },
  reply_needed: { label: 'Reply Needed', color: 'bg-amber-500/10 text-amber-400' },
};

type FilterCategory = 'all' | 'actionable' | 'negative' | 'replied';

export function MentionsFeed({ mentions }: MentionsFeedProps) {
  const [filter, setFilter] = useState<FilterCategory>('all');

  const filteredMentions = mentions.filter((m) => {
    if (filter === 'all') return true;
    if (filter === 'actionable') return ['question', 'reply_needed', 'roblox_help'].includes(m.category) && !m.replyPosted;
    if (filter === 'negative') return m.category === 'negative';
    if (filter === 'replied') return m.replyPosted;
    return true;
  });

  const stats = {
    total: mentions.length,
    replied: mentions.filter((m) => m.replyPosted).length,
    positive: mentions.filter((m) => m.category === 'positive').length,
    negative: mentions.filter((m) => m.category === 'negative').length,
  };

  const positivePercent = stats.total > 0
    ? Math.round((stats.positive / stats.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Mentions</div>
          <div className="mt-1 text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Replies Sent</div>
          <div className="mt-1 text-2xl font-bold text-blue-400">{stats.replied}</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Positive Sentiment</div>
          <div className="mt-1 text-2xl font-bold text-green-400">{positivePercent}%</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Flagged</div>
          <div className={`mt-1 text-2xl font-bold ${stats.negative > 0 ? 'text-red-400' : 'text-gray-500'}`}>
            {stats.negative}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-white">Mentions</h3>
          <div className="flex gap-1">
            {(['all', 'actionable', 'replied', 'negative'] as FilterCategory[]).map((f) => (
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

        {filteredMentions.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-gray-500">
            {mentions.length === 0
              ? 'No mentions yet. The agent checks every 2 hours.'
              : `No ${filter} mentions.`}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMentions.map((mention) => {
              const categoryStyle = CATEGORY_STYLES[mention.category] ?? CATEGORY_STYLES.irrelevant;

              return (
                <div key={mention.id} className="rounded-lg border border-gray-800 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://x.com/${mention.authorUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-white hover:text-brand-400"
                      >
                        @{mention.authorUsername}
                      </a>
                      <span className="text-xs text-gray-500">
                        {mention.authorFollowers.toLocaleString()} followers
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryStyle.color}`}>
                        {categoryStyle.label}
                      </span>
                      {mention.replyPosted && (
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                          Replied
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-gray-300">{mention.content}</p>

                  {mention.replyDrafted && (
                    <div className="mt-3 rounded-md border border-gray-700 bg-gray-800/50 p-3">
                      <div className="mb-1 text-xs font-medium text-gray-500">
                        {mention.replyPosted ? 'Reply posted' : 'Draft reply'}
                      </div>
                      <p className="text-sm text-gray-300">{mention.replyDrafted}</p>
                      {mention.replyTweetId && (
                        <a
                          href={`https://x.com/devmaxxapp/status/${mention.replyTweetId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs text-brand-400 hover:underline"
                        >
                          View on X
                        </a>
                      )}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-3">
                    <a
                      href={`https://x.com/i/web/status/${mention.mentionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-gray-300"
                    >
                      View tweet
                    </a>
                    <span className="text-xs text-gray-600">
                      {new Date(mention.processedAt).toLocaleDateString()}
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
