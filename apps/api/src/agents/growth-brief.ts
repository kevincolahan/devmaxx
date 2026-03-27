import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentContext, AgentResult } from '../lib/base-agent';
import { Resend } from 'resend';

interface BriefSection {
  revenue: {
    thisWeek: number;
    lastWeek: number;
    fourWeekAvg: number;
    changePercent: number;
  };
  playerHealth: {
    dauTrend: string;
    dauThisWeek: number;
    dauLastWeek: number;
    d7Retention: number;
    d7RetentionChange: number;
  };
  topThree: Array<{
    title: string;
    description: string;
    impact: 'positive' | 'negative' | 'neutral';
  }>;
  nextActions: Array<{
    action: string;
    estimatedImpact: string;
    effortLevel: 'low' | 'medium' | 'high';
  }>;
  agentActivity: {
    totalRuns: number;
    totalRobuxImpact: number;
    topAgent: string;
    ticketsResolved: number;
    ticketsEscalated: number;
    contentGenerated: number;
  };
}

export class GrowthBriefAgent extends BaseAgent {
  constructor() {
    super('GrowthBriefAgent');
  }

  buildSystemPrompt(_ctx: AgentContext): string {
    return `You are a growth analyst writing a weekly brief for a Roblox game creator. The brief should be readable in 90 seconds.

Write in a direct, data-driven tone. Lead with numbers. Bold the most important stats.

You will receive this week's data vs last week. Generate a structured brief with:

1. **Revenue Summary**: Robux earned this week vs last week vs 4-week average. Highlight the trend.
2. **Player Health**: DAU trend (up/down/flat), D7 retention cohort analysis.
3. **Top 3 This Week**: The 3 most important things that happened (good or bad). Each needs a title and one-sentence description.
4. **Next 3 Actions**: 3 specific actions the creator should take, with estimated impact (high/medium/low) and effort (low/medium/high).
5. **Agent Activity**: Summary of what the AI agents did this week.

Respond ONLY with valid JSON:
{
  "revenue": {
    "thisWeek": 15000,
    "lastWeek": 12000,
    "fourWeekAvg": 13500,
    "changePercent": 25.0
  },
  "playerHealth": {
    "dauTrend": "up",
    "dauThisWeek": 5200,
    "dauLastWeek": 4800,
    "d7Retention": 0.32,
    "d7RetentionChange": 0.04
  },
  "topThree": [
    { "title": "Title", "description": "Description", "impact": "positive" }
  ],
  "nextActions": [
    { "action": "Do this", "estimatedImpact": "high", "effortLevel": "low" }
  ],
  "agentActivity": {
    "totalRuns": 42,
    "totalRobuxImpact": 8500,
    "topAgent": "PricingOptimizationAgent",
    "ticketsResolved": 15,
    "ticketsEscalated": 2,
    "contentGenerated": 6
  }
}`;
  }

  buildUserPrompt(ctx: AgentContext): string {
    const input = ctx.inputData as Record<string, unknown>;

    let prompt = `Generate the weekly Growth Brief for "${input.gameName}".\n\n`;
    prompt += `CREATOR TIMEZONE: ${input.timezone}\n\n`;

    prompt += `THIS WEEK METRICS:\n${JSON.stringify(input.thisWeekMetrics, null, 2)}\n\n`;
    prompt += `LAST WEEK METRICS:\n${JSON.stringify(input.lastWeekMetrics, null, 2)}\n\n`;
    prompt += `4-WEEK AVERAGE:\n${JSON.stringify(input.fourWeekAvg, null, 2)}\n\n`;

    prompt += `AGENT RUNS THIS WEEK:\n${JSON.stringify(input.agentRuns, null, 2)}\n\n`;
    prompt += `PRICE TEST RESULTS:\n${JSON.stringify(input.priceTests, null, 2)}\n\n`;
    prompt += `SUPPORT TICKETS:\n${JSON.stringify(input.supportStats, null, 2)}\n\n`;
    prompt += `COMPETITOR CHANGES:\n${JSON.stringify(input.competitorChanges, null, 2)}\n\n`;
    prompt += `CONTENT PUBLISHED:\n${JSON.stringify(input.contentStats, null, 2)}\n`;

    return prompt;
  }

  async parseResponse(r: Anthropic.Message, _ctx: AgentContext): Promise<AgentResult> {
    const text = r.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let brief: BriefSection;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      brief = JSON.parse(jsonMatch[0]) as BriefSection;
    } catch {
      return {
        action: 'brief_failed',
        output: { error: 'Failed to parse brief', rawResponse: text },
        status: 'failed',
      };
    }

    return {
      action: 'brief_generated',
      output: brief as unknown as Record<string, unknown>,
      robuxImpact: brief.revenue.thisWeek - brief.revenue.lastWeek,
      status: 'success',
    };
  }

  async executeActions(_result: AgentResult, _ctx: AgentContext): Promise<void> {
    // Email sending happens in runFullPipeline
  }

  async runFullPipeline(
    creatorId: string,
    gameId: string,
    db: import('@prisma/client').PrismaClient
  ): Promise<AgentResult> {
    const game = await db.game.findUniqueOrThrow({ where: { id: gameId } });
    const creator = await db.creator.findUniqueOrThrow({ where: { id: creatorId } });

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    const thisWeekSnapshots = await db.metricSnapshot.findMany({
      where: { gameId, date: { gte: oneWeekAgo } },
      orderBy: { date: 'desc' },
    });

    const lastWeekSnapshots = await db.metricSnapshot.findMany({
      where: { gameId, date: { gte: twoWeeksAgo, lt: oneWeekAgo } },
    });

    const fourWeekSnapshots = await db.metricSnapshot.findMany({
      where: { gameId, date: { gte: fourWeeksAgo } },
    });

    const agentRuns = await db.agentRun.findMany({
      where: { creatorId, createdAt: { gte: oneWeekAgo } },
      select: { agentName: true, action: true, robuxImpact: true, status: true },
    });

    const priceTests = await db.priceTest.findMany({
      where: { gameId, completedAt: { gte: oneWeekAgo } },
      select: { itemName: true, winner: true, priceA: true, priceB: true },
    });

    const resolvedTickets = await db.supportTicket.count({
      where: { gameId, status: 'resolved', createdAt: { gte: oneWeekAgo } },
    });
    const escalatedTickets = await db.supportTicket.count({
      where: { gameId, status: 'escalated', createdAt: { gte: oneWeekAgo } },
    });

    const contentCount = await db.contentPiece.count({
      where: { gameId, status: 'published', publishedAt: { gte: oneWeekAgo } },
    });

    const competitorChanges = await db.competitorSnapshot.findMany({
      where: { watchingGameId: gameId, updatedAt: { gte: oneWeekAgo } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    function avgMetrics(snapshots: typeof thisWeekSnapshots) {
      if (snapshots.length === 0) return null;
      const len = snapshots.length;
      return {
        dau: Math.round(snapshots.reduce((s, m) => s + m.dau, 0) / len),
        robuxEarned: snapshots.reduce((s, m) => s + m.robuxEarned, 0),
        retentionD7: parseFloat((snapshots.reduce((s, m) => s + m.retentionD7, 0) / len).toFixed(4)),
        concurrentPeak: Math.max(...snapshots.map((m) => m.concurrentPeak)),
        newPlayers: snapshots.reduce((s, m) => s + m.newPlayers, 0),
      };
    }

    const context: AgentContext = {
      creatorId,
      gameId,
      inputData: {
        gameName: game.name,
        timezone: creator.timezone,
        thisWeekMetrics: avgMetrics(thisWeekSnapshots),
        lastWeekMetrics: avgMetrics(lastWeekSnapshots),
        fourWeekAvg: avgMetrics(fourWeekSnapshots),
        agentRuns: {
          total: agentRuns.length,
          totalImpact: agentRuns.reduce((s, r) => s + (r.robuxImpact ?? 0), 0),
          byAgent: agentRuns.reduce((acc, r) => {
            acc[r.agentName] = (acc[r.agentName] ?? 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
        priceTests,
        supportStats: { resolved: resolvedTickets, escalated: escalatedTickets },
        competitorChanges: competitorChanges.map((c) => ({
          name: c.name,
          concurrent: c.concurrent,
          rating: c.rating,
        })),
        contentStats: { published: contentCount },
      },
      db,
    };

    const result = await this.run(context);

    if (result.action === 'brief_generated') {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const brief = result.output as unknown as BriefSection;

        await resend.emails.send({
          from: process.env.FROM_EMAIL ?? 'onboarding@resend.dev',
          to: creator.email,
          subject: `Devmaxx Weekly Brief — ${game.name} — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          html: buildBriefHtml(game.name, brief),
        });
      } catch (err) {
        console.error('Failed to send growth brief email:', err);
      }
    }

    return result;
  }
}

function buildBriefHtml(gameName: string, brief: BriefSection): string {
  const changeColor = (val: number) => (val >= 0 ? '#4ade80' : '#f87171');
  const changeArrow = (val: number) => (val >= 0 ? '&#9650;' : '&#9660;');
  const formatPct = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">

<div style="text-align:center;margin-bottom:32px;">
  <h1 style="font-size:24px;font-weight:700;margin:0;">Devmaxx Weekly Brief</h1>
  <p style="color:#9ca3af;margin:8px 0 0;">${gameName}</p>
</div>

<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:24px;margin-bottom:16px;">
  <h2 style="font-size:14px;color:#6366f1;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">Revenue</h2>
  <div style="font-size:32px;font-weight:700;">${brief.revenue.thisWeek.toLocaleString()} R$</div>
  <div style="margin-top:8px;color:${changeColor(brief.revenue.changePercent)};">
    ${changeArrow(brief.revenue.changePercent)} ${formatPct(brief.revenue.changePercent)} vs last week (${brief.revenue.lastWeek.toLocaleString()} R$)
  </div>
  <div style="margin-top:4px;color:#6b7280;font-size:14px;">4-week avg: ${brief.revenue.fourWeekAvg.toLocaleString()} R$</div>
</div>

<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:24px;margin-bottom:16px;">
  <h2 style="font-size:14px;color:#8b5cf6;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">Player Health</h2>
  <div style="display:flex;gap:24px;">
    <div>
      <div style="color:#9ca3af;font-size:12px;">DAU</div>
      <div style="font-size:24px;font-weight:700;">${brief.playerHealth.dauThisWeek.toLocaleString()}</div>
      <div style="color:${brief.playerHealth.dauThisWeek >= brief.playerHealth.dauLastWeek ? '#4ade80' : '#f87171'};font-size:14px;">
        ${brief.playerHealth.dauTrend} from ${brief.playerHealth.dauLastWeek.toLocaleString()}
      </div>
    </div>
    <div>
      <div style="color:#9ca3af;font-size:12px;">D7 Retention</div>
      <div style="font-size:24px;font-weight:700;">${(brief.playerHealth.d7Retention * 100).toFixed(1)}%</div>
      <div style="color:${changeColor(brief.playerHealth.d7RetentionChange)};font-size:14px;">
        ${brief.playerHealth.d7RetentionChange >= 0 ? '+' : ''}${(brief.playerHealth.d7RetentionChange * 100).toFixed(1)}pp
      </div>
    </div>
  </div>
</div>

<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:24px;margin-bottom:16px;">
  <h2 style="font-size:14px;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">Top 3 This Week</h2>
  ${brief.topThree
    .map(
      (item, i) => `
  <div style="margin-bottom:${i < 2 ? '12px' : '0'};padding-left:12px;border-left:3px solid ${item.impact === 'positive' ? '#4ade80' : item.impact === 'negative' ? '#f87171' : '#6b7280'};">
    <div style="font-weight:600;">${i + 1}. ${item.title}</div>
    <div style="color:#9ca3af;font-size:14px;margin-top:2px;">${item.description}</div>
  </div>`
    )
    .join('')}
</div>

<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:24px;margin-bottom:16px;">
  <h2 style="font-size:14px;color:#10b981;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">Next 3 Actions</h2>
  ${brief.nextActions
    .map(
      (item, i) => `
  <div style="margin-bottom:${i < 2 ? '12px' : '0'};">
    <div style="font-weight:600;">${i + 1}. ${item.action}</div>
    <div style="margin-top:4px;font-size:13px;">
      <span style="background:#065f46;color:#6ee7b7;padding:2px 8px;border-radius:4px;">Impact: ${item.estimatedImpact}</span>
      <span style="background:#1e1b4e;color:#a5b4fc;padding:2px 8px;border-radius:4px;margin-left:4px;">Effort: ${item.effortLevel}</span>
    </div>
  </div>`
    )
    .join('')}
</div>

<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:24px;margin-bottom:32px;">
  <h2 style="font-size:14px;color:#ec4899;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">Agent Activity</h2>
  <div style="display:flex;flex-wrap:wrap;gap:16px;">
    <div><span style="color:#9ca3af;font-size:12px;">Runs</span><br><strong>${brief.agentActivity.totalRuns}</strong></div>
    <div><span style="color:#9ca3af;font-size:12px;">Robux Impact</span><br><strong style="color:#4ade80;">+${brief.agentActivity.totalRobuxImpact.toLocaleString()}</strong></div>
    <div><span style="color:#9ca3af;font-size:12px;">Tickets Resolved</span><br><strong>${brief.agentActivity.ticketsResolved}</strong></div>
    <div><span style="color:#9ca3af;font-size:12px;">Escalated</span><br><strong>${brief.agentActivity.ticketsEscalated}</strong></div>
    <div><span style="color:#9ca3af;font-size:12px;">Content</span><br><strong>${brief.agentActivity.contentGenerated}</strong></div>
  </div>
  <div style="margin-top:12px;color:#9ca3af;font-size:13px;">Top agent: ${brief.agentActivity.topAgent.replace(/Agent$/, '').replace(/([A-Z])/g, ' $1').trim()}</div>
</div>

<div style="text-align:center;color:#6b7280;font-size:12px;">
  <p>Devmaxx &middot; devmaxx.app &middot; Maxx your DevEx</p>
  <p><a href="https://devmaxx.app/settings/notifications" style="color:#6366f1;">Manage notification preferences</a></p>
</div>

</div>
</body>
</html>`;
}
