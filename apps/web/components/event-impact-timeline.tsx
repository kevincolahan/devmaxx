'use client';

interface EventImpactItem {
  id: string;
  eventType: string;
  eventName: string;
  startedAt: string;
  measuredAt: string | null;
  dauBefore: number;
  dauAfter: number;
  dauChangePercent: number;
  revenueBefore: number;
  revenueAfter: number;
  verdict: string;
  claudeSummary: string | null;
  measured: boolean;
}

interface EventImpactTimelineProps {
  events: EventImpactItem[];
}

function getVerdictStyle(verdict: string) {
  switch (verdict) {
    case 'positive': return { badge: 'bg-green-500/10 text-green-400', label: 'Positive' };
    case 'negative': return { badge: 'bg-red-500/10 text-red-400', label: 'Negative' };
    case 'neutral': return { badge: 'bg-gray-500/10 text-gray-400', label: 'Neutral' };
    default: return { badge: 'bg-amber-500/10 text-amber-400', label: 'Measuring...' };
  }
}

function getEventIcon(eventType: string): string {
  switch (eventType) {
    case 'update': return '🔄';
    case 'sale': return '🏷️';
    case 'holiday': return '🎉';
    case 'custom': return '📌';
    default: return '📊';
  }
}

export function EventImpactTimeline({ events }: EventImpactTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-2 font-semibold text-white">Event Impact</h3>
        <div className="flex h-24 items-center justify-center text-gray-500 text-sm">
          No events tracked yet. Events are detected automatically or via Commands.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h3 className="mb-4 font-semibold text-white">Event Impact</h3>
      <div className="space-y-3">
        {events.map((event) => {
          const style = getVerdictStyle(event.verdict);
          const revChange = event.revenueBefore > 0
            ? Math.round(((event.revenueAfter - event.revenueBefore) / event.revenueBefore) * 100)
            : 0;

          return (
            <div key={event.id} className="rounded-lg border border-gray-800 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span>{getEventIcon(event.eventType)}</span>
                  <div>
                    <p className="text-sm font-medium text-white">{event.eventName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(event.startedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                  {style.label}
                </span>
              </div>

              {event.measured && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded bg-gray-800/50 px-3 py-2">
                    <p className="text-xs text-gray-500">DAU Change</p>
                    <p className={`text-lg font-bold ${event.dauChangePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {event.dauChangePercent >= 0 ? '+' : ''}{event.dauChangePercent.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded bg-gray-800/50 px-3 py-2">
                    <p className="text-xs text-gray-500">Revenue Change</p>
                    <p className={`text-lg font-bold ${revChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {revChange >= 0 ? '+' : ''}{revChange}%
                    </p>
                  </div>
                </div>
              )}

              {event.claudeSummary && (
                <p className="mt-3 text-sm text-gray-400">{event.claudeSummary}</p>
              )}

              {!event.measured && (
                <p className="mt-2 text-xs text-amber-400">
                  Impact will be measured 7 days after event start.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
