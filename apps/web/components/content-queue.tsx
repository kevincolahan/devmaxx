'use client';

import { useState } from 'react';

interface ContentItem {
  id: string;
  type: string;
  platform: string | null;
  content: string;
  qualityScore: number | null;
  status: string;
  createdAt: string;
}

interface ContentQueueProps {
  items: ContentItem[];
}

function getPlatformIcon(platform: string | null): string {
  const icons: Record<string, string> = {
    x: 'X',
    linkedin: 'in',
    instagram: 'IG',
    youtube: 'YT',
    blog: 'Blog',
  };
  return platform ? icons[platform] ?? platform : '--';
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    social_post: 'Social Post',
    event_idea: 'Event Idea',
    item_desc: 'Item Description',
    game_pass: 'Game Pass',
    email: 'Email',
    ad_creative: 'Ad Creative',
  };
  return labels[type] ?? type;
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-gray-500';
  if (score >= 9) return 'text-green-400';
  if (score >= 7) return 'text-yellow-400';
  return 'text-orange-400';
}

export function ContentQueue({ items }: ContentQueueProps) {
  const [localItems, setLocalItems] = useState(items);

  async function handleAction(id: string, action: 'approved' | 'rejected') {
    try {
      await fetch('/api/content/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: action }),
      });
      setLocalItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: action } : item))
      );
    } catch (err) {
      console.error('Failed to update content status:', err);
    }
  }

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
      <h3 className="mb-4 font-semibold text-white">Content Queue</h3>
      <div className="space-y-4">
        {localItems.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-gray-800 p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {item.platform && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-800 text-xs font-bold text-gray-300">
                    {getPlatformIcon(item.platform)}
                  </span>
                )}
                <span className="text-sm font-medium text-gray-300">
                  {getTypeLabel(item.type)}
                </span>
                <span className={`text-sm font-bold ${getScoreColor(item.qualityScore)}`}>
                  {item.qualityScore !== null ? `${item.qualityScore}/10` : ''}
                </span>
              </div>
              <span className={`text-xs ${
                item.status === 'approved' ? 'text-green-400' :
                item.status === 'rejected' ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {item.status}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-gray-300">
              {item.content.length > 300 ? item.content.slice(0, 300) + '...' : item.content}
            </p>
            {item.status === 'draft' && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleAction(item.id, 'approved')}
                  className="rounded-md bg-green-600/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-600/30"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleAction(item.id, 'rejected')}
                  className="rounded-md bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-600/30"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
