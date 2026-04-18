import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Devmaxx for Discord — Game Analytics in Your Server',
  description: 'Get weekly GrowthBriefs, DAU alerts, and game status updates directly in your Roblox Discord server. Free for all plans.',
  openGraph: {
    title: 'Devmaxx for Discord',
    description: 'Game analytics and alerts in your Roblox Discord server.',
    url: 'https://devmaxx.app/discord',
    siteName: 'Devmaxx',
  },
};

export default function DiscordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
