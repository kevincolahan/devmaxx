'use client';

import { useState } from 'react';

const tiers = [
  {
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    annualSavings: 0,
    games: '1 game',
    features: [
      'Weekly GrowthBrief',
      'Basic metrics dashboard',
      'Community support',
    ],
    cta: 'Get Started',
    plan: 'free' as const,
    highlighted: false,
  },
  {
    name: 'Creator',
    monthlyPrice: 49,
    annualPrice: 490,
    annualSavings: 98,
    games: '2 games',
    features: [
      'All AI agents',
      'Manual approval mode',
      'Player support agent',
      'Pricing optimization',
      'Email support',
    ],
    cta: 'Start Creator',
    plan: 'creator' as const,
    highlighted: false,
  },
  {
    name: 'Pro',
    monthlyPrice: 99,
    annualPrice: 990,
    annualSavings: 198,
    games: '5 games',
    features: [
      'Everything in Creator',
      'Autopilot mode',
      'Competitor tracking',
      'Content generation',
      'Priority support',
    ],
    cta: 'Start Pro',
    plan: 'pro' as const,
    highlighted: true,
  },
  {
    name: 'Studio',
    monthlyPrice: 249,
    annualPrice: 2490,
    annualSavings: 498,
    games: 'Unlimited games',
    features: [
      'Everything in Pro',
      'White-label reports',
      '3 team seats',
      'Custom agent configs',
      'Dedicated support',
    ],
    cta: 'Start Studio',
    plan: 'studio' as const,
    highlighted: false,
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [annual, setAnnual] = useState(false);

  async function handleCheckout(plan: string) {
    if (plan === 'free') {
      window.location.href = '/login';
      return;
    }

    setLoading(plan);
    setError(null);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          billingPeriod: annual ? 'annual' : 'monthly',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Checkout failed (${res.status})`);
        setLoading(null);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('No checkout URL returned');
        setLoading(null);
      }
    } catch (err) {
      setError(`Network error: ${String(err)}`);
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Pricing</h1>
        <p className="mt-4 text-lg text-gray-400">
          Choose the plan that fits your studio.
        </p>
      </div>

      {/* Annual / Monthly toggle */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <span className={`text-sm font-medium ${!annual ? 'text-white' : 'text-gray-500'}`}>
          Monthly
        </span>
        <button
          type="button"
          onClick={() => setAnnual(!annual)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition ${
            annual ? 'bg-indigo-600' : 'bg-gray-700'
          }`}
          role="switch"
          aria-checked={annual}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition ${
              annual ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        <span className={`text-sm font-medium ${annual ? 'text-white' : 'text-gray-500'}`}>
          Annual
        </span>
        {annual && (
          <span className="ml-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            2 months free
          </span>
        )}
      </div>

      {error && (
        <div className="mx-auto mt-6 max-w-md rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="mt-10 grid gap-6 md:grid-cols-4">
        {tiers.map((tier) => {
          const displayPrice = annual
            ? Math.round(tier.annualPrice / 12)
            : tier.monthlyPrice;

          return (
            <div
              key={tier.name}
              className={`relative rounded-xl border p-6 ${
                tier.highlighted
                  ? 'border-brand-500 bg-gray-900 shadow-lg shadow-indigo-500/10'
                  : 'border-gray-800 bg-gray-900/50'
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}
              <h2 className="text-lg font-semibold">{tier.name}</h2>
              <div className="mt-4">
                {displayPrice === 0 ? (
                  <span className="text-4xl font-bold">Free</span>
                ) : (
                  <>
                    <span className="text-4xl font-bold">${displayPrice}</span>
                    <span className="text-gray-400">/mo</span>
                  </>
                )}
              </div>
              {annual && tier.annualPrice > 0 && (
                <div className="mt-1 space-y-0.5">
                  <p className="text-xs text-gray-500">
                    ${tier.annualPrice}/year billed annually
                  </p>
                  <p className="text-xs font-semibold text-emerald-400">
                    Save ${tier.annualSavings}/year
                  </p>
                </div>
              )}
              <p className="mt-2 text-sm text-gray-400">{tier.games}</p>
              <ul className="mt-6 space-y-3">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start text-sm text-gray-300"
                  >
                    <span className="mr-2 text-brand-400">&#10003;</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout(tier.plan)}
                disabled={loading === tier.plan}
                className={`mt-8 w-full rounded-lg py-2.5 font-semibold transition ${
                  tier.highlighted
                    ? 'bg-brand-600 text-white hover:bg-brand-500'
                    : 'border border-gray-700 text-gray-300 hover:border-gray-500'
                } disabled:opacity-50`}
              >
                {loading === tier.plan ? 'Loading...' : tier.cta}
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
