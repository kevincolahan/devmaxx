# CLAUDE.md — Devmaxx

This file is read automatically by Claude Code at the start of every session.
Do not delete or rename this file.

---

## Product Overview

**Devmaxx** (devmaxx.app) is an AI-powered business operations platform for Roblox game creators.
Autonomous agents maximize DevEx earnings — pricing optimization, player support, competitor tracking,
content generation, and weekly growth briefs. Creators connect once and receive value indefinitely.

**Tagline:** Maxx your DevEx.
**Founder:** Kevin Colahan (kevin@devmaxx.app)
**Status:** Active build phase. Target beta: 10 Roblox creators within 60 days of MVP.

---

## Absolute Rules — Never Violate These

- **Always output full file contents.** Never truncate. Never use placeholder comments like `// ... rest of file`.
- **Never use PowerShell heredoc syntax.** Output complete files only.
- **Tailwind CSS pinned at 3.4.17.** Do not upgrade without explicit instruction.
- **Prisma pinned at 5.22.0.** Do not upgrade without explicit instruction.
- **All Railway API routes must include:** `export const dynamic = 'force-dynamic'`
- **AUTH_TRUST_HOST=true** must be set in Railway environment for NextAuth to work.
- **Never store secrets in code.** All API keys go in environment variables only.
- **Never use unicode bullet characters** in docx generation — use LevelFormat.BULLET.
- **All Anthropic API calls use model:** `claude-sonnet-4-20250514`
- **max_tokens:** 2048 for all Anthropic API calls.
- **Credentials provider conflicts with PrismaAdapter** — set adapter to undefined when using credentials.

---

## Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS v3 — pinned at 3.4.17
- **Deployment:** Vercel (auto-deploy on git push to main)
- **Domain:** devmaxx.app

### Backend / API
- **Runtime:** Node.js on Railway
- **All routes need:** `export const dynamic = 'force-dynamic'`
- **Deployment:** Railway (auto-deploy on git push to main)

### Database
- **Provider:** PostgreSQL on Railway
- **ORM:** Prisma v5 — pinned at 5.22.0
- **Client:** Import from `@/lib/db` — never instantiate directly in components

### Authentication
- **Library:** NextAuth v5
- **Method:** Magic link email via Resend
- **Critical env var:** `AUTH_TRUST_HOST=true` (required on Railway or auth breaks)
- **Adapter note:** PrismaAdapter conflicts with Credentials provider — set adapter to undefined if using credentials

### AI / Agents
- **Primary model:** Anthropic claude-sonnet-4-20250514
- **Max tokens:** 2048
- **SDK:** `@anthropic-ai/sdk`
- **All agents extend BaseAgent** from `packages/agent-core/src/base-agent.ts`
- **Every agent run must write to AgentRun table** with robuxImpact field populated

### Orchestration
- **Cron scheduler:** `apps/api/src/cron/scheduler.ts` — node-cron running inside Railway API service (interim while n8n deploys)
- **Timeout protection:** All agent runs wrapped in 30s timeout, all cron jobs in 5min max runtime, job lock guard prevents overlapping runs
- **Shared timeout utility:** `apps/api/src/lib/timeout.ts` — `withTimeout()`, `TimeoutError`, constants
- **Roblox API timeout:** All fetch calls in `apps/api/src/lib/roblox.ts` use 10s `AbortController` timeout
- **DB connection pool:** `connection_limit=5&connect_timeout=10` appended to DATABASE_URL in `apps/api/src/lib/db.ts`
- **Express request timeout:** Global 5min middleware returns 504
- **n8n workflows:** Stored as JSON exports in `/infra/n8n/` (not yet deployed)
- **Internal networking:** Use Railway service name as hostname between services

### Email
- **Provider:** Resend
- **Templates:** React Email components in `/emails/` directory
- **From address:** kevin@devmaxx.app

### Storage
- **Provider:** Cloudflare R2
- **Use for:** Game reports, generated content PDFs, export files
- **Presigned URLs expire in 3600s** — always regenerate on fetch, never cache

### Payments
- **Provider:** Stripe
- **Webhook handler:** `/api/webhooks/stripe`
- **Always verify webhook signature** before processing

### Social / Marketing
- **X/Twitter:** Direct posting via Twitter API v2 with OAuth 1.0a signing (`apps/api/src/lib/twitter.ts`)
- **LinkedIn:** Direct posting via LinkedIn API v2 UGC Posts (`apps/api/src/lib/linkedin.ts`)
- **TikTok:** Direct posting via TikTok Content Posting API (`apps/api/src/lib/tiktok.ts`)
- **Instagram:** Direct posting via Instagram Graph API with branded image (`apps/api/src/lib/instagram.ts`)
- **SocialPoster cron:** 10am UTC daily, max 1 post per platform per day, quiet hours 11pm-7am UTC
- **Scraping:** Apify
- **Blog:** Ghost CMS via Admin API

---

## Repo Structure

```
devmaxx/
├── apps/
│   ├── web/                    # Next.js 14 — Vercel
│   │   ├── app/                # App Router pages
│   │   │   ├── api/content/    # Content API routes (status, post-to-x, post-to-linkedin, post-to-tiktok, post-to-instagram)
│   │   │   ├── api/insights/   # Ask Devmaxx chat (SSE streaming)
│   │   │   └── dashboard/      # Dashboard with tabs (Overview, Ask Devmaxx, Pricing, Support, Content, Brief, Recs)
│   │   ├── components/         # React components
│   │   │   ├── content-queue.tsx    # Content tab with platform post buttons, filters, news source metadata
│   │   │   ├── insights-chat.tsx    # Streaming chat interface with Claude
│   │   │   ├── command-console.tsx  # Natural language game command UI (Copilot for Roblox)
│   │   │   ├── community-outreach.tsx    # Community outreach dashboard
│   │   │   ├── event-impact-timeline.tsx # Event impact visualization
│   │   │   ├── revenue-forecast-card.tsx # Revenue forecasting display
│   │   │   └── sentiment-analysis.tsx    # Player sentiment dashboard
│   │   ├── emails/             # React Email templates
│   │   └── public/             # Static assets
│   └── api/                    # Node.js API — Railway
│       ├── src/
│       │   ├── agents/         # Product agents
│       │   │   └── news-monitor.ts  # Roblox news → content pipeline (Apify scraping + Claude scoring)
│       │   ├── cron/           # Cron scheduler with timeout guards
│       │   ├── routes/         # API routes (all agent runs wrapped in 30s timeout)
│       │   ├── lib/            # Shared utilities
│       │   │   ├── twitter.ts       # X/Twitter API v2 posting (OAuth 1.0a)
│       │   │   ├── linkedin.ts      # LinkedIn API v2 UGC Posts
│       │   │   ├── tiktok.ts        # TikTok Content Posting API
│       │   │   ├── instagram.ts     # Instagram Graph API (image + caption)
│       │   │   ├── timeout.ts       # Shared withTimeout utility
│       │   │   └── roblox.ts        # Roblox Open Cloud API (10s fetch timeouts)
│       │   ├── routes/         # API routes
│       │   │   ├── actions.ts         # One-click action execution endpoint
│       │   │   ├── commands.ts        # Natural language game command endpoint
│       │   │   └── onboarding.ts      # Onboarding email trigger endpoint
│       │   ├── scripts/        # One-off scripts
│       │   │   ├── seed-content.ts      # Seed ContentPiece table
│       │   │   └── railway-restart.ts   # Emergency Railway service restart via GraphQL
│       │   └── marketing/      # Marketing agents
│       └── infra/
│           └── n8n/            # n8n workflow JSON exports
└── packages/
    ├── agent-core/             # Shared BaseAgent class
    │   └── src/
    │       └── base-agent.ts
    └── db/                     # Prisma schema + client
        ├── schema.prisma
        └── src/
            └── index.ts        # Export db client
```

---

## Database Schema (Prisma)

```prisma
model Creator {
  id           String   @id @default(cuid())
  email        String   @unique
  robloxUserId String?
  stripeId     String?
  plan         String   @default("free") // free|creator|pro|studio
  autopilot    Boolean  @default(false)
  timezone     String   @default("UTC")
  games        Game[]
  agentRuns    AgentRun[]
  createdAt    DateTime @default(now())
}

model Game {
  id           String   @id @default(cuid())
  creatorId    String
  robloxGameId String   @unique
  name         String
  genre        String[]
  healthScore  Int      @default(50)
  competitors  String[]
  creator      Creator  @relation(fields: [creatorId], references: [id])
  snapshots    MetricSnapshot[]
  priceTests   PriceTest[]
  tickets      SupportTicket[]
  content      ContentPiece[]
  bugs         BugTicket[]
}

model MetricSnapshot {
  id               String   @id @default(cuid())
  gameId           String
  date             DateTime
  dau              Int
  mau              Int
  concurrentPeak   Int
  avgSessionSec    Int
  retentionD1      Float
  retentionD7      Float
  retentionD30     Float
  robuxEarned      Int
  newPlayers       Int
  returningPlayers Int
  topItems         Json
  visitSources     Json
  game             Game     @relation(fields: [gameId], references: [id])
}

model PriceTest {
  id          String    @id @default(cuid())
  gameId      String
  itemId      String
  itemName    String
  priceA      Int
  priceB      Int
  exposuresA  Int       @default(0)
  exposuresB  Int       @default(0)
  revenueA    Int       @default(0)
  revenueB    Int       @default(0)
  status      String    @default("running") // running|complete|cancelled
  winner      String?   // A|B|inconclusive
  startedAt   DateTime  @default(now())
  completedAt DateTime?
  game        Game      @relation(fields: [gameId], references: [id])
}

model SupportTicket {
  id           String   @id @default(cuid())
  gameId       String
  playerId     String
  category     String   // bug|refund|how-to|feature|toxic|positive
  message      String
  response     String?
  status       String   @default("open") // open|resolved|escalated
  robuxValue   Int?
  autoResolved Boolean  @default(false)
  game         Game     @relation(fields: [gameId], references: [id])
  createdAt    DateTime @default(now())
}

model ContentPiece {
  id           String    @id @default(cuid())
  gameId       String?
  creatorId    String?
  type         String    // event_idea|item_desc|game_pass|social_post|email|ad_creative|news_response
  platform     String?   // x|linkedin|instagram|tiktok|youtube|blog|email
  content      String
  qualityScore Int?
  status       String    @default("draft") // draft|pending_review|approved|published|rejected
  performance  Json?
  sourceData   Json?
  publishedAt  DateTime?
  createdAt    DateTime  @default(now())
}

model AgentRun {
  id          String   @id @default(cuid())
  creatorId   String
  agentName   String
  gameId      String?
  input       Json
  output      Json
  action      String
  robuxImpact Int?     // ALWAYS populate — this is your value proof
  status      String   @default("success") // success|failed|escalated
  createdAt   DateTime @default(now())
  creator     Creator  @relation(fields: [creatorId], references: [id])
}

model CompetitorSnapshot {
  id             String   @id @default(cuid())
  watchingGameId String
  robloxGameId   String
  name           String
  concurrent     Int
  rating         Float
  updatedAt      DateTime @default(now())
}

model BugTicket {
  id          String   @id @default(cuid())
  gameId      String
  description String
  reportCount Int      @default(1)
  status      String   @default("open")
  game        Game     @relation(fields: [gameId], references: [id])
  createdAt   DateTime @default(now())
}
```

---

## BaseAgent Pattern

Every agent extends this class. Never deviate from this pattern.

```typescript
// packages/agent-core/src/base-agent.ts
import Anthropic from '@anthropic-ai/sdk';

export interface AgentContext {
  creatorId: string;
  gameId?: string;
  inputData: Record<string, unknown>;
  db: PrismaClient;
}

export interface AgentResult {
  action: string;
  output: Record<string, unknown>;
  robuxImpact?: number;
  status: 'success' | 'failed' | 'escalated';
}

export abstract class BaseAgent {
  protected client = new Anthropic();
  protected agentName: string;

  constructor(agentName: string) {
    this.agentName = agentName;
  }

  async run(context: AgentContext): Promise<AgentResult> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const userPrompt   = this.buildUserPrompt(context);

      const response = await this.client.messages.create({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userPrompt }]
      });

      const result = await this.parseResponse(response, context);
      await this.executeActions(result, context);
      await this.logRun(context, result);
      return result;

    } catch (error) {
      const failed: AgentResult = { action: 'error', output: { error: String(error) }, status: 'failed' };
      await this.logRun(context, failed);
      throw error;
    }
  }

  private async logRun(context: AgentContext, result: AgentResult) {
    await context.db.agentRun.create({
      data: {
        creatorId:   context.creatorId,
        agentName:   this.agentName,
        gameId:      context.gameId,
        input:       context.inputData,
        output:      result.output,
        action:      result.action,
        robuxImpact: result.robuxImpact ?? 0,
        status:      result.status,
      }
    });
  }

  abstract buildSystemPrompt(ctx: AgentContext): string;
  abstract buildUserPrompt(ctx: AgentContext): string;
  abstract parseResponse(r: Anthropic.Message, ctx: AgentContext): Promise<AgentResult>;
  abstract executeActions(r: AgentResult, ctx: AgentContext): Promise<void>;
}
```

---

## Agent Inventory

| Agent | File | Trigger | Priority |
|---|---|---|---|
| MetricsMonitorAgent | `agents/metrics-monitor.ts` | Daily cron 6am UTC | 1 |
| PricingOptimizationAgent | `agents/pricing-opt.ts` | Weekly Mon + manual | 1 |
| PlayerSupportAgent | `agents/player-support.ts` | Webhook on message | 1 |
| CompetitorIntelligenceAgent | `agents/competitor-intel.ts` | Daily cron 8am UTC | 1 |
| GrowthBriefAgent | `agents/growth-brief.ts` | Weekly Sun 6pm UTC | 1 |
| MonetizationAdvisorAgent | `agents/monetization.ts` | Monthly cron | 2 |
| RetentionEngineerAgent | `agents/retention.ts` | Triggered by metrics drop | 2 |
| ContentGenerationAgent | `agents/content-gen.ts` | Weekly Mon 7am UTC | 2 |
| RobloxNewsMonitorAgent | `agents/news-monitor.ts` | Weekly Mon 6am UTC | 2 |
| PlayerSentimentAgent | `agents/player-sentiment.ts` | Daily cron | 2 |
| EventImpactAnalyzer | `agents/event-impact.ts` | On game update detected | 2 |
| RevenueForecastingAgent | `agents/revenue-forecast.ts` | Weekly cron | 2 |
| OutcomeTrackingAgent | `agents/outcome-tracking.ts` | After agent actions | 2 |
| CommunityOutreachAgent | `agents/community-outreach.ts` | Weekly — Reddit + DevForum | 3 |
| CommandExecutorAgent | `agents/command-executor.ts` | On natural language command | 2 |

---

## Roblox Open Cloud API

```typescript
const ROBLOX_BASE = 'https://apis.roblox.com';

// Auth: OAuth 2.0
// Scopes needed:
//   universe.place:read
//   universe.analyticsservice:read
//   universe.datastoreservice:read
//   economy:read
//   economy:write  (price changes — requires creator approval)

// Key endpoints:
// Analytics: GET /cloud/v2/universes/{universeId}/analytics-service/v1/metrics
// Items:     GET /cloud/v2/universes/{universeId}/economy/developer-products
// Prices:    PATCH /cloud/v2/universes/{universeId}/economy/developer-products/{id}
// Game passes: GET /cloud/v2/universes/{universeId}/game-passes

// CRITICAL: Access tokens expire in 15 minutes
// Always refresh token before every API call
// Store: accessToken + refreshToken in Creator model
```

---

## Environment Variables

```bash
# Auth
AUTH_SECRET=
AUTH_TRUST_HOST=true            # REQUIRED on Railway

# Database
DATABASE_URL=                   # Railway Postgres connection string

# AI
ANTHROPIC_API_KEY=

# Roblox
ROBLOX_OAUTH_CLIENT_ID=
ROBLOX_OAUTH_CLIENT_SECRET=
ROBLOX_OPEN_CLOUD_API_KEY=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_FREE=
STRIPE_PRICE_CREATOR=
STRIPE_PRICE_PRO=
STRIPE_PRICE_STUDIO=

# Email
RESEND_API_KEY=
FROM_EMAIL=kevin@devmaxx.app

# Storage
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=

# Twitter / X (OAuth 1.0a for API v2)
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=

# LinkedIn
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_ORG_ID=

# TikTok
TIKTOK_ACCESS_TOKEN=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=

# Instagram
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_ACCOUNT_ID=
DEVMAXX_DEFAULT_IMAGE_URL=

# Marketing
APIFY_API_TOKEN=
GHOST_ADMIN_API_KEY=
GHOST_API_URL=

# n8n
N8N_BASIC_AUTH_USER=
N8N_BASIC_AUTH_PASSWORD=
N8N_WEBHOOK_URL=
```

---

## Pricing Tiers

| Tier | Price | Games | Key Feature |
|---|---|---|---|
| Free | $0/mo | 1 | Weekly GrowthBrief only, no action agents |
| Creator | $49/mo | 2 | All agents, manual approval mode |
| Pro | $99/mo | 5 | Autopilot mode, competitor tracking |
| Studio | $249/mo | Unlimited | White-label reports, 3 team seats |

---

## Agent Safety Rules

- **Never auto-change item prices** without checking `creator.autopilot === true` first
- **Refund auto-approve cap:** 500 Robux — escalate anything above
- **Price test duration:** 72 hours max OR 500 exposures per variant — never exceed
- **Always populate `robuxImpact`** on every AgentRun — this is the value proof that prevents churn
- **GrowthBrief timezone:** Always convert to creator's local timezone before sending
- **Never test items below 5 Robux** in price tests
- **Never drop price below 50% of creator's floor** in price tests

---

## Social Handles (for content agents)

- Instagram: @devmaxx.app
- TikTok: @devmaxxapp
- X/Twitter: @devmaxxapp
- YouTube: @devmaxxapp
- LinkedIn: Devmaxx (linkedin.com/company/devmax)

---

## Key Features Added (April 2026)

- **Natural Language Game Commands:** "Copilot for Roblox" — creators type commands in plain English, CommandExecutorAgent interprets and executes via Roblox APIs (`routes/commands.ts`, `command-console.tsx`)
- **One-Click Action System:** Agent recommendations include executable actions — one click to apply (`routes/actions.ts`)
- **Genre Benchmarking:** MetricsMonitorAgent now compares game metrics against genre averages
- **Player Sentiment Analysis:** PlayerSentimentAgent analyzes player feedback and surfaces insights
- **Event Impact Analysis:** EventImpactAnalyzer detects game updates and measures their impact on metrics
- **Revenue Forecasting:** RevenueForecastingAgent projects future Robux earnings based on trends
- **Outcome Tracking:** OutcomeTrackingAgent measures predicted vs actual impact of agent actions
- **Community Outreach:** CommunityOutreachAgent posts weekly to Reddit and Roblox DevForum
- **Welcome Onboarding Sequence:** 3-email drip campaign via Resend (`lib/onboarding-emails.ts`)
- **Content Seed Route:** POST `/api/content/generate-seed` for bulk content generation
- **Autopilot Toggle Fix:** Proper plan gating, error handling, and upgrade button
- **Stripe Checkout Fixes:** Handle missing customer, fallback to email, proper error handling

---

## Build Order (Phases)

1. **Phase 1 (Week 1):** Monorepo setup, Prisma schema, NextAuth magic link, Roblox OAuth, Stripe checkout, n8n on Railway, BaseAgent class
2. **Phase 2 (Week 2):** MetricsMonitorAgent, CompetitorIntelligenceAgent, RetentionEngineerAgent, creator dashboard v1
3. **Phase 3 (Week 3):** PricingOptimizationAgent (A/B framework + Open Cloud Economy API), MonetizationAdvisorAgent
4. **Phase 4 (Week 4):** PlayerSupportAgent, ContentGenerationAgent, GrowthBriefAgent, full dashboard
5. **Phase 5 (Week 5-6):** Marketing agents (Content, Social, SEO, Reddit, Email nurture)
6. **Phase 6 (Week 7):** Growth agents (Testimonial, Influencer outreach, Churn prediction, Ads)
7. **Phase 7 (Week 8-10):** Error handling, cost monitoring, onboarding flow, beta launch

---

## Starter Prompt for Every Claude Code Session

Paste this at the start of each session to prime context:

```
I am building Devmaxx (devmaxx.app) — an AI-powered SaaS for Roblox creators.
Stack: Next.js 14, Tailwind CSS v3 pinned 3.4.17, Prisma v5 pinned 5.22.0,
NextAuth v5, Railway (backend + Postgres), Vercel (frontend),
Anthropic claude-sonnet-4-20250514, Resend, Cloudflare R2, Stripe.
All agents extend BaseAgent from packages/agent-core/src/base-agent.ts.
Rules: Always output full file contents. Never truncate.
All Railway routes: export const dynamic = 'force-dynamic'
AUTH_TRUST_HOST=true on Railway.
Today I am building: [DESCRIBE WHAT YOU WANT TO BUILD TODAY]
```

---

*Last updated: April 2026*
*Devmaxx · devmaxx.app · Maxx your DevEx*
