'use client';

interface SentimentItem {
  issue: string;
  count: number;
  urgency: number;
  trend: string;
}

interface SentimentData {
  overallScore: number;
  weekOverWeekChange: string;
  claudeSummary: string | null;
  topBugs: SentimentItem[];
  topRequests: SentimentItem[];
  topPraise: SentimentItem[];
  topFrustrations: SentimentItem[];
  ticketsAnalyzed: number;
  analyzedAt: string;
}

interface SentimentAnalysisProps {
  sentiment: SentimentData | null;
}

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-green-400';
  if (score >= 6) return 'text-yellow-400';
  if (score >= 4) return 'text-orange-400';
  return 'text-red-400';
}

function getTrendArrow(change: string): { arrow: string; color: string } {
  switch (change) {
    case 'positive': return { arrow: '\u25B2', color: 'text-green-400' };
    case 'negative': return { arrow: '\u25BC', color: 'text-red-400' };
    default: return { arrow: '\u2192', color: 'text-gray-400' };
  }
}

function getUrgencyColor(urgency: number): string {
  if (urgency >= 8) return 'text-red-400';
  if (urgency >= 5) return 'text-yellow-400';
  return 'text-gray-400';
}

function getTrendBadge(trend: string): { label: string; color: string } {
  switch (trend) {
    case 'rising': return { label: 'Rising', color: 'bg-red-500/10 text-red-400' };
    case 'declining': return { label: 'Declining', color: 'bg-green-500/10 text-green-400' };
    default: return { label: 'Stable', color: 'bg-gray-500/10 text-gray-400' };
  }
}

function SentimentSection({
  title,
  items,
  color,
}: {
  title: string;
  items: SentimentItem[];
  color: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-800 p-4">
      <h4 className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{title}</h4>
      <div className="mt-3 space-y-2">
        {items.slice(0, 3).map((item, i) => {
          const trend = getTrendBadge(item.trend);
          return (
            <div key={i} className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-300">{item.issue}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500">{item.count} mentions</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${trend.color}`}>{trend.label}</span>
                </div>
              </div>
              <span className={`text-sm font-bold ${getUrgencyColor(item.urgency)}`}>
                {item.urgency}/10
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SentimentAnalysis({ sentiment }: SentimentAnalysisProps) {
  if (!sentiment) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-2 font-semibold text-white">Player Sentiment</h3>
        <div className="flex h-24 items-center justify-center text-gray-500 text-sm">
          No sentiment analysis yet. Runs weekly on Tuesdays.
        </div>
      </div>
    );
  }

  const trend = getTrendArrow(sentiment.weekOverWeekChange);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Player Sentiment</h3>
        <span className="text-xs text-gray-500">
          {sentiment.ticketsAnalyzed} tickets analyzed &middot; {new Date(sentiment.analyzedAt).toLocaleDateString()}
        </span>
      </div>

      {/* Score */}
      <div className="flex items-center gap-4 mb-4">
        <div className="text-center">
          <p className={`text-4xl font-bold ${getScoreColor(sentiment.overallScore)}`}>
            {sentiment.overallScore}
          </p>
          <p className="text-xs text-gray-500">/10</p>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <span className={`text-lg ${trend.color}`}>{trend.arrow}</span>
            <span className="text-sm text-gray-400">
              {sentiment.weekOverWeekChange === 'positive' ? 'Improving' :
               sentiment.weekOverWeekChange === 'negative' ? 'Declining' : 'Stable'} vs last week
            </span>
          </div>
          {sentiment.claudeSummary && (
            <p className="mt-1 text-sm text-gray-400">{sentiment.claudeSummary}</p>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="grid gap-3 md:grid-cols-2">
        <SentimentSection title="Top Bugs" items={sentiment.topBugs} color="text-red-400" />
        <SentimentSection title="Feature Requests" items={sentiment.topRequests} color="text-purple-400" />
        <SentimentSection title="Players Love" items={sentiment.topPraise} color="text-green-400" />
        <SentimentSection title="Frustrations" items={sentiment.topFrustrations} color="text-orange-400" />
      </div>
    </div>
  );
}
