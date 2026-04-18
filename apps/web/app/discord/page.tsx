'use client';

import Link from 'next/link';

const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || 'YOUR_CLIENT_ID';
const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=2048&scope=bot%20applications.commands`;

const FEATURES = [
  {
    icon: '\uD83D\uDCCA',
    title: '/devmaxx status',
    description: 'Check your game health, DAU trend, and last agent impact anytime.',
  },
  {
    icon: '\uD83D\uDCCB',
    title: 'Weekly GrowthBrief',
    description: 'Your Sunday brief delivered directly to your Discord server.',
  },
  {
    icon: '\u26A0\uFE0F',
    title: 'Instant Alerts',
    description: 'DAU drops >15%, competitor surges, pricing test results \u2014 know immediately.',
  },
  {
    icon: '\uD83C\uDFC6',
    title: '/devmaxx brief',
    description: 'Pull up the latest brief anytime with a single slash command.',
  },
  {
    icon: '\uD83D\uDD17',
    title: 'Easy Setup',
    description: 'Add the bot, run /devmaxx connect, link your game. Done in 60 seconds.',
  },
  {
    icon: '\uD83D\uDCB0',
    title: 'Free for All Plans',
    description: 'Discord integration is included on every plan, even free tier.',
  },
];

export default function DiscordPage() {
  return (
    <main className="relative min-h-screen bg-gray-950">
      {/* Grid background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(79,70,229,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(79,70,229,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 border-b border-gray-800/50 bg-gray-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-white">Devmaxx</Link>
          <div className="flex items-center gap-6">
            <Link href="/leaderboard" className="text-sm text-gray-400 transition hover:text-white">Leaderboard</Link>
            <Link href="/pricing" className="text-sm text-gray-400 transition hover:text-white">Pricing</Link>
            <Link href="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500">Sign in</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-4 pb-12 pt-16 text-center sm:pt-24">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#5865F2]/20">
          <svg className="h-10 w-10 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          Devmaxx for Discord
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-400">
          Get your weekly GrowthBrief and DAU alerts directly in your Roblox server. Free for all plans.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href={INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#5865F2]/20 transition hover:bg-[#4752C4]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
            </svg>
            Add to Server
          </a>
          <Link
            href="/login"
            className="rounded-lg border border-gray-700 px-8 py-3.5 text-base font-semibold text-gray-300 transition hover:border-gray-500 hover:text-white"
          >
            Sign in first &rarr;
          </Link>
        </div>
      </section>

      {/* Mock embed */}
      <section className="relative mx-auto max-w-2xl px-4 pb-16">
        <div className="rounded-lg border-l-4 border-l-[#5865F2] bg-[#2f3136] p-4 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5865F2]">
              <span className="text-xs font-bold text-white">D</span>
            </div>
            <span className="font-semibold text-white">Devmaxx</span>
            <span className="rounded bg-[#5865F2] px-1.5 py-0.5 text-[10px] font-semibold text-white">BOT</span>
          </div>
          <div className="mt-3 rounded bg-[#36393f] p-3">
            <div className="text-sm font-semibold text-white">Obby Adventure Tycoon</div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-gray-400">Health Score</div>
                <div className="font-bold text-emerald-400">72/100</div>
              </div>
              <div>
                <div className="text-gray-400">DAU</div>
                <div className="font-bold text-white">{'\u2191'} 5,200</div>
              </div>
              <div>
                <div className="text-gray-400">Robux Earned</div>
                <div className="font-bold text-white">15,420 R$</div>
              </div>
            </div>
            <div className="mt-3 border-t border-gray-600 pt-2 text-xs text-gray-400">
              Last Agent Run: Pricing Optimization \u2014 +1,240 R$
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="relative border-t border-gray-800/50 bg-gray-900/30 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">
            Everything you need, in your server
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-gray-800 bg-gray-900 p-6">
                <div className="text-2xl">{feature.icon}</div>
                <h3 className="mt-3 font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-white">Ready to add Devmaxx to your server?</h2>
        <p className="mt-3 text-gray-400">Takes 30 seconds. Free for all plans.</p>
        <a
          href={INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-8 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-[#4752C4]"
        >
          Add to Server
        </a>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-gray-800 px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div>
              <div className="text-lg font-bold text-white">Devmaxx</div>
              <p className="mt-1 text-sm text-gray-600">Built for Roblox creators, by a creator.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <Link href="/leaderboard" className="transition hover:text-gray-300">Leaderboard</Link>
              <Link href="/pricing" className="transition hover:text-gray-300">Pricing</Link>
              <Link href="/devex-calculator" className="transition hover:text-gray-300">DevEx Calculator</Link>
              <Link href="/discord" className="font-medium text-[#5865F2] transition hover:text-[#7289DA]">Discord</Link>
              <a href="https://x.com/devmaxxapp" target="_blank" rel="noopener noreferrer" className="transition hover:text-gray-300">@devmaxxapp</a>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-gray-700">Devmaxx &middot; devmaxx.app &middot; Maxx your DevEx</p>
        </div>
      </footer>
    </main>
  );
}
