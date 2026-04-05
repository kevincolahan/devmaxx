'use client';

interface ForecastData {
  next30DaysRobux: number;
  next90DaysRobux: number;
  projectedDevExUSD: number;
  upsideRobux: number;
  downsideRobux: number;
  assumptions: {
    assumptions?: string[];
    upsideReason?: string;
    downsideReason?: string;
    keyInsight?: string;
    actionToImprove?: string;
  };
  seasonalFactors: {
    current?: Array<{ name: string; multiplier: number }>;
    upcoming?: Array<{ name: string; multiplier: number }>;
    alerts?: string[];
  };
  forecastDate: string;
}

interface RevenueForecastCardProps {
  forecast: ForecastData | null;
}

export function RevenueForecastCard({ forecast }: RevenueForecastCardProps) {
  if (!forecast) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-2 font-semibold text-white">Revenue Forecast</h3>
        <div className="flex h-24 items-center justify-center text-gray-500 text-sm">
          No forecast yet. Generated weekly on Mondays.
        </div>
      </div>
    );
  }

  const rangeMin = forecast.downsideRobux;
  const rangeMax = forecast.upsideRobux;
  const base = forecast.next30DaysRobux;
  const total = rangeMax - rangeMin;
  const basePosition = total > 0 ? ((base - rangeMin) / total) * 100 : 50;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Revenue Forecast</h3>
        <span className="text-xs text-gray-500">
          Updated {new Date(forecast.forecastDate).toLocaleDateString()}
        </span>
      </div>

      {/* Main projection */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-400">Next 30 days</p>
          <p className="mt-1 text-2xl font-bold text-white">{forecast.next30DaysRobux.toLocaleString()} R$</p>
          <p className="text-xs text-gray-500">~${forecast.projectedDevExUSD.toFixed(0)} USD</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Next 90 days</p>
          <p className="mt-1 text-2xl font-bold text-gray-300">{forecast.next90DaysRobux.toLocaleString()} R$</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">If you act</p>
          <p className="mt-1 text-2xl font-bold text-green-400">+{(forecast.upsideRobux - base).toLocaleString()} R$</p>
        </div>
      </div>

      {/* Range bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Downside: {forecast.downsideRobux.toLocaleString()} R$</span>
          <span>Upside: {forecast.upsideRobux.toLocaleString()} R$</span>
        </div>
        <div className="relative h-3 rounded-full bg-gray-800 overflow-hidden">
          {/* Downside zone */}
          <div
            className="absolute left-0 top-0 h-full bg-red-500/30"
            style={{ width: `${basePosition}%` }}
          />
          {/* Upside zone */}
          <div
            className="absolute top-0 h-full bg-green-500/30"
            style={{ left: `${basePosition}%`, width: `${100 - basePosition}%` }}
          />
          {/* Base marker */}
          <div
            className="absolute top-0 h-full w-1 bg-white rounded"
            style={{ left: `${basePosition}%` }}
          />
        </div>
        <div className="mt-1 text-center text-xs text-gray-400">
          Base: {base.toLocaleString()} R$
        </div>
      </div>

      {/* Key insight */}
      {forecast.assumptions.keyInsight && (
        <p className="mt-4 text-sm text-gray-400">{forecast.assumptions.keyInsight}</p>
      )}

      {/* Action to improve */}
      {forecast.assumptions.actionToImprove && (
        <div className="mt-3 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-2">
          <p className="text-sm text-green-400">{forecast.assumptions.actionToImprove}</p>
        </div>
      )}

      {/* Seasonal alerts */}
      {forecast.seasonalFactors.alerts && forecast.seasonalFactors.alerts.length > 0 && (
        <div className="mt-3 space-y-2">
          {forecast.seasonalFactors.alerts.map((alert, i) => (
            <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2">
              <p className="text-sm text-amber-400">{alert}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
