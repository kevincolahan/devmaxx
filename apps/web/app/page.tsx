import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-5xl font-bold tracking-tight text-white">
        Devmaxx
      </h1>
      <p className="mt-4 text-xl text-gray-400">
        Maxx your DevEx. AI agents that maximize your Roblox earnings.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white transition hover:bg-brand-500"
        >
          Get Started
        </Link>
        <Link
          href="/pricing"
          className="rounded-lg border border-gray-700 px-6 py-3 font-semibold text-gray-300 transition hover:border-gray-500"
        >
          Pricing
        </Link>
      </div>
      <div className="mt-6">
        <Link
          href="/devex-calculator"
          className="text-sm text-gray-500 transition hover:text-indigo-400"
        >
          Free DevEx Calculator &rarr;
        </Link>
      </div>
    </main>
  );
}
