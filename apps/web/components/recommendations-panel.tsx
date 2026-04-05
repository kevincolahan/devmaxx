'use client';

import { useState } from 'react';

interface Recommendation {
  id: string;
  content: string;
  qualityScore: number | null;
  status: string;
  createdAt: string;
}

interface RecommendationsPanelProps {
  recommendations: Recommendation[];
  creatorId: string;
  gameId?: string;
}

interface ParsedRec {
  title: string;
  description: string;
  estimatedRobuxUplift: number;
  priority: string;
  category: string;
  itemId?: string;
  itemName?: string;
  currentPrice?: number;
  suggestedPrice?: number;
}

function parseContent(content: string): ParsedRec | null {
  try {
    return JSON.parse(content) as ParsedRec;
  } catch {
    return null;
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'high':
      return 'bg-red-400/10 text-red-400';
    case 'medium':
      return 'bg-yellow-400/10 text-yellow-400';
    case 'low':
      return 'bg-gray-400/10 text-gray-400';
    default:
      return 'bg-gray-400/10 text-gray-400';
  }
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    underpriced: 'Underpriced',
    dead_inventory: 'Dead Inventory',
    bundle: 'Bundle Opportunity',
    seasonal: 'Seasonal',
    description: 'Missing Description',
    concentration: 'Revenue Risk',
  };
  return labels[category] ?? category;
}

export function RecommendationsPanel({ recommendations, creatorId, gameId }: RecommendationsPanelProps) {
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  async function handleApply(rec: Recommendation, parsed: ParsedRec) {
    setApplyingId(rec.id);

    try {
      // If it's a price recommendation, apply the price change
      if (parsed.category === 'underpriced' && parsed.itemId && parsed.suggestedPrice) {
        const res = await fetch('/api/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: 'apply-price',
            creatorId,
            gameId,
            itemId: parsed.itemId,
            itemName: parsed.itemName ?? parsed.title,
            currentPrice: parsed.currentPrice ?? 0,
            newPrice: parsed.suggestedPrice,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(`Failed to apply: ${data.error}`);
          return;
        }
      } else {
        // Generic recommendation apply
        const res = await fetch('/api/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: 'apply-recommendation',
            creatorId,
            gameId,
            recommendationId: rec.id,
            actionType: parsed.category,
            actionData: {
              title: parsed.title,
              estimatedRobuxUplift: parsed.estimatedRobuxUplift,
            },
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(`Failed to apply: ${data.error}`);
          return;
        }
      }

      setAppliedIds((prev) => new Set(prev).add(rec.id));
    } catch (err) {
      alert(`Error: ${String(err)}`);
    } finally {
      setApplyingId(null);
    }
  }

  if (recommendations.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 font-semibold text-white">Monetization Recommendations</h3>
        <div className="flex h-32 items-center justify-center text-gray-500">
          No recommendations yet. The monetization advisor runs monthly.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h3 className="mb-4 font-semibold text-white">Monetization Recommendations</h3>
      <div className="space-y-4">
        {recommendations.map((rec) => {
          const parsed = parseContent(rec.content);
          if (!parsed) return null;
          const isApplied = appliedIds.has(rec.id) || rec.status === 'published';

          return (
            <div
              key={rec.id}
              className="rounded-lg border border-gray-800 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white">{parsed.title}</h4>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityBadge(parsed.priority)}`}>
                      {parsed.priority}
                    </span>
                    <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                      {getCategoryLabel(parsed.category)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-400">{parsed.description}</p>
                </div>
                <div className="ml-4 text-right">
                  <p className="text-lg font-bold text-green-400">
                    +{parsed.estimatedRobuxUplift.toLocaleString()} R$
                  </p>
                  <p className="text-xs text-gray-500">est. uplift</p>
                </div>
              </div>
              <div className="mt-3">
                {isApplied ? (
                  <span className="inline-flex items-center rounded-md bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400">
                    Applied
                  </span>
                ) : (
                  <button
                    onClick={() => handleApply(rec, parsed)}
                    disabled={applyingId === rec.id}
                    className="rounded-md bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                  >
                    {applyingId === rec.id ? 'Applying...' : 'Apply This Change'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
