'use client';

interface Recommendation {
  id: string;
  content: string;
  qualityScore: number | null;
  status: string;
  createdAt: string;
}

interface RecommendationsPanelProps {
  recommendations: Recommendation[];
}

interface ParsedRec {
  title: string;
  description: string;
  estimatedRobuxUplift: number;
  priority: string;
  category: string;
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

export function RecommendationsPanel({ recommendations }: RecommendationsPanelProps) {
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
