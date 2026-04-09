import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Roblox DevEx Calculator — Estimate Your Monthly Earnings | Devmaxx',
  description:
    'Free Roblox DevEx calculator. Estimate your monthly earnings based on DAU, retention, and pricing. See your optimization potential.',
  keywords: [
    'roblox devex calculator',
    'roblox earnings calculator',
    'how much does roblox pay creators',
    'roblox devex how much',
    'roblox game revenue calculator',
    'devex rate calculator',
    'roblox creator earnings',
  ],
  openGraph: {
    title: 'Roblox DevEx Calculator — Estimate Your Monthly Earnings',
    description:
      'Free Roblox DevEx calculator. Estimate your monthly earnings based on DAU, retention, and pricing.',
    url: 'https://devmaxx.app/devex-calculator',
    siteName: 'Devmaxx',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Roblox DevEx Calculator — Estimate Your Monthly Earnings',
    description:
      'Free Roblox DevEx calculator. Estimate your monthly earnings based on DAU, retention, and pricing.',
    creator: '@devmaxxapp',
  },
  alternates: {
    canonical: 'https://devmaxx.app/devex-calculator',
  },
};

export default function DevExCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
