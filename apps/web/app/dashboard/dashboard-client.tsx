'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreatorHud } from '@/components/creator-hud';
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
import { XOutreachFeed } from '@/components/x-outreach-feed';
import { CommunityOutreach } from '@/components/community-outreach';
import { YouTubeOutreachFeed } from '@/components/youtube-outreach-feed';
import { CommandConsole } from '@/components/command-console';
import { RevenueForecastCard } from '@/components/revenue-forecast-card';
import { EventImpactTimeline } from '@/components/event-impact-timeline';
import { SentimentAnalysis } from '@/components/sentiment-analysis';
import { ReferralPanel } from '@/components/referral-panel';
import { UpgradePrompt } from '@/components/upgrade-prompt';
import { MilestoneToast } from '@/components/milestone-toast';

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
    xp: number;
    level: number;
    levelTitle: string;
  } | null;
  games: Game[];
  recentRuns: AgentRun[];
  recommendations: Recommendation[];
  contentPieces: ContentItem[];
  mentions: MentionItem[];
  sentiment: {
    overallScore: number;
    weekOverWeekChange: string;
    claudeSummary: string | null;
    topBugs: unknown[];
    topRequests: unknown[];
    topPraise: unknown[];
    topFrustrations: unknown[];
    ticketsAnalyzed: number;
    analyzedAt: string;
  } | null;
  events: Array<{
    id: string;
    eventType: string;
    eventName: string;
    startedAt: string;
    measuredAt: string | null;
    dauBefore: number;
    dauAfter: number;
    dauChangePercent: number;
    revenueBefore: number;
    revenueAfter: number;
    verdict: string;
    claudeSummary: string | null;
    measured: boolean;
  }>;
  forecast: {
    next30DaysRobux: number;
    next90DaysRobux: number;
    projectedDevExUSD: number;
    upsideRobux: number;
    downsideRobux: number;
    assumptions: Record<string, unknown>;
    seasonalFactors: Record<string, unknown>;
    forecastDate: string;
  } | null;
  communityLastPost: Record<string, unknown> | null;
  communityPostHistory: string[];
  lastBrief: {
    data: Record<string, unknown>;
    sentAt: string;
  } | null;
  referral: {
    referralCode: string;
    referralCredits: number;
    referrals: Array<{
      id: string;
      referredEmail: string;
      status: string;
      convertedAt: string | null;
      creditedAt: string | null;
      createdAt: string;
    }>;
  };
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

type Tab = 'overview' | 'commands' | 'pricing' | 'support' | 'content' | 'mentions' | 'community' | 'brief' | 'recommendations' | 'referrals' | 'ask';

export function DashboardClient({ data, userEmail }: DashboardClientProps) {
  const { creator, games, recentRuns, recommendations, contentPieces, mentions, sentiment, events, forecast, communityLastPost, communityPostHistory, lastBrief, referral, stats } = data;
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const searchParams = useSearchParams();
  const [showUpgradeMessage, setShowUpgradeMessage] = useState(false);
  const [milestone, setMilestone] = useState<{
    milestone: string;
    description: string;
    xp: number;
    levelUp?: { from: number; to: number } | null;
  } | null>(null);

  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      setShowUpgradeMessage(true);
      const plan = creator?.plan ?? 'creator';
      const xp = plan === 'pro' ? 2000 : 1000;
      setMilestone({
        milestone: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan Activated!`,
        description: 'All agents are now running on your games.',
        xp,
      });
      const timer = setTimeout(() => setShowUpgradeMessage(false), 8000);
      return () => clearTimeout(timer);
    }
    if (searchParams.get('roblox') === 'connected') {
      setMilestone({
        milestone: 'First Game Connected!',
        description: 'Your agents can now access your game data.',
        xp: 500,
      });
    }
  }, [searchParams, creator?.plan]);

  const allPriceTests = games.flatMap((g) => g.priceTests);
  const allTickets = games.flatMap((g) => g.tickets);
  const escalatedCount = allTickets.filter((t) => t.status === 'escalated').length;
  const draftContentCount = contentPieces.filter((c) => c.status === 'draft').length;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'commands', label: 'Commands' },
    { key: 'ask', label: 'Ask Devmaxx' },
    { key: 'pricing', label: 'Pricing', count: allPriceTests.filter((t) => t.status === 'running').length },
    { key: 'support', label: 'Support', count: escalatedCount },
    { key: 'content', label: 'Content', count: draftContentCount },
    { key: 'mentions', label: 'Mentions', count: mentions.filter((m) => m.category === 'negative').length },
    { key: 'community', label: 'Community' },
    { key: 'brief', label: 'Growth Brief' },
    { key: 'recommendations', label: 'Recs', count: recommendations.length },
    { key: 'referrals', label: 'Referrals', count: referral.referralCredits },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      {/* Milestone toast */}
      {milestone && (
        <MilestoneToast
          milestone={milestone.milestone}
          description={milestone.description}
          xp={milestone.xp}
          levelUp={milestone.levelUp}
          onDismiss={() => setMilestone(null)}
        />
      )}

      {/* Creator HUD — replaces old header + stats row */}
      {creator && (
        <CreatorHud
          displayName={creator.robloxDisplayName}
          email={creator.email}
          xp={creator.xp}
          level={creator.level}
          levelTitle={creator.levelTitle}
          plan={creator.plan}
          totalGames={stats.totalGames}
          totalRuns={stats.totalRuns}
          totalRobuxImpact={stats.totalRobuxImpact}
        />
      )}

      {/* Upgrade success message */}
      {showUpgradeMessage && creator && (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
          <p className="text-lg font-semibold text-emerald-400">
            Welcome to the {creator.plan.charAt(0).toUpperCase() + creator.plan.slice(1)} plan!
          </p>
          <p className="mt-1 text-sm text-emerald-300/70">
            All agents are now active. Your games are being optimized.
          </p>
        </div>
      )}

      {/* Autopilot + Connect Roblox */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
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
            plan={creator.plan}
          />
        )}
      </div>

      {/* Tab navigation */}
      <div className="mt-6 flex gap-1 overflow-x-auto rounded-lg border border-gray-800 bg-gray-900/50 p-1">
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
                    latestSnapshot={game.snapshots[0] ?? null}
                    prevSnapshot={game.snapshots[1] ?? null}
                  />
                ))}
              </div>
            </div>
          )}
          {/* Revenue Forecast + Event Impact */}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {creator?.plan === 'free' ? (
              <UpgradePrompt
                feature="Revenue Forecasting"
                benefit="See your full revenue range with upside, downside, and seasonal projections."
                requiredPlan="creator"
                currentPlan={creator.plan}
                variant="blur"
              >
                <RevenueForecastCard forecast={forecast as any} />
              </UpgradePrompt>
            ) : (
              <RevenueForecastCard forecast={forecast as any} />
            )}
            <EventImpactTimeline events={events} />
          </div>

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
          <div className="mt-6 text-center">
            <a
              href="/devex-calculator"
              className="text-sm text-gray-500 transition hover:text-indigo-400"
            >
              See full DevEx projection &rarr;
            </a>
          </div>
        </>
      )}

      {activeTab === 'commands' && creator && (
        <div className="mt-8">
          {creator.plan === 'free' && (
            <div className="mb-4">
              <UpgradePrompt
                feature="Game Commands"
                benefit="Execute game commands automatically — run sales, update prices, generate content with plain English."
                requiredPlan="creator"
                currentPlan={creator.plan}
                variant="banner"
              />
            </div>
          )}
          <CommandConsole creatorId={creator.id} gameId={games[0]?.id} />
        </div>
      )}

      {activeTab === 'ask' && (
        <div className="mt-8">
          <InsightsChat hasGames={games.length > 0} />
        </div>
      )}

      {activeTab === 'pricing' && (
        <div className="mt-8 space-y-6">
          {creator?.plan === 'free' ? (
            <UpgradePrompt
              feature="Pricing Optimization"
              benefit="Your pricing agent found opportunities — upgrade to see and execute them automatically."
              requiredPlan="creator"
              currentPlan={creator.plan}
              variant="blur"
            >
              <PricingTestsTable tests={allPriceTests} creatorId={creator?.id} gameId={games[0]?.id} />
            </UpgradePrompt>
          ) : (
            <PricingTestsTable tests={allPriceTests} creatorId={creator?.id} gameId={games[0]?.id} />
          )}
        </div>
      )}

      {activeTab === 'support' && (
        <div className="mt-8 space-y-6">
          <SentimentAnalysis sentiment={sentiment as any} />
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
          {creator?.plan === 'free' ? (
            <UpgradePrompt
              feature="AI Mention Responses"
              benefit="Auto-respond to mentions with AI-drafted replies. Never miss an opportunity to engage."
              requiredPlan="creator"
              currentPlan={creator.plan}
              variant="blur"
            >
              <MentionsFeed mentions={mentions} />
            </UpgradePrompt>
          ) : (
            <MentionsFeed mentions={mentions} />
          )}
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-white">Outreach</h2>
            <XOutreachFeed />
          </div>
        </div>
      )}

      {activeTab === 'community' && (
        <div className="mt-8 space-y-6">
          <CommunityOutreach
            lastPost={communityLastPost as any}
            postHistory={communityPostHistory}
          />
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-white">YouTube</h2>
            <YouTubeOutreachFeed />
          </div>
        </div>
      )}

      {activeTab === 'brief' && (
        <div className="mt-8">
          {creator?.plan === 'free' ? (
            <UpgradePrompt
              feature="Full Growth Brief"
              benefit="Read your complete weekly business brief with actionable recommendations, revenue analysis, and growth opportunities."
              requiredPlan="creator"
              currentPlan={creator.plan}
              variant="blur"
              urgency="Your competitors are reading theirs every Sunday."
            >
              <GrowthBriefPreview
                brief={lastBrief?.data as any}
                sentAt={lastBrief?.sentAt ?? null}
                creatorId={creator?.id}
                gameId={games[0]?.id}
              />
            </UpgradePrompt>
          ) : (
            <GrowthBriefPreview
              brief={lastBrief?.data as any}
              sentAt={lastBrief?.sentAt ?? null}
              creatorId={creator?.id}
              gameId={games[0]?.id}
            />
          )}
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div className="mt-8 space-y-6">
          {creator?.plan === 'free' && (
            <UpgradePrompt
              feature="One-Click Actions"
              benefit="Execute agent recommendations with a single click. Pricing changes, content updates, and more — all automated."
              requiredPlan="creator"
              currentPlan={creator.plan}
              variant="inline"
              urgency="Creators using one-click actions save 5+ hours per week."
            />
          )}
          <RecommendationsPanel recommendations={recommendations} creatorId={creator?.id ?? ''} gameId={games[0]?.id} />
        </div>
      )}

      {activeTab === 'referrals' && (
        <div className="mt-8 space-y-6">
          <ReferralPanel
            referralCode={referral.referralCode}
            referralCredits={referral.referralCredits}
            referrals={referral.referrals}
          />
        </div>
      )}
    </main>
  );
}
