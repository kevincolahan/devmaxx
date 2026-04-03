'use client';

import { useState } from 'react';

interface ContentItem {
  id: string;
  type: string;
  platform: string | null;
  content: string;
  qualityScore: number | null;
  status: string;
  sourceData?: Record<string, unknown> | null;
  createdAt: string;
}

interface ContentQueueProps {
  items: ContentItem[];
}

const PLATFORM_CONFIG: Record<string, { label: string; badge: string; badgeColor: string; url?: string }> = {
  x: { label: 'X', badge: 'X', badgeColor: 'bg-gray-700 text-white' },
  linkedin: { label: 'LinkedIn', badge: 'in', badgeColor: 'bg-blue-700 text-white', url: 'https://www.linkedin.com/feed/' },
  instagram: { label: 'Instagram', badge: 'IG', badgeColor: 'bg-gradient-to-br from-purple-600 to-pink-500 text-white', url: 'https://www.instagram.com/' },
  tiktok: { label: 'TikTok', badge: 'TT', badgeColor: 'bg-black text-white border border-gray-600', url: 'https://www.tiktok.com/upload' },
  youtube: { label: 'YouTube', badge: 'YT', badgeColor: 'bg-red-600 text-white', url: 'https://studio.youtube.com/' },
  blog: { label: 'Blog', badge: 'Blog', badgeColor: 'bg-gray-600 text-gray-200' },
};

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    social_post: 'Social Post',
    event_idea: 'Event Idea',
    item_desc: 'Item Description',
    game_pass: 'Game Pass',
    email: 'Email',
    ad_creative: 'Ad Creative',
    news_response: 'News Response',
  };
  return labels[type] ?? type;
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-gray-500';
  if (score >= 9) return 'text-green-400';
  if (score >= 7) return 'text-yellow-400';
  return 'text-orange-400';
}

function getStatusStyle(status: string): string {
  switch (status) {
    case 'approved': return 'text-green-400 bg-green-400/10';
    case 'rejected': return 'text-red-400 bg-red-400/10';
    case 'published': return 'text-blue-400 bg-blue-400/10';
    case 'pending_review': return 'text-amber-400 bg-amber-400/10';
    default: return 'text-gray-400 bg-gray-400/10';
  }
}

type FilterStatus = 'all' | 'draft' | 'pending_review' | 'approved' | 'published' | 'rejected';

export function ContentQueue({ items }: ContentQueueProps) {
  const [localItems, setLocalItems] = useState(items);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');

  async function handleStatusUpdate(id: string, status: 'approved' | 'rejected' | 'published') {
    try {
      await fetch('/api/content/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      setLocalItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status } : item))
      );
    } catch (err) {
      console.error('Failed to update content status:', err);
    }
  }

  async function handleCopy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  async function handleCopyAndOpen(id: string, text: string, url: string) {
    await handleCopy(id, text);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handlePostToPlatform(id: string, platform: string) {
    const item = localItems.find((i) => i.id === id);
    if (!item) return;

    // X/Twitter posts go directly via Vercel (bypasses Railway network restrictions)
    if (platform === 'x') {
      setPostingId(id);
      try {
        const res = await fetch('/api/social/post-tweet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: item.content, contentPieceId: id }),
        });

        const data = await res.json();

        if (!res.ok) {
          alert(`Failed to post to X: ${data.error}`);
          return;
        }

        setLocalItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: 'published' } : i))
        );
      } catch (err) {
        console.error('Failed to post to X:', err);
        alert('Failed to post to X. Check console for details.');
      } finally {
        setPostingId(null);
      }
      return;
    }

    // Other platforms go through Railway API proxy
    const routes: Record<string, string> = {
      linkedin: '/api/content/post-to-linkedin',
      tiktok: '/api/content/post-to-tiktok',
      instagram: '/api/content/post-to-instagram',
    };

    const route = routes[platform];
    if (!route) return;

    setPostingId(id);
    try {
      const res = await fetch(route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentPieceId: id }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`Failed to post to ${platform}: ${data.error}`);
        return;
      }

      setLocalItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: 'published' } : i))
      );
    } catch (err) {
      console.error(`Failed to post to ${platform}:`, err);
      alert(`Failed to post to ${platform}. Check console for details.`);
    } finally {
      setPostingId(null);
    }
  }

  const filteredItems = filter === 'all'
    ? localItems
    : localItems.filter((item) => item.status === filter);

  const counts = {
    all: localItems.length,
    draft: localItems.filter((i) => i.status === 'draft').length,
    pending_review: localItems.filter((i) => i.status === 'pending_review').length,
    approved: localItems.filter((i) => i.status === 'approved').length,
    published: localItems.filter((i) => i.status === 'published').length,
    rejected: localItems.filter((i) => i.status === 'rejected').length,
  };

  if (localItems.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 font-semibold text-white">Content Queue</h3>
        <div className="flex h-32 items-center justify-center text-gray-500">
          No content pieces yet. The content agent generates weekly.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-white">Content Queue</h3>
        <div className="flex gap-1">
          {(['all', 'draft', 'pending_review', 'approved', 'published', 'rejected'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                filter === f
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f === 'pending_review' ? 'Review' : f.charAt(0).toUpperCase() + f.slice(1)}
              {counts[f] > 0 && (
                <span className="ml-1 text-gray-500">{counts[f]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredItems.map((item) => {
          const platformInfo = item.platform ? PLATFORM_CONFIG[item.platform] : null;
          const isXPost = item.platform === 'x';
          const charCount = item.content.length;
          const isOverLimit = isXPost && charCount > 280;
          const canPost = (item.status === 'approved' || item.status === 'draft' || item.status === 'pending_review');
          const canPostToX = isXPost && !isOverLimit && canPost;
          const canPostToLinkedIn = item.platform === 'linkedin' && canPost;
          const canPostToTikTok = item.platform === 'tiktok' && canPost;
          const canPostToInstagram = item.platform === 'instagram' && canPost;
          const hasExternalUrl = platformInfo?.url;
          const hasDirectPost = canPostToX || canPostToLinkedIn || canPostToTikTok || canPostToInstagram;

          return (
            <div
              key={item.id}
              className="rounded-lg border border-gray-800 p-4"
            >
              {/* Header row */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {platformInfo && (
                    <span className={`flex h-7 items-center justify-center rounded-md px-2 text-xs font-bold ${platformInfo.badgeColor}`}>
                      {platformInfo.badge}
                    </span>
                  )}
                  <span className="text-sm font-medium text-gray-300">
                    {getTypeLabel(item.type)}
                  </span>
                  <span className={`text-sm font-bold ${getScoreColor(item.qualityScore)}`}>
                    {item.qualityScore !== null ? `${item.qualityScore}/10` : ''}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusStyle(item.status)}`}>
                  {item.status}
                </span>
              </div>

              {/* News Response source info */}
              {item.type === 'news_response' && item.sourceData && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                    News Response
                  </span>
                  {item.sourceData.articleSource && (
                    <span className="text-xs text-gray-500">
                      via {String(item.sourceData.articleSource).replace('_', ' ')}
                    </span>
                  )}
                  {item.sourceData.relevanceScore && (
                    <span className="text-xs text-gray-500">
                      Relevance: {String(item.sourceData.relevanceScore)}/10
                    </span>
                  )}
                  {item.sourceData.opportunityScore && (
                    <span className="text-xs text-gray-500">
                      Opportunity: {String(item.sourceData.opportunityScore)}/10
                    </span>
                  )}
                  {item.sourceData.articleUrl && (
                    <a
                      href={String(item.sourceData.articleUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-400 hover:underline"
                    >
                      Source article
                    </a>
                  )}
                </div>
              )}

              {/* Full content */}
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-300">
                {item.content}
              </p>

              {/* Character count for X posts */}
              {isXPost && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOverLimit ? 'bg-red-500' : charCount > 250 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((charCount / 280) * 100, 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono ${isOverLimit ? 'text-red-400' : 'text-gray-500'}`}>
                    {charCount}/280
                  </span>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-3 flex flex-wrap gap-2">
                {/* Copy button — always visible */}
                <button
                  onClick={() => handleCopy(item.id, item.content)}
                  className="rounded-md bg-gray-700/50 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700"
                >
                  {copiedId === item.id ? 'Copied!' : 'Copy'}
                </button>

                {/* Draft / Pending Review actions: Approve / Reject */}
                {(item.status === 'draft' || item.status === 'pending_review') && (
                  <>
                    <button
                      onClick={() => handleStatusUpdate(item.id, 'approved')}
                      className="rounded-md bg-green-600/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-600/30"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(item.id, 'rejected')}
                      className="rounded-md bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-600/30"
                    >
                      Reject
                    </button>
                  </>
                )}

                {/* Direct post buttons per platform */}
                {canPostToX && (
                  <button
                    onClick={() => handlePostToPlatform(item.id, 'x')}
                    disabled={postingId === item.id}
                    className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50"
                  >
                    {postingId === item.id ? 'Posting...' : 'Post to X'}
                  </button>
                )}
                {canPostToLinkedIn && (
                  <button
                    onClick={() => handlePostToPlatform(item.id, 'linkedin')}
                    disabled={postingId === item.id}
                    className="rounded-md bg-blue-700/20 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-700/30 disabled:opacity-50"
                  >
                    {postingId === item.id ? 'Posting...' : 'Post to LinkedIn'}
                  </button>
                )}
                {canPostToTikTok && (
                  <button
                    onClick={() => handlePostToPlatform(item.id, 'tiktok')}
                    disabled={postingId === item.id}
                    className="rounded-md bg-gray-600/20 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-600/30 disabled:opacity-50"
                  >
                    {postingId === item.id ? 'Posting...' : 'Post to TikTok'}
                  </button>
                )}
                {canPostToInstagram && (
                  <button
                    onClick={() => handlePostToPlatform(item.id, 'instagram')}
                    disabled={postingId === item.id}
                    className="rounded-md bg-pink-600/20 px-3 py-1.5 text-xs font-medium text-pink-400 hover:bg-pink-600/30 disabled:opacity-50"
                  >
                    {postingId === item.id ? 'Posting...' : 'Post to Instagram'}
                  </button>
                )}

                {/* Copy & Open fallback — for platforms without direct post (YouTube, Blog) */}
                {hasExternalUrl && !hasDirectPost && item.status !== 'published' && item.status !== 'rejected' && (
                  <button
                    onClick={() => handleCopyAndOpen(item.id, item.content, platformInfo!.url!)}
                    className="rounded-md bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-600/30"
                  >
                    Copy & Open {platformInfo!.label}
                  </button>
                )}

                {/* Mark as Posted — for approved items (manual posting confirmation) */}
                {item.status === 'approved' && (
                  <button
                    onClick={() => handleStatusUpdate(item.id, 'published')}
                    className="rounded-md bg-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-brand-500/30"
                  >
                    Mark as Posted
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="flex h-24 items-center justify-center text-gray-500">
            No {filter} content pieces.
          </div>
        )}
      </div>
    </div>
  );
}
