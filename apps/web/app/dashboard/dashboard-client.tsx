'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { HealthScoreCard } from '@/components/health-score-card';
import { DauChart } from '@/components/dau-chart';
import { AgentRunFeed } from '@/components/agent-run-feed';
import { ConnectRobloxButton } from '@/components/connect-roblox-button';
import { PricingTestsTable } from '@/components/pricing-tests-table';
import { RecommendationsPanel } from '@/components/recommendations-panel';
import { AutopilotToggle } from '@/components/autopilot-toggle';
import { SupportTicketsList } from '@/components/support-tickets-list';
import { ContentQueue } from '@/components/content-queue';
import { GrowthBriefPreview } from '@/components/growth-brief-preview';
import { InsightsChat } from '@/components/insights-chat';
import { MentionsFeed } from '@/components/mentions-feed';
import { CommunityOutreach } from '@/components/community-outreach';

interface Snapshot {
  date: string;
  dau: number;
  mau: number;
  concurrentPeak: number;
  avgSessionSec: number;
  retentionD1: number;
  retentionD7: number;
  retentionD30: number;
  robuxEarned: number;
  newPlayers: number;
  returningPlayers: number;
}

interface PriceTest {
  id: string;
  itemName: string;
  priceA: number;
  priceB: number;
  exposuresA: number;
  exposuresB: number;
  revenueA: number;
  revenueB: number;
  status: string;
  winner: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface SupportTicket {
  id: string;
  playerId: string;
  category: string;
  message: string;
  response: string | null;
  status: string;
  robuxValue: number | null;
  autoResolved: boolean;
  createdAt: string;
}

interface Game {
  id: string;
  name: string;
  robloxGameId: string;
  healthScore: number;
  genre: string[];
  competitors: string[];
  snapshots: Snapshot[];
  priceTests: PriceTest[];
  tickets: SupportTicket[];
}

interface AgentRun {
  id: string;
  agentName: string;
  action: string;
  robuxImpact: number | null;
  actualRobuxImpact: number | null;
  followUpCompleted: boolean;
  status: string;
  createdAt: string;
}

interface Recommendation {
  id: string;
  content: string;
  qualityScore: number | null;
  status: string;
  createdAt: string;
}

interface ContentItem {
  id: string;
  type: string;
  platform: string | null;
  content: string;
  qualityScore: number | null;
  status: string;
  sourceData: Record<string, unknown> | null;
  createdAt: string;
}

interface MentionItem {
  id: string;
  mentionId: string;
  authorUsername: string;
  authorFollowers: number;
  content: string;
  category: string;
  replyDrafted: string | null;
  replyPosted: boolean;
  replyTweetId: string | null;
  processedAt: string;
}

interface DashboardData {
  creator: {
    id: string;
    email: string;
    plan: string;
    autopilot: boolean;
    robloxUserId: string | null;
    robloxUsername: string | null;
    robloxDisplayName: string | null;
    hasApiKey: boolean;
  } | null;
  games: Game[];
  recentRuns: AgentRun[];
  recommendations: Recommendation[];
  contentPieces: ContentItem[];
  mentions: MentionItem[];
  communityLastPost: Record<string, unknown> | null;
  communityPostHistory: string[];
  lastBrief: {
    data: Record<string, unknown>;
    sentAt: string;
  } | null;
  stats: {
    totalGames: number;
    totalRuns: number;
    totalRobuxImpact: number;
  };
}

interface DashboardClientProps {
  data: DashboardData;
  userEmail: string;
}

type Tab = 'overview' | 'pricing' | 'support' | 'content' | 'mentions' | 'community' | 'brief' | 'recommendations' | 'ask';

export function DashboardClient({ data, userEmail }: DashboardClientProps) {
  const { creator, games, recentRuns, recommendations, contentPieces, mentions, communityLastPost, communityPostHistory, lastBrief, stats } = data;
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const searchParams = useSearchParams();
  const [showUpgradeMessage, setShowUpgradeMessage] = useState(false);

  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      setShowUpgradeMessage(true);
      const timer = setTimeout(() => setShowUpgradeMessage(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const allPriceTests = games.flatMap((g) => g.priceTests);
  const allTickets = games.flatMap((g) => g.tickets);
  const escalatedCount = allTickets.filter((t) => t.status === 'escalated').length;
  const draftContentCount = contentPieces.filter((c) => c.status === 'draft').length;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'ask', label: 'Ask Devmaxx' },
    { key: 'pricing', label: 'Pricing', count: allPriceTests.filter((t) => t.status === 'running').length },
    { key: 'support', label: 'Support', count: escalatedCount },
    { key: 'content', label: 'Content', count: draftContentCount },
    { key: 'mentions', label: 'Mentions', count: mentions.filter((m) => m.category === 'negative').length },
    { key: 'community', label: 'Community' },
    { key: 'brief', label: 'Growth Brief' },
    { key: 'recommendations', label: 'Recs', count: recommendations.length },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-gray-400">Welcome back, {userEmail}</p>
        </div>
        {creator && (
          <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-sm font-medium text-brand-400">
            {creator.plan.charAt(0).toUpperCase() + creator.plan.slice(1)} Plan
          </span>
        )}
      </div>

      {/* Upgrade success message */}
      {showUpgradeMessage && creator && (
        <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center">
          <p className="text-lg font-semibold text-green-400">
            Welcome to the {creator.plan.charAt(0).toUpperCase() + creator.plan.slice(1)} plan!
          </p>
          <p className="mt-1 text-sm text-green-300/70">
            All agents are now active. Your games are being optimized.
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-sm font-medium text-gray-400">Games</h2>
          <p className="mt-2 text-3xl font-bold">{stats.totalGames}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-sm font-medium text-gray-400">Agent Runs</h2>
          <p className="mt-2 text-3xl font-bold">{stats.totalRuns}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-sm font-medium text-gray-400">Total Robux Impact</h2>
          <p className={`mt-2 text-3xl font-bold ${stats.totalRobuxImpact >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.totalRobuxImpact >= 0 ? '+' : ''}
            {stats.totalRobuxImpact.toLocaleString()} R$
          </p>
        </div>
      </div>

      {/* Autopilot + Connect Roblox */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <ConnectRobloxButton
          isConnected={!!creator?.robloxUserId}
          robloxUserId={creator?.robloxUserId ?? null}
          robloxUsername={creator?.robloxUsername ?? null}
          robloxDisplayName={creator?.robloxDisplayName ?? null}
          hasApiKey={creator?.hasApiKey ?? false}
        />
        {creator && (
          <AutopilotToggle
            creatorId={creator.id}
            initialValue={creator.autopilot}
          />
        )}
      </div>

      {/* Tab navigation */}
      <div className="mt-8 flex gap-1 overflow-x-auto rounded-lg border border-gray-800 bg-gray-900/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="rounded-full bg-brand-500/20 px-1.5 py-0.5 text-xs text-brand-400">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <>
          {games.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-4 text-xl font-semibold">Game Health</h2>
              <div className="grid gap-6 md:grid-cols-2">
                {games.map((game) => (
                  <HealthScoreCard
                    key={game.id}
                    gameName={game.name}
                    score={game.healthScore}
                    robloxGameId={game.robloxGameId}
                  />
                ))}
              </div>
            </div>
          )}
          {games.length > 0 && (
            <div className="mt-8 space-y-6">
              {games.map((game) => (
                <DauChart
                  key={game.id}
                  gameName={game.name}
                  snapshots={game.snapshots}
                />
              ))}
            </div>
          )}
          <div className="mt-8">
            <AgentRunFeed runs={recentRuns} />
          </div>
        </>
      )}

      {activeTab === 'ask' && (
        <div className="mt-8">
          <InsightsChat hasGames={games.length > 0} />
        </div>
      )}

      {activeTab === 'pricing' && (
        <div className="mt-8 space-y-6">
          <PricingTestsTable tests={allPriceTests} />
        </div>
      )}

      {activeTab === 'support' && (
        <div className="mt-8 space-y-6">
          <SupportTicketsList tickets={allTickets} />
        </div>
      )}

      {activeTab === 'content' && (
        <div className="mt-8 space-y-6">
          <ContentQueue items={contentPieces} />
        </div>
      )}

      {activeTab === 'mentions' && (
        <div className="mt-8 space-y-6">
          <MentionsFeed mentions={mentions} />
        </div>
      )}

      {activeTab === 'community' && (
        <div className="mt-8 space-y-6">
          <CommunityOutreach
            lastPost={communityLastPost as any}
            postHistory={communityPostHistory}
          />
        </div>
      )}

      {activeTab === 'brief' && (
        <div className="mt-8">
          <GrowthBriefPreview
            brief={lastBrief?.data as any}
            sentAt={lastBrief?.sentAt ?? null}
          />
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div className="mt-8 space-y-6">
          <RecommendationsPanel recommendations={recommendations} />
        </div>
      )}
    </main>
  );
}
