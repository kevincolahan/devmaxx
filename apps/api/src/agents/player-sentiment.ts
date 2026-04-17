import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

// ─── Player Sentiment Agent ─────────────────────────────────
// Analyzes support tickets and bug reports to surface
// actionable insights about player satisfaction.

interface SentimentItem {
  issue: string;
  count: number;
  urgency: number;
  trend: 'rising' | 'stable' | 'declining';
}

interface SentimentOutput {
  topBugs: SentimentItem[];
  topRequests: SentimentItem[];
  topPraise: SentimentItem[];
  topFrustrations: SentimentItem[];
  overallScore: number;
  weekOverWeekChange: 'positive' | 'negative' | 'neutral';
  summary: string;
}

export async function runPlayerSentimentPipeline(
  creatorId: string,
  gameId: string,
  db: PrismaClient
): Promise<SentimentOutput> {
  const game = await db.game.findUniqueOrThrow({ where: { id: gameId } });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Gather this week's tickets
  const thisWeekTickets = await db.supportTicket.findMany({
    where: { gameId, createdAt: { gte: sevenDaysAgo } },
    select: { category: true, message: true, status: true },
  });

  // Gather last week's tickets for comparison
  const lastWeekTickets = await db.supportTicket.findMany({
    where: { gameId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    select: { category: true, message: true },
  });

  // Gather bug reports
  const recentBugs = await db.bugTicket.findMany({
    where: { gameId, createdAt: { gte: sevenDaysAgo } },
    select: { description: true, reportCount: true, status: true },
  });

  // Get previous sentiment for comparison
  const previousSentiment = await db.playerSentiment.findFirst({
    where: { gameId },
    orderBy: { analyzedAt: 'desc' },
  });

  if (thisWeekTickets.length === 0 && recentBugs.length === 0) {
    const result: SentimentOutput = {
      topBugs: [],
      topRequests: [],
      topPraise: [],
      topFrustrations: [],
      overallScore: previousSentiment?.overallScore ?? 7,
      weekOverWeekChange: 'neutral',
      summary: 'No new feedback this week.',
    };

    await db.playerSentiment.create({
      data: {
        gameId,
        topBugs: [],
        topRequests: [],
        topPraise: [],
        topFrustrations: [],
        overallScore: result.overallScore,
        weekOverWeekChange: 'neutral',
        claudeSummary: result.summary,
        ticketsAnalyzed: 0,
      },
    });

    return result;
  }

  // Build feedback summary for Claude
  const ticketSummary = thisWeekTickets
    .map((t, i) => `[${i + 1}] Category: ${t.category} | Status: ${t.status} | "${t.message}"`)
    .join('\n');

  const bugSummary = recentBugs
    .map((b, i) => `[${i + 1}] Reports: ${b.reportCount} | Status: ${b.status} | "${b.description}"`)
    .join('\n');

  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a player feedback analyst for Roblox games. Analyze support tickets and bug reports to identify patterns and actionable insights.

Categorize all feedback into:
- BUGS: specific technical issues
- FEATURE_REQUESTS: what players want added
- PRAISE: what players love (from "positive" category tickets)
- FRUSTRATIONS: pain points causing churn

For each category, identify the top 3 items with:
- issue: brief description
- count: how many tickets mention this (estimate from the data)
- urgency: 1-10 (10 = game-breaking, 1 = minor)
- trend: "rising" if more reports than typical, "stable", or "declining"

Overall sentiment score: 1-10 (10 = players are ecstatic, 1 = mass exodus)
Week-over-week: "positive" if improving, "negative" if declining, "neutral" if stable

Write a 2-3 sentence executive summary.

Respond ONLY with valid JSON:
{
  "topBugs": [{"issue": "Lag in level 3", "count": 12, "urgency": 9, "trend": "rising"}],
  "topRequests": [{"issue": "New character skins", "count": 8, "urgency": 5, "trend": "stable"}],
  "topPraise": [{"issue": "Boss fight mechanics", "count": 6, "urgency": 0, "trend": "stable"}],
  "topFrustrations": [{"issue": "Pay-to-win perception", "count": 4, "urgency": 7, "trend": "rising"}],
  "overallScore": 6,
  "weekOverWeekChange": "negative",
  "summary": "Player sentiment declined this week..."
}`,
    messages: [{
      role: 'user',
      content: `Analyze player feedback for "${game.name}" (genre: ${game.genre.join(', ')}).

THIS WEEK'S SUPPORT TICKETS (${thisWeekTickets.length} total):
${ticketSummary || 'No tickets this week'}

THIS WEEK'S BUG REPORTS (${recentBugs.length} total):
${bugSummary || 'No bug reports this week'}

LAST WEEK'S TICKET COUNT: ${lastWeekTickets.length}
LAST WEEK'S CATEGORY BREAKDOWN: ${JSON.stringify(
  lastWeekTickets.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>)
)}

PREVIOUS SENTIMENT SCORE: ${previousSentiment?.overallScore ?? 'N/A'}

Analyze patterns, identify the top issues in each category, and provide an overall sentiment score.`,
    }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in sentiment response');

  const output = JSON.parse(jsonMatch[0]) as SentimentOutput;

  // Store in DB
  await db.playerSentiment.create({
    data: {
      gameId,
      topBugs: output.topBugs as any,
      topRequests: output.topRequests as any,
      topPraise: output.topPraise as any,
      topFrustrations: output.topFrustrations as any,
      overallScore: Math.max(1, Math.min(10, output.overallScore)),
      weekOverWeekChange: output.weekOverWeekChange,
      claudeSummary: output.summary,
      ticketsAnalyzed: thisWeekTickets.length + recentBugs.length,
    },
  });

  // Log as AgentRun
  await db.agentRun.create({
    data: {
      creatorId,
      agentName: 'PlayerSentimentAgent',
      gameId,
      input: { ticketCount: thisWeekTickets.length, bugCount: recentBugs.length } as any,
      output: output as any,
      action: 'sentiment_analyzed',
      robuxImpact: 0,
      status: 'success',
    },
  });

  console.log(`[PlayerSentiment] ${game.name}: score=${output.overallScore}/10 (${output.weekOverWeekChange}), tickets=${thisWeekTickets.length}`);

  return output;
}
