'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { SidebarNav, type NavSection } from '@/components/sidebar-nav';
import { DashboardHeader } from '@/components/dashboard-header';
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
import { ProspectsTab } from '@/components/prospects-tab';
import { OnboardingFlow, OnboardingBanner } from '@/components/onboarding-flow';
import { PortfolioView } from '@/components/portfolio-view';

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
    onboardingStep: number;
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

/* ── Empty State ── */
function EmptyState({ icon, title, description, action }: {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#141428] text-2xl">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-gray-500">{description}</p>
      {action && (
        <a
          href={action.href}
          className="mt-4 inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ label, value, sub, color, isZero }: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  isZero?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E] p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${isZero ? 'text-gray-600' : color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-600">{sub}</div>}
    </div>
  );
}

/* ── Page Title ── */
function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold text-white sm:text-2xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
    </div>
  );
}

export function DashboardClient({ data, userEmail }: DashboardClientProps) {
  const { creator, games, recentRuns, recommendations, contentPieces, mentions, sentiment, events, forecast, communityLastPost, communityPostHistory, lastBrief, referral, stats } = data;
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  const counts = {
    pricingActive: allPriceTests.filter((t) => t.status === 'running').length,
    supportEscalated: escalatedCount,
    contentDraft: draftContentCount,
    mentionsNegative: mentions.filter((m) => m.category === 'negative').length,
    recommendations: recommendations.length,
    referralCredits: referral.referralCredits,
  };

  const isAdmin = userEmail === 'kevin@devmaxx.app';

  // Onboarding: show if step < 5 and not dismissed
  const shouldShowOnboarding = creator && (creator.onboardingStep ?? 0) < 5 && (
    !creator.robloxUserId || !creator.hasApiKey || games.length === 0 || recentRuns.length < 3
  );
  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding ?? false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  return (
    <div className="min-h-screen bg-[#080810]">
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

      {/* Onboarding modal */}
      {showOnboarding && creator && !onboardingDismissed && (
        <OnboardingFlow
          creatorId={creator.id}
          currentStep={creator.onboardingStep ?? 0}
          isRobloxConnected={!!creator.robloxUserId}
          robloxUsername={creator.robloxUsername}
          hasApiKey={creator.hasApiKey}
          hasGames={games.length > 0}
          onComplete={() => {
            setShowOnboarding(false);
            setOnboardingDismissed(true);
          }}
          onDismiss={() => {
            setShowOnboarding(false);
            setOnboardingDismissed(true);
          }}
        />
      )}

      {/* Sidebar */}
      <SidebarNav
        active={activeSection}
        onNavigate={setActiveSection}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        creator={creator ? {
          displayName: creator.robloxDisplayName,
          email: creator.email,
          xp: creator.xp,
          level: creator.level,
          levelTitle: creator.levelTitle,
          plan: creator.plan,
        } : null}
        counts={counts}
        isAdmin={isAdmin}
      />

      {/* Header */}
      <DashboardHeader
        gameName={games[0]?.name ?? null}
        plan={creator?.plan ?? 'free'}
        email={userEmail}
        sidebarCollapsed={sidebarCollapsed}
      />

      {/* Main content */}
      <main
        className={`min-h-screen pt-14 pb-20 transition-all duration-300 lg:pb-8 ${
          sidebarCollapsed ? 'lg:pl-[60px]' : 'lg:pl-[240px]'
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">

          {/* Upgrade success message */}
          {showUpgradeMessage && creator && (
            <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <p className="text-lg font-semibold text-emerald-400">
                Welcome to the {creator.plan.charAt(0).toUpperCase() + creator.plan.slice(1)} plan!
              </p>
              <p className="mt-1 text-sm text-emerald-300/70">
                All agents are now active. Your games are being optimized.
              </p>
            </div>
          )}

          {/* Onboarding banner (if incomplete and dismissed modal) */}
          {creator && !showOnboarding && onboardingDismissed && (creator.onboardingStep ?? 0) < 5 && (
            <OnboardingBanner
              step={creator.onboardingStep ?? 0}
              onResume={() => setShowOnboarding(true)}
            />
          )}

          {/* ═══════════════ OVERVIEW ═══════════════ */}
          {activeSection === 'overview' && (
            <>
              <PageTitle title="Command Center" description="Your game studio at a glance" />

              {/* Stat cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Game Health"
                  value={games[0] ? `${games[0].healthScore}/100` : '--'}
                  sub={games[0]?.name}
                  color="text-emerald-400"
                  isZero={!games[0]}
                />
                <StatCard
                  label="Agent Runs"
                  value={stats.totalRuns.toLocaleString()}
                  sub="all time"
                  color="text-indigo-400"
                  isZero={stats.totalRuns === 0}
                />
                <StatCard
                  label="Robux Impact"
                  value={`${(stats.totalRobuxImpact ?? 0).toLocaleString()} R$`}
                  sub="estimated value"
                  color="text-yellow-400"
                  isZero={(stats.totalRobuxImpact ?? 0) === 0}
                />
                <StatCard
                  label="Content Queue"
                  value={`${draftContentCount} drafts`}
                  sub="ready to publish"
                  color="text-pink-400"
                  isZero={draftContentCount === 0}
                />
              </div>

              {/* Connect Roblox + Autopilot row */}
              <div className="mt-6 grid gap-4 md:grid-cols-2">
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

              {/* Two column layout */}
              <div className="mt-6 grid gap-6 lg:grid-cols-5">
                {/* LEFT — 60% */}
                <div className="space-y-6 lg:col-span-3">
                  {games.length > 0 && games.map((game) => (
                    <DauChart
                      key={game.id}
                      gameName={game.name}
                      snapshots={game.snapshots}
                    />
                  ))}
                  <AgentRunFeed runs={recentRuns.slice(0, 5)} />
                  {creator?.plan !== 'free' ? (
                    <RevenueForecastCard forecast={forecast as any} />
                  ) : (
                    <UpgradePrompt
                      feature="Revenue Forecasting"
                      benefit="See your full revenue range with upside, downside, and seasonal projections."
                      requiredPlan="creator"
                      currentPlan={creator?.plan ?? 'free'}
                      variant="blur"
                    >
                      <RevenueForecastCard forecast={forecast as any} />
                    </UpgradePrompt>
                  )}
                </div>

                {/* RIGHT — 40% */}
                <div className="space-y-6 lg:col-span-2">
                  {games.length > 0 && games.map((game) => (
                    <HealthScoreCard
                      key={game.id}
                      gameName={game.name}
                      score={game.healthScore}
                      robloxGameId={game.robloxGameId}
                      latestSnapshot={game.snapshots[0] ?? null}
                      prevSnapshot={game.snapshots[1] ?? null}
                    />
                  ))}
                  {games.length === 0 && (
                    <EmptyState
                      icon="\uD83C\uDFAE"
                      title="No game connected"
                      description="Connect your Roblox game to unlock all agents and analytics."
                    />
                  )}
                  <EventImpactTimeline events={events} />
                </div>
              </div>
            </>
          )}

          {/* ═══════════════ COMMANDS ═══════════════ */}
          {activeSection === 'commands' && (
            <>
              <PageTitle title="Game Commands" description="Control your game with natural language" />
              {creator?.plan === 'free' && (
                <div className="mb-4">
                  <UpgradePrompt
                    feature="Game Commands"
                    benefit="Execute game commands automatically -- run sales, update prices, generate content with plain English."
                    requiredPlan="creator"
                    currentPlan={creator.plan}
                    variant="banner"
                  />
                </div>
              )}
              {creator && (
                <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E]">
                  <CommandConsole creatorId={creator.id} gameId={games[0]?.id} />
                </div>
              )}
            </>
          )}

          {/* ═══════════════ ASK DEVMAXX ═══════════════ */}
          {activeSection === 'ask' && (
            <>
              <PageTitle title="Ask Devmaxx" description="AI-powered insights about your game" />
              <div className="rounded-xl border border-[rgba(79,70,229,0.15)] bg-[#0F0F1E]">
                <InsightsChat hasGames={games.length > 0} />
              </div>
            </>
          )}

          {/* ═══════════════ GAME HEALTH ═══════════════ */}
          {activeSection === 'health' && (
            <>
              <PageTitle title="Game Health" description="Real-time health scores for your games" />
              {games.length > 0 ? (
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
              ) : (
                <EmptyState
                  icon="\uD83D\uDC9A"
                  title="No health data yet"
                  description="Connect your Roblox game to start tracking health scores."
                />
              )}
            </>
          )}

          {/* ═══════════════ METRICS & DAU ═══════════════ */}
          {activeSection === 'metrics' && (
            <>
              <PageTitle title="Metrics & DAU" description="Player engagement trends over time" />
              {games.length > 0 ? (
                <div className="space-y-6">
                  {games.map((game) => (
                    <DauChart
                      key={game.id}
                      gameName={game.name}
                      snapshots={game.snapshots}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="\uD83D\uDCCA"
                  title="No metrics yet"
                  description="Connect your game to see DAU, retention, and revenue charts."
                />
              )}
            </>
          )}

          {/* ═══════════════ REVENUE FORECAST ═══════════════ */}
          {activeSection === 'forecast' && (
            <>
              <PageTitle title="Revenue Forecast" description="Projected Robux earnings and DevEx" />
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
            </>
          )}

          {/* ═══════════════ COMPETITOR INTEL ═══════════════ */}
          {activeSection === 'competitors' && (
            <>
              <PageTitle title="Competitor Intel" description="Track rival games and market movements" />
              <EmptyState
                icon="\uD83D\uDD0D"
                title="Competitor tracking active"
                description="Your CompetitorIntelligenceAgent runs daily at 8am UTC. Data appears in your Growth Brief."
              />
            </>
          )}

          {/* ═══════════════ PORTFOLIO ═══════════════ */}
          {activeSection === 'portfolio' && (
            <>
              <PageTitle title="Portfolio" description="All your games at a glance" />
              <PortfolioView
                games={games.map((g) => ({
                  id: g.id,
                  name: g.name,
                  robloxGameId: g.robloxGameId,
                  healthScore: g.healthScore,
                  snapshots: g.snapshots.map((s) => ({
                    date: s.date,
                    dau: s.dau,
                    robuxEarned: s.robuxEarned,
                    retentionD7: s.retentionD7,
                    concurrentPeak: s.concurrentPeak,
                  })),
                  agentRunCount: recentRuns.filter((r) => r.agentName !== 'system').length,
                }))}
                plan={creator?.plan ?? 'free'}
                totalRobuxImpact={stats.totalRobuxImpact}
              />
            </>
          )}

          {/* ═══════════════ AGENT LOG ═══════════════ */}
          {activeSection === 'agent-log' && (
            <>
              <PageTitle title="Agent Quest Log" description="History of all agent actions" />
              {recentRuns.length > 0 ? (
                <AgentRunFeed runs={recentRuns} />
              ) : (
                <EmptyState
                  icon="\uD83E\uDD16"
                  title="No agent runs yet"
                  description="Connect your game to start running AI agents automatically."
                />
              )}
            </>
          )}

          {/* ═══════════════ PRICING ═══════════════ */}
          {activeSection === 'pricing' && (
            <>
              <PageTitle title="Pricing Optimization" description="A/B test item prices for maximum revenue" />
              {creator?.plan === 'free' ? (
                <UpgradePrompt
                  feature="Pricing Optimization"
                  benefit="Your pricing agent found opportunities -- upgrade to see and execute them automatically."
                  requiredPlan="creator"
                  currentPlan={creator.plan}
                  variant="blur"
                >
                  <PricingTestsTable tests={allPriceTests} creatorId={creator?.id} gameId={games[0]?.id} />
                </UpgradePrompt>
              ) : (
                <PricingTestsTable tests={allPriceTests} creatorId={creator?.id} gameId={games[0]?.id} />
              )}
            </>
          )}

          {/* ═══════════════ SUPPORT ═══════════════ */}
          {activeSection === 'support' && (
            <>
              <PageTitle title="Player Support" description="Tickets and automated responses" />
              <SupportTicketsList tickets={allTickets} />
            </>
          )}

          {/* ═══════════════ SENTIMENT ═══════════════ */}
          {activeSection === 'sentiment' && (
            <>
              <PageTitle title="Player Sentiment" description="What players are saying about your game" />
              <SentimentAnalysis sentiment={sentiment as any} />
            </>
          )}

          {/* ═══════════════ CONTENT QUEUE ═══════════════ */}
          {activeSection === 'content' && (
            <>
              <PageTitle title="Content Queue" description="Social posts, announcements, and marketing content" />
              <ContentQueue items={contentPieces} />
            </>
          )}

          {/* ═══════════════ MENTIONS ═══════════════ */}
          {activeSection === 'mentions' && (
            <>
              <PageTitle title="Mentions & Outreach" description="Social media mentions and engagement" />
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
                <h2 className="mb-4 text-lg font-semibold text-white">X Outreach</h2>
                <XOutreachFeed />
              </div>
            </>
          )}

          {/* ═══════════════ COMMUNITY ═══════════════ */}
          {activeSection === 'community' && (
            <>
              <PageTitle title="Community" description="Reddit, DevForum, and YouTube outreach" />
              <CommunityOutreach
                lastPost={communityLastPost as any}
                postHistory={communityPostHistory}
              />
              <div className="mt-8">
                <h2 className="mb-4 text-lg font-semibold text-white">YouTube Outreach</h2>
                <YouTubeOutreachFeed />
              </div>
            </>
          )}

          {/* ═══════════════ REFERRALS ═══════════════ */}
          {activeSection === 'referrals' && (
            <>
              <PageTitle title="Referrals" description="Earn credits by inviting other creators" />
              <ReferralPanel
                referralCode={referral.referralCode}
                referralCredits={referral.referralCredits}
                referrals={referral.referrals}
              />
            </>
          )}

          {/* ═══════════════ GROWTH BRIEF ═══════════════ */}
          {activeSection === 'brief' && (
            <>
              <PageTitle title="Growth Brief" description="Your weekly business intelligence report" />
              {creator?.plan === 'free' ? (
                <UpgradePrompt
                  feature="Full Growth Brief"
                  benefit="Read your complete weekly business brief with actionable recommendations."
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
            </>
          )}

          {/* ═══════════════ RECOMMENDATIONS ═══════════════ */}
          {activeSection === 'recommendations' && (
            <>
              <PageTitle title="Recommendations" description="AI-generated actions to grow your game" />
              {creator?.plan === 'free' && (
                <div className="mb-4">
                  <UpgradePrompt
                    feature="One-Click Actions"
                    benefit="Execute agent recommendations with a single click."
                    requiredPlan="creator"
                    currentPlan={creator.plan}
                    variant="inline"
                    urgency="Creators using one-click actions save 5+ hours per week."
                  />
                </div>
              )}
              <RecommendationsPanel recommendations={recommendations} creatorId={creator?.id ?? ''} gameId={games[0]?.id} />
            </>
          )}

          {/* ═══════════════ EVENTS ═══════════════ */}
          {activeSection === 'events' && (
            <>
              <PageTitle title="Event Impact" description="How game updates affect your metrics" />
              <EventImpactTimeline events={events} />
            </>
          )}

          {/* ═══════════════ SETTINGS / ACCOUNT ═══════════════ */}
          {activeSection === 'account' && (
            <>
              <PageTitle title="Settings" description="Account and billing management" />
              <div className="space-y-6">
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
                <div className="grid gap-4 md:grid-cols-2">
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
              </div>
            </>
          )}

          {/* ═══════════════ PROSPECTS (admin) ═══════════════ */}
          {activeSection === 'prospects' && isAdmin && (
            <>
              <PageTitle title="Prospects" description="Creator prospecting pipeline (admin only)" />
              <ProspectsTab />
            </>
          )}

        </div>
      </main>
    </div>
  );
}
