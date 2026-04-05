'use client';

import { useState } from 'react';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
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
    price: '$49',
    period: '/mo',
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
    price: '$99',
    period: '/mo',
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
    price: '$249',
    period: '/mo',
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
        body: JSON.stringify({ plan }),
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

      {error && (
        <div className="mx-auto mt-6 max-w-md rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="mt-12 grid gap-6 md:grid-cols-4">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-xl border p-6 ${
              tier.highlighted
                ? 'border-brand-500 bg-gray-900'
                : 'border-gray-800 bg-gray-900/50'
            }`}
          >
            <h2 className="text-lg font-semibold">{tier.name}</h2>
            <div className="mt-4">
              <span className="text-4xl font-bold">{tier.price}</span>
              <span className="text-gray-400">{tier.period}</span>
            </div>
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
        ))}
      </div>
    </main>
  );
}
