'use client';

import { useState } from 'react';

interface PriceTest {
  id: string;
  itemName: string;
  priceA: number;
  priceB: number;
  exposuresA: number;
  exposuresB: number;
  revenueA: number;
  revenueB: number;
  status: string;
  winner: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface PricingTestsTableProps {
  tests: PriceTest[];
  creatorId?: string;
  gameId?: string;
}

function getRpeDisplay(revenue: number, exposures: number): string {
  if (exposures === 0) return '--';
  return (revenue / exposures).toFixed(2);
}

function getStatusBadge(status: string, winner: string | null) {
  if (status === 'complete') {
    if (winner === 'A') return { label: 'Winner: A (Original)', className: 'bg-blue-400/10 text-blue-400' };
    if (winner === 'B') return { label: 'Winner: B (Variant)', className: 'bg-green-400/10 text-green-400' };
    return { label: 'Inconclusive', className: 'bg-gray-400/10 text-gray-400' };
  }
  if (status === 'running') return { label: 'Running', className: 'bg-yellow-400/10 text-yellow-400' };
  return { label: 'Cancelled', className: 'bg-red-400/10 text-red-400' };
}

function timeRunning(startedAt: string): string {
  const hours = Math.floor((Date.now() - new Date(startedAt).getTime()) / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function PricingTestsTable({ tests, creatorId, gameId }: PricingTestsTableProps) {
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  async function handleApplyWinner(test: PriceTest) {
    if (!creatorId || !gameId) return;
    const winnerPrice = test.winner === 'B' ? test.priceB : test.priceA;
    const loserPrice = test.winner === 'B' ? test.priceA : test.priceB;

    setApplyingId(test.id);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'apply-price',
          creatorId,
          gameId,
          itemId: test.id,
          itemName: test.itemName,
          currentPrice: loserPrice,
          newPrice: winnerPrice,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(`Failed to apply: ${data.error}`);
        return;
      }

      setAppliedIds((prev) => new Set(prev).add(test.id));
    } catch (err) {
      alert(`Error: ${String(err)}`);
    } finally {
      setApplyingId(null);
    }
  }

  if (tests.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 font-semibold text-white">Pricing Tests</h3>
        <div className="flex h-32 items-center justify-center text-gray-500">
          No pricing tests yet. The pricing agent will create tests weekly.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h3 className="mb-4 font-semibold text-white">Pricing Tests</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-400">
              <th className="pb-3 pr-4 font-medium">Item</th>
              <th className="pb-3 pr-4 font-medium">Price A</th>
              <th className="pb-3 pr-4 font-medium">Price B</th>
              <th className="pb-3 pr-4 font-medium">RPE A</th>
              <th className="pb-3 pr-4 font-medium">RPE B</th>
              <th className="pb-3 pr-4 font-medium">Duration</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((test) => {
              const badge = getStatusBadge(test.status, test.winner);
              const hasWinner = test.status === 'complete' && (test.winner === 'A' || test.winner === 'B');
              const isApplied = appliedIds.has(test.id);

              return (
                <tr key={test.id} className="border-b border-gray-800/50">
                  <td className="py-3 pr-4 font-medium text-white">{test.itemName}</td>
                  <td className="py-3 pr-4 text-gray-300">{test.priceA} R$</td>
                  <td className="py-3 pr-4 text-gray-300">{test.priceB} R$</td>
                  <td className="py-3 pr-4 text-gray-300">{getRpeDisplay(test.revenueA, test.exposuresA)}</td>
                  <td className="py-3 pr-4 text-gray-300">{getRpeDisplay(test.revenueB, test.exposuresB)}</td>
                  <td className="py-3 pr-4 text-gray-400">{timeRunning(test.startedAt)}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="py-3">
                    {hasWinner && !isApplied && creatorId && (
                      <button
                        onClick={() => handleApplyWinner(test)}
                        disabled={applyingId === test.id}
                        className="rounded-md bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                      >
                        {applyingId === test.id ? 'Applying...' : `Apply ${test.winner === 'B' ? test.priceB : test.priceA} R$`}
                      </button>
                    )}
                    {isApplied && (
                      <span className="text-xs text-green-400">Applied</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
