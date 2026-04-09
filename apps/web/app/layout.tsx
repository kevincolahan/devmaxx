import type { Metadata } from 'next';
import { ReferralBanner } from '@/components/referral-banner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Devmaxx — Maxx your DevEx',
  description:
    'AI-powered business operations platform for Roblox game creators. Maximize your DevEx earnings with autonomous agents.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-white antialiased">
        <ReferralBanner />
        {children}
      </body>
    </html>
  );
}
