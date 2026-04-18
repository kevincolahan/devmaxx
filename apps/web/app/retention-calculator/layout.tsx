import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Roblox Retention Calculator — See How Your Game Compares | Devmaxx',
  description:
    "Free tool to benchmark your Roblox game's D1, D7, and D30 retention against genre averages. See your revenue upside instantly.",
  keywords: ['roblox retention rate', 'roblox d7 retention', 'roblox game analytics benchmark', 'roblox retention calculator'],
  openGraph: {
    title: 'Roblox Retention Calculator — See How Your Game Compares',
    description: "Free tool to benchmark your Roblox game's D1, D7, and D30 retention against genre averages.",
    url: 'https://devmaxx.app/retention-calculator',
    siteName: 'Devmaxx',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Roblox Retention Calculator | Devmaxx',
    description: "Benchmark your Roblox game's retention against genre averages. Free tool.",
    creator: '@devmaxxapp',
  },
};

export default function RetentionCalculatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
