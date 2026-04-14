'use client';

import Link from 'next/link';
import { useState } from 'react';

/* ──────────────────────────────────────────────
   DATA
   ────────────────────────────────────────────── */

const AGENTS = [
  {
    name: 'Pricing Optimizer',
    description:
      'A/B tests your item prices weekly to find the revenue-maximizing point. Most creators set a price once and never touch it.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    name: 'Metrics Monitor',
    description:
      "Tracks DAU, retention, and revenue daily. Alerts you when something changes. You shouldn't have to remember to check.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    name: 'Growth Brief',
    description:
      'Every Sunday: a weekly business brief in your inbox. What changed, what to do next, and where the money is.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    name: 'Competitor Intel',
    description:
      'Watches rival games daily. Knows when they update, surge, or drop. You see it before your players leave.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    name: 'Player Support',
    description:
      'Auto-responds to player tickets with context-aware answers. Resolves the common stuff. Escalates the rest.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
  },
  {
    name: 'Natural Language Commands',
    description:
      'Tell your game what to do in plain English. "Run a 20% sale on the VIP pass for 48 hours." Done.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
];

const MONTHLY_PRICES = { Free: 0, Creator: 49, Pro: 99, Studio: 249 };
const ANNUAL_PRICES = { Free: 0, Creator: 41, Pro: 83, Studio: 208 };

const PLANS = [
  {
    name: 'Free' as const,
    description: 'Get started with one game',
    features: ['1 game', 'Weekly Growth Brief', 'DevEx Calculator', 'Basic metrics dashboard'],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Creator' as const,
    description: 'All agents, manual approval',
    features: [
      '2 games',
      'All 6 AI agents',
      'Pricing A/B testing',
      'Player support auto-response',
      'Content generation',
    ],
    cta: 'Start Creator',
    highlighted: true,
  },
  {
    name: 'Pro' as const,
    description: 'Autopilot mode + competitors',
    features: [
      '5 games',
      'Everything in Creator',
      'Autopilot mode',
      'Competitor tracking',
      'Revenue forecasting',
    ],
    cta: 'Start Pro',
    highlighted: false,
  },
  {
    name: 'Studio' as const,
    description: 'Unlimited games, team access',
    features: [
      'Unlimited games',
      'Everything in Pro',
      'White-label reports',
      '3 team seats',
      'Priority support',
    ],
    cta: 'Start Studio',
    highlighted: false,
  },
];

const FAQS = [
  {
    q: 'Is this against Roblox TOS?',
    a: "No. Devmaxx uses the official Roblox Open Cloud API with proper OAuth authorization. We read analytics and economy data through the same endpoints Roblox provides to all developers.",
  },
  {
    q: 'How does it connect to my game?',
    a: "You authorize Devmaxx through Roblox OAuth during onboarding. This gives our agents read access to your game's analytics and economy data. Price changes require your explicit approval (unless you enable Autopilot).",
  },
  {
    q: 'What if I have multiple games?',
    a: 'Free tier supports 1 game. Creator supports 2, Pro supports 5, and Studio is unlimited. Each game gets its own set of agents running independently.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your dashboard or email us. No contracts, no cancellation fees. Your data stays available for 30 days after cancellation.',
  },
];

/* ──────────────────────────────────────────────
   PAGE
   ────────────────────────────────────────────── */

export default function Home() {
  const [annual, setAnnual] = useState(false);

  return (
    <main className="min-h-screen bg-gray-950">
      {/* ── Hero ── */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-20 text-center sm:pt-28">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Your Roblox game is a business.
          <br />
          <span className="text-indigo-400">Run it like one.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
          AI agents handle pricing optimization, player support, competitor tracking, and weekly
          business briefs — automatically.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/login"
            className="rounded-lg bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
          >
            Connect your game free &rarr;
          </Link>
          <Link
            href="/devex-calculator"
            className="rounded-lg border border-gray-700 px-8 py-3.5 text-base font-semibold text-gray-300 transition hover:border-gray-500 hover:text-white"
          >
            See the DevEx Calculator &rarr;
          </Link>
        </div>

        {/* Social proof bar */}
        <div className="mt-12 flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
          <p className="text-sm font-medium text-gray-500">
            Trusted by Roblox creators earning DevEx
          </p>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-lg font-bold text-white">88M+</div>
              <div className="text-xs text-gray-600">Roblox DAU</div>
            </div>
            <div className="h-6 w-px bg-gray-800" />
            <div className="text-center">
              <div className="text-lg font-bold text-white">$1B+</div>
              <div className="text-xs text-gray-600">Paid to creators</div>
            </div>
            <div className="h-6 w-px bg-gray-800" />
            <div className="text-center">
              <div className="text-lg font-bold text-white">6</div>
              <div className="text-xs text-gray-600">AI agents</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem ── */}
      <section className="border-t border-gray-800/50 bg-gray-900/30 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">
            The average Roblox creator leaves{' '}
            <span className="text-emerald-400">40%</span> of potential earnings on the table
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {/* Pain point 1 */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-white">Manual analytics checking</h3>
              <p className="mt-2 text-sm text-gray-500">
                Most creators check their numbers once a month. By then, problems are weeks old and
                money is already lost.
              </p>
            </div>

            {/* Pain point 2 */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-white">No pricing strategy</h3>
              <p className="mt-2 text-sm text-gray-500">
                Prices set once on day one and never tested. A 15% price increase on the right item
                can double revenue.
              </p>
            </div>

            {/* Pain point 3 */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-white">Zero competitor awareness</h3>
              <p className="mt-2 text-sm text-gray-500">
                No idea when a rival game surges or drops. By the time you notice, your players
                already moved.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Agents ── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">
            6 AI agents working on your game 24/7
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-gray-400">
            Connect once. They run continuously. You get weekly briefs and approve changes — or let
            Autopilot handle everything.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {AGENTS.map((agent) => (
              <div
                key={agent.name}
                className="group rounded-xl border border-gray-800 bg-gray-900 p-6 transition hover:border-indigo-500/40 hover:bg-gray-900/80"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 transition group-hover:bg-indigo-500/20">
                  {agent.icon}
                </div>
                <h3 className="mt-4 font-semibold text-white">{agent.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{agent.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social Proof / Stats ── */}
      <section className="border-t border-gray-800/50 bg-gray-900/30 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center">
              <div className="text-3xl font-bold text-emerald-400">$1B+</div>
              <p className="mt-2 text-sm text-gray-400">
                Roblox paid to creators through DevEx last year
              </p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center">
              <div className="text-3xl font-bold text-emerald-400">23%</div>
              <p className="mt-2 text-sm text-gray-400">
                More DevEx for games that A/B test prices
              </p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center">
              <div className="text-3xl font-bold text-emerald-400">Daily</div>
              <p className="mt-2 text-sm text-gray-400">
                Top creators check retention daily — most don&apos;t
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-6 text-center">
              <div className="text-3xl font-bold text-emerald-400">Free</div>
              <p className="mt-2 text-sm text-gray-400">DevEx Calculator — see what you&apos;re leaving on the table</p>
              <Link
                href="/devex-calculator"
                className="mt-3 inline-block text-sm font-semibold text-emerald-400 transition hover:text-emerald-300"
              >
                Try it now &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">
            Simple pricing. Start free.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-gray-400">
            No credit card required. Upgrade when your game is ready.
          </p>

          {/* Annual toggle */}
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
                Save 2 months
              </span>
            )}
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => {
              const price = annual
                ? ANNUAL_PRICES[plan.name]
                : MONTHLY_PRICES[plan.name];

              return (
                <div
                  key={plan.name}
                  className={`relative rounded-xl border p-6 ${
                    plan.highlighted
                      ? 'border-indigo-500 bg-indigo-950/30 shadow-lg shadow-indigo-500/10'
                      : 'border-gray-800 bg-gray-900'
                  }`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <div className="mt-3">
                    {price === 0 ? (
                      <span className="text-3xl font-bold text-white">Free</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-white">${price}</span>
                        <span className="text-gray-500">/mo</span>
                      </>
                    )}
                  </div>
                  {annual && price > 0 && (
                    <p className="mt-1 text-xs text-emerald-400">
                      ${price * 12}/yr — save ${(MONTHLY_PRICES[plan.name] - price) * 12}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-gray-500">{plan.description}</p>
                  <ul className="mt-4 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-gray-400">
                        <svg
                          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={price === 0 ? '/login' : '/pricing'}
                    className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
                      plan.highlighted
                        ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                        : 'border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-gray-800/50 bg-gray-900/30 px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">
            Frequently asked questions
          </h2>
          <div className="mt-12 space-y-6">
            {FAQS.map((faq) => (
              <div key={faq.q} className="rounded-xl border border-gray-800 bg-gray-900 p-6">
                <h3 className="font-semibold text-white">{faq.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Stop guessing. Start optimizing.
          </h2>
          <p className="mt-4 text-gray-400">
            Connect your Roblox game in 2 minutes. Free tier available — no credit card required.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="inline-block rounded-lg bg-indigo-600 px-10 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
            >
              Connect your game free &rarr;
            </Link>
            <Link
              href="/devex-calculator"
              className="inline-block rounded-lg border border-gray-700 px-10 py-4 text-base font-semibold text-gray-300 transition hover:border-gray-500 hover:text-white"
            >
              DevEx Calculator &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-800 px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div>
              <div className="text-lg font-bold text-white">Devmaxx</div>
              <p className="mt-1 text-sm text-gray-600">
                Built for Roblox creators, by a creator.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <Link href="/pricing" className="transition hover:text-gray-300">
                Pricing
              </Link>
              <Link href="/devex-calculator" className="transition hover:text-gray-300">
                DevEx Calculator
              </Link>
              <Link href="/privacy" className="transition hover:text-gray-300">
                Privacy
              </Link>
              <Link href="/terms" className="transition hover:text-gray-300">
                Terms
              </Link>
              <a
                href="https://x.com/devmaxxapp"
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-gray-300"
              >
                @devmaxxapp
              </a>
              <a
                href="https://linkedin.com/company/devmax"
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-gray-300"
              >
                LinkedIn
              </a>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-gray-700">
            Devmaxx &middot; devmaxx.app &middot; Maxx your DevEx
          </p>
        </div>
      </footer>
    </main>
  );
}
