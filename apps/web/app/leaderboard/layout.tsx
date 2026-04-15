import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Top Roblox Games by Players & Estimated DevEx | Devmaxx',
  description:
    'Live leaderboard of the top Roblox games ranked by concurrent players and estimated monthly DevEx earnings. Updated daily.',
  keywords: ['top roblox games', 'roblox games leaderboard', 'roblox devex earnings', 'roblox leaderboard', 'devex calculator'],
  openGraph: {
    title: 'Top Roblox Games by Players & Estimated DevEx | Devmaxx',
    description: 'Live leaderboard of the top Roblox games ranked by concurrent players and estimated monthly DevEx earnings. Updated daily.',
    url: 'https://devmaxx.app/leaderboard',
    siteName: 'Devmaxx',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Top Roblox Games by Players & Estimated DevEx | Devmaxx',
    description: 'Live leaderboard of the top Roblox games ranked by concurrent players and estimated monthly DevEx earnings.',
    creator: '@devmaxxapp',
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
