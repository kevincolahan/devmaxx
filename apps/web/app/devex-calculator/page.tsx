'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const DEVEX_RATE = 0.0035;

const RETENTION_BENCHMARKS: Record<string, { median: number; top10: number }> = {
  small: { median: 18, top10: 35 },      // DAU < 500
  medium: { median: 22, top10: 40 },     // DAU 500-5000
  large: { median: 28, top10: 48 },      // DAU 5000-50000
  massive: { median: 32, top10: 55 },    // DAU 50000+
};

function getDauTier(dau: number): string {
  if (dau < 500) return 'small';
  if (dau < 5000) return 'medium';
  if (dau < 50000) return 'large';
  return 'massive';
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

export default function DevExCalculatorPage() {
  const searchParams = useSearchParams();

  const [dau, setDau] = useState(Number(searchParams.get('dau')) || 1000);
  const [retention, setRetention] = useState(Number(searchParams.get('ret')) || 25);
  const [robuxPerDau, setRobuxPerDau] = useState(Number(searchParams.get('rpd')) || 1.5);
  const [itemCount, setItemCount] = useState(Number(searchParams.get('items')) || 5);
  const [avgPrice, setAvgPrice] = useState(Number(searchParams.get('price')) || 100);
  const [copied, setCopied] = useState(false);

  // Calculations
  const monthlyRobux = dau * robuxPerDau * 30;
  const monthlyUsd = monthlyRobux * DEVEX_RATE;
  const annualUsd = monthlyUsd * 12;

  const tier = getDauTier(dau);
  const benchmark = RETENTION_BENCHMARKS[tier];

  // Optimization potential: what top 10% retention games earn
  const retentionMultiplier = benchmark.top10 / Math.max(retention, 1);
  const pricingMultiplier = 1.15; // 15% price optimization typical uplift
  const optimizedMonthlyRobux = monthlyRobux * retentionMultiplier * pricingMultiplier;
  const optimizedMonthlyUsd = optimizedMonthlyRobux * DEVEX_RATE;
  const optimizationGap = optimizedMonthlyUsd - monthlyUsd;
  const optimizationPercent = monthlyUsd > 0 ? Math.round((optimizationGap / monthlyUsd) * 100) : 0;

  const shareUrl = useCallback(() => {
    const params = new URLSearchParams({
      dau: String(dau),
      ret: String(retention),
      rpd: String(robuxPerDau),
      items: String(itemCount),
      price: String(avgPrice),
    });
    return `https://devmaxx.app/devex-calculator?${params.toString()}`;
  }, [dau, retention, robuxPerDau, itemCount, avgPrice]);

  function handleShare() {
    const url = shareUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleShareX() {
    const text = `My Roblox game could earn ${formatUsd(monthlyUsd)}/month with optimized pricing. Calculate yours:`;
    const url = shareUrl();
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank'
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      {/* Header */}
      <div className="mb-2">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300">
          &larr; devmaxx.app
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-white sm:text-4xl">
        Roblox DevEx Calculator
      </h1>
      <p className="mt-2 text-lg text-gray-400">
        Estimate your monthly DevEx earnings and see how much more you could earn with optimized pricing and retention.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        {/* Left: Inputs */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-white">Your Game Metrics</h2>

          {/* DAU */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Daily Active Users (DAU)</label>
              <input
                type="number"
                value={dau}
                onChange={(e) => setDau(Math.max(100, Math.min(100000, Number(e.target.value) || 100)))}
                className="w-24 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-right text-sm text-white"
              />
            </div>
            <input
              type="range"
              min={100}
              max={100000}
              step={100}
              value={dau}
              onChange={(e) => setDau(Number(e.target.value))}
              className="mt-2 w-full accent-indigo-500"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-600">
              <span>100</span>
              <span>100,000</span>
            </div>
          </div>

          {/* Retention */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">D7 Retention (%)</label>
              <input
                type="number"
                value={retention}
                onChange={(e) => setRetention(Math.max(5, Math.min(80, Number(e.target.value) || 5)))}
                className="w-20 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-right text-sm text-white"
              />
            </div>
            <input
              type="range"
              min={5}
              max={80}
              step={1}
              value={retention}
              onChange={(e) => setRetention(Number(e.target.value))}
              className="mt-2 w-full accent-indigo-500"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-600">
              <span>5%</span>
              <span>Median: {benchmark.median}%</span>
              <span>80%</span>
            </div>
          </div>

          {/* Robux per DAU */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Avg Robux per DAU per day</label>
              <input
                type="number"
                value={robuxPerDau}
                onChange={(e) => setRobuxPerDau(Math.max(0.1, Math.min(10, Number(e.target.value) || 0.1)))}
                step={0.1}
                className="w-20 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-right text-sm text-white"
              />
            </div>
            <input
              type="range"
              min={0.1}
              max={10}
              step={0.1}
              value={robuxPerDau}
              onChange={(e) => setRobuxPerDau(Number(e.target.value))}
              className="mt-2 w-full accent-indigo-500"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-600">
              <span>0.1 R$</span>
              <span>10 R$</span>
            </div>
          </div>

          {/* Item count */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Number of game passes/items</label>
              <input
                type="number"
                value={itemCount}
                onChange={(e) => setItemCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className="w-20 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-right text-sm text-white"
              />
            </div>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={itemCount}
              onChange={(e) => setItemCount(Number(e.target.value))}
              className="mt-2 w-full accent-indigo-500"
            />
          </div>

          {/* Average price */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Average item price (Robux)</label>
              <input
                type="number"
                value={avgPrice}
                onChange={(e) => setAvgPrice(Math.max(5, Math.min(1000, Number(e.target.value) || 5)))}
                className="w-24 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-right text-sm text-white"
              />
            </div>
            <input
              type="range"
              min={5}
              max={1000}
              step={5}
              value={avgPrice}
              onChange={(e) => setAvgPrice(Number(e.target.value))}
              className="mt-2 w-full accent-indigo-500"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-600">
              <span>5 R$</span>
              <span>1,000 R$</span>
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-6">
          {/* Big number */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
            <div className="text-sm font-medium text-gray-400">Estimated Monthly DevEx</div>
            <div className="mt-2 text-5xl font-bold text-white">
              {formatUsd(monthlyUsd)}
            </div>
            <div className="mt-1 text-sm text-gray-500">per month</div>
            <div className="mt-4 text-2xl font-semibold text-indigo-400">
              {formatUsd(annualUsd)}/year
            </div>
          </div>

          {/* Breakdown */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="mb-4 font-semibold text-white">Earnings Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Monthly Robux earned</span>
                <span className="text-white">{formatNumber(monthlyRobux)} R$</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">DevEx exchange rate</span>
                <span className="text-white">$0.0035 per Robux</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Catalog ({itemCount} items avg {formatNumber(avgPrice)} R$)</span>
                <span className="text-white">{formatNumber(itemCount * avgPrice)} R$ catalog value</span>
              </div>
              <div className="border-t border-gray-800 pt-3">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-300">Monthly USD</span>
                  <span className="text-green-400">{formatUsd(monthlyUsd)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Optimization potential */}
          {retention < benchmark.top10 && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-6">
              <h3 className="mb-3 font-semibold text-indigo-300">Optimization Potential</h3>
              <p className="text-sm text-gray-300">
                Games at your DAU level with top-10% retention ({benchmark.top10}%) and optimized pricing earn{' '}
                <span className="font-bold text-white">{optimizationPercent}% more</span>.
              </p>
              <div className="mt-4 flex items-end gap-4">
                <div>
                  <div className="text-xs text-gray-500">Current</div>
                  <div className="text-lg font-bold text-white">{formatUsd(monthlyUsd)}</div>
                </div>
                <div className="pb-1 text-gray-600">&rarr;</div>
                <div>
                  <div className="text-xs text-gray-500">Optimized</div>
                  <div className="text-lg font-bold text-green-400">{formatUsd(optimizedMonthlyUsd)}</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-indigo-300">
                You could earn <span className="font-semibold text-white">{formatUsd(optimizationGap)} more/month</span> with better retention and pricing.
              </p>
            </div>
          )}

          {/* Share */}
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'border border-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              {copied ? 'Link copied!' : 'Copy shareable link'}
            </button>
            <button
              onClick={handleShareX}
              className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:border-gray-500"
            >
              Share on X
            </button>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="mt-16 rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
        <h2 className="text-2xl font-bold text-white">
          Want Devmaxx to optimize this automatically?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-gray-400">
          Connect your Roblox game and our AI agents will continuously optimize your pricing,
          track retention, monitor competitors, and maximize your DevEx earnings.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-800 p-4 text-left">
            <div className="text-sm font-semibold text-indigo-400">Pricing Agent</div>
            <p className="mt-1 text-xs text-gray-500">A/B tests your item prices to find the revenue-maximizing point</p>
          </div>
          <div className="rounded-lg border border-gray-800 p-4 text-left">
            <div className="text-sm font-semibold text-indigo-400">Metrics Agent</div>
            <p className="mt-1 text-xs text-gray-500">Tracks DAU, retention, and revenue daily with automated alerts</p>
          </div>
          <div className="rounded-lg border border-gray-800 p-4 text-left">
            <div className="text-sm font-semibold text-indigo-400">Growth Brief</div>
            <p className="mt-1 text-xs text-gray-500">Weekly AI-generated report with actionable growth recommendations</p>
          </div>
        </div>
        <div className="mt-8">
          <Link
            href="/login"
            className="inline-block rounded-lg bg-indigo-600 px-8 py-3 font-semibold text-white transition hover:bg-indigo-500"
          >
            Connect your game free
          </Link>
          <p className="mt-2 text-xs text-gray-500">Free tier available. No credit card required.</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-800 pt-8 text-center text-sm text-gray-500">
        <div className="flex items-center justify-center gap-6">
          <Link href="/" className="hover:text-gray-300">Home</Link>
          <Link href="/pricing" className="hover:text-gray-300">Pricing</Link>
          <Link href="/login" className="hover:text-gray-300">Login</Link>
          <Link href="/privacy" className="hover:text-gray-300">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-300">Terms</Link>
        </div>
        <p className="mt-4">Devmaxx &middot; devmaxx.app &middot; Maxx your DevEx</p>
      </footer>
    </main>
  );
}
