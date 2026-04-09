'use client';

import { useState } from 'react';

interface ReferralItem {
  id: string;
  referredEmail: string;
  status: string;
  convertedAt: string | null;
  creditedAt: string | null;
  createdAt: string;
}

interface ReferralPanelProps {
  referralCode: string;
  referralCredits: number;
  referrals: ReferralItem[];
}

export function ReferralPanel({ referralCode, referralCredits, referrals }: ReferralPanelProps) {
  const [copied, setCopied] = useState(false);
  const referralLink = `https://devmaxx.app?ref=${referralCode}`;

  const totalSent = referrals.length;
  const converted = referrals.filter((r) => r.status === 'credited' || r.status === 'converted').length;

  function handleCopy() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="text-lg font-semibold text-white">Refer creators, earn free months</h3>
        <p className="mt-1 text-sm text-gray-400">
          Share your link with Roblox creators. When they upgrade to a paid plan, you get 1 free month.
        </p>

        {/* Referral link */}
        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5">
            <span className="text-sm text-gray-300">{referralLink}</span>
          </div>
          <button
            onClick={handleCopy}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-indigo-600 text-white hover:bg-indigo-500'
            }`}
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Referrals Sent</div>
          <div className="mt-1 text-2xl font-bold">{totalSent}</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Converted to Paid</div>
          <div className="mt-1 text-2xl font-bold text-green-400">{converted}</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Free Months Earned</div>
          <div className="mt-1 text-2xl font-bold text-indigo-400">{referralCredits}</div>
        </div>
      </div>

      {/* Referral history */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h4 className="mb-4 font-semibold text-white">Referral History</h4>

        {referrals.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-gray-500">
            No referrals yet. Share your link to get started!
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((ref) => {
              const statusStyles: Record<string, { label: string; color: string }> = {
                pending: { label: 'Signed up', color: 'bg-amber-500/10 text-amber-400' },
                converted: { label: 'Upgraded', color: 'bg-blue-500/10 text-blue-400' },
                credited: { label: 'Credit earned', color: 'bg-green-500/10 text-green-400' },
              };
              const style = statusStyles[ref.status] ?? statusStyles.pending;

              return (
                <div
                  key={ref.id}
                  className="flex items-center justify-between rounded-lg border border-gray-800 px-4 py-3"
                >
                  <div>
                    <span className="text-sm text-gray-300">{ref.referredEmail}</span>
                    <div className="text-xs text-gray-600">
                      {new Date(ref.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style.color}`}>
                    {style.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
