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
4. **Last Week's Recommendations — What Actually Happened**: For any recommendations with measured outcomes, show prediction vs reality. Build trust through transparency. If no measured outcomes exist, omit this section.
5. **Next 3 Actions**: 3 specific actions the creator should take, with estimated impact (high/medium/low) and effort (low/medium/high).
6. **Agent Activity**: Summary of what the AI agents did this week including measured impact.

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
    prompt += `CONTENT PUBLISHED:\n${JSON.stringify(input.contentStats, null, 2)}\n\n`;

    if (input.playerSentiment) {
      prompt += `PLAYER PULSE:\n${JSON.stringify(input.playerSentiment, null, 2)}\n\n`;
      prompt += `Include a "Player Pulse" section: sentiment score, #1 complaint, #1 praise, one action to improve.\n\n`;
    }

    if (input.outcomeResults && (input.outcomeResults as unknown[]).length > 0) {
      prompt += `LAST WEEK'S RECOMMENDATIONS — MEASURED OUTCOMES:\n${JSON.stringify(input.outcomeResults, null, 2)}\n\n`;
      prompt += `Include a "What Actually Happened" section comparing predictions vs reality for these.\n`;
    }

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
        playerSentiment: await db.playerSentiment.findFirst({
          where: { gameId },
          orderBy: { analyzedAt: 'desc' },
          select: {
            overallScore: true,
            weekOverWeekChange: true,
            topBugs: true,
            topPraise: true,
          },
        }),
        outcomeResults: await db.agentRun.findMany({
          where: {
            creatorId,
            gameId,
            followUpCompleted: true,
            actualRobuxImpact: { not: null },
            createdAt: { gte: twoWeeksAgo },
          },
          select: {
            agentName: true,
            action: true,
            robuxImpact: true,
            actualRobuxImpact: true,
          },
        }),
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
  const now = new Date();
  const weekDate = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const changeColor = (val: number) => (val >= 0 ? '#4ade80' : '#f87171');
  const trendArrow = (val: number) => (val > 0 ? '\u2191' : val < 0 ? '\u2193' : '\u2192');
  const formatPct = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
  const dauChange = brief.playerHealth.dauThisWeek - brief.playerHealth.dauLastWeek;
  const dauPct = brief.playerHealth.dauLastWeek > 0 ? (dauChange / brief.playerHealth.dauLastWeek) * 100 : 0;

  // Health score color
  const healthScore = 50; // Default — in practice this comes from the game
  const healthColor = healthScore >= 70 ? '#4ade80' : healthScore >= 40 ? '#facc15' : '#f87171';
  const healthLabel = healthScore >= 70 ? 'Healthy' : healthScore >= 40 ? 'Fair' : 'Needs Work';

  // Impact emoji for top three
  const impactEmoji = (impact: string) => impact === 'positive' ? '\uD83D\uDCC8' : impact === 'negative' ? '\u26A0\uFE0F' : '\uD83D\uDCA1';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Devmaxx Weekly Brief - ${gameName}</title>
</head>
<body style="margin:0;padding:0;background-color:#0A0A14;color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<div style="max-width:600px;margin:0 auto;padding:0;">

<!-- HEADER -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0A0A14;border-bottom:1px solid rgba(99,102,241,0.2);">
<tr><td style="padding:24px 24px 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="vertical-align:middle;">
      <span style="font-size:20px;font-weight:700;color:#818cf8;">Devmaxx</span>
      <span style="color:#4b5563;font-size:14px;margin-left:8px;">Weekly Brief</span>
    </td>
    <td style="text-align:right;vertical-align:middle;">
      <span style="display:inline-block;background-color:${healthColor}22;color:${healthColor};font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;border:1px solid ${healthColor}44;">${healthLabel}</span>
    </td>
  </tr>
  </table>
  <div style="margin-top:12px;">
    <div style="font-size:18px;font-weight:700;color:#ffffff;">${gameName}</div>
    <div style="font-size:13px;color:#6b7280;margin-top:2px;">Week of ${weekDate}</div>
  </div>
</td></tr>
</table>

<!-- THIS WEEK AT A GLANCE -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0F0F1E;border-bottom:1px solid rgba(99,102,241,0.1);">
<tr><td style="padding:20px 24px 6px;">
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;">This Week at a Glance</div>
</td></tr>
<tr><td style="padding:8px 24px 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="width:33%;vertical-align:top;padding-right:8px;">
      <div style="background-color:#141428;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:#9ca3af;">DAU</div>
        <div style="font-size:22px;font-weight:700;color:#ffffff;margin-top:4px;">${brief.playerHealth.dauThisWeek.toLocaleString()}</div>
        <div style="font-size:12px;color:${changeColor(dauChange)};margin-top:4px;">${trendArrow(dauChange)} ${dauChange >= 0 ? '+' : ''}${dauChange.toLocaleString()}</div>
      </div>
    </td>
    <td style="width:34%;vertical-align:top;padding:0 4px;">
      <div style="background-color:#141428;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:#9ca3af;">Revenue</div>
        <div style="font-size:22px;font-weight:700;color:#ffffff;margin-top:4px;">${brief.revenue.thisWeek.toLocaleString()} R$</div>
        <div style="font-size:12px;color:${changeColor(brief.revenue.changePercent)};margin-top:4px;">${trendArrow(brief.revenue.changePercent)} ${formatPct(brief.revenue.changePercent)}</div>
      </div>
    </td>
    <td style="width:33%;vertical-align:top;padding-left:8px;">
      <div style="background-color:#141428;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:#9ca3af;">Agent Runs</div>
        <div style="font-size:22px;font-weight:700;color:#818cf8;margin-top:4px;">${brief.agentActivity.totalRuns}</div>
        <div style="font-size:12px;color:#4ade80;margin-top:4px;">+${brief.agentActivity.totalRobuxImpact.toLocaleString()} R$</div>
      </div>
    </td>
  </tr>
  </table>
</td></tr>
</table>

<!-- WHAT CHANGED -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0A0A14;">
<tr><td style="padding:24px;">
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;margin-bottom:16px;">What Changed</div>
  ${brief.topThree.map((item) => `
  <div style="margin-bottom:10px;padding:12px 14px;background-color:#0F0F1E;border-radius:8px;border-left:3px solid ${item.impact === 'positive' ? '#4ade80' : item.impact === 'negative' ? '#f87171' : '#818cf8'};">
    <span style="font-size:14px;">${impactEmoji(item.impact)}</span>
    <span style="font-weight:600;color:#ffffff;margin-left:6px;">${item.title}</span>
    <div style="color:#9ca3af;font-size:13px;margin-top:4px;line-height:1.5;">${item.description}</div>
  </div>`).join('')}
</td></tr>
</table>

<!-- TOP RECOMMENDATION -->
${brief.nextActions.length > 0 ? `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0A0A14;">
<tr><td style="padding:0 24px 24px;">
  <div style="background:linear-gradient(135deg,#1e1b4b,#0F0F1E);border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:20px;">
    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#818cf8;margin-bottom:10px;">Top Recommendation This Week</div>
    <div style="font-size:16px;font-weight:700;color:#ffffff;line-height:1.4;">${brief.nextActions[0].action}</div>
    <div style="margin-top:10px;">
      <span style="display:inline-block;background-color:#065f46;color:#6ee7b7;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;">Impact: ${brief.nextActions[0].estimatedImpact}</span>
      <span style="display:inline-block;background-color:#1e1b4e;color:#a5b4fc;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;margin-left:6px;">Effort: ${brief.nextActions[0].effortLevel}</span>
    </div>
  </div>
</td></tr>
</table>` : ''}

<!-- MORE ACTIONS -->
${brief.nextActions.length > 1 ? `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0A0A14;">
<tr><td style="padding:0 24px 24px;">
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;margin-bottom:12px;">Also Consider</div>
  ${brief.nextActions.slice(1).map((item, i) => `
  <div style="margin-bottom:8px;padding:10px 14px;background-color:#0F0F1E;border-radius:8px;">
    <div style="font-weight:600;color:#ffffff;">${i + 2}. ${item.action}</div>
    <div style="margin-top:6px;">
      <span style="display:inline-block;background-color:#065f46;color:#6ee7b7;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">Impact: ${item.estimatedImpact}</span>
      <span style="display:inline-block;background-color:#1e1b4e;color:#a5b4fc;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;margin-left:4px;">Effort: ${item.effortLevel}</span>
    </div>
  </div>`).join('')}
</td></tr>
</table>` : ''}

<!-- AGENT ACTIVITY -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0F0F1E;border-top:1px solid rgba(99,102,241,0.1);">
<tr><td style="padding:20px 24px 8px;">
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;">Your Agents Ran ${brief.agentActivity.totalRuns} Times</div>
</td></tr>
<tr><td style="padding:8px 24px 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;">
  <tr style="color:#6b7280;">
    <td style="padding:6px 0;border-bottom:1px solid #1f2937;">Agent</td>
    <td style="padding:6px 0;border-bottom:1px solid #1f2937;text-align:center;">Activity</td>
    <td style="padding:6px 0;border-bottom:1px solid #1f2937;text-align:right;">Impact</td>
  </tr>
  <tr>
    <td style="padding:8px 0;color:#ffffff;">Top Agent</td>
    <td style="padding:8px 0;text-align:center;color:#9ca3af;">${brief.agentActivity.topAgent.replace(/Agent$/, '').replace(/([A-Z])/g, ' $1').trim()}</td>
    <td style="padding:8px 0;text-align:right;color:#4ade80;font-weight:600;">+${brief.agentActivity.totalRobuxImpact.toLocaleString()} R$</td>
  </tr>
  <tr>
    <td style="padding:8px 0;color:#ffffff;">Support</td>
    <td style="padding:8px 0;text-align:center;color:#9ca3af;">${brief.agentActivity.ticketsResolved} resolved</td>
    <td style="padding:8px 0;text-align:right;color:${brief.agentActivity.ticketsEscalated > 0 ? '#facc15' : '#6b7280'};">${brief.agentActivity.ticketsEscalated} escalated</td>
  </tr>
  <tr>
    <td style="padding:8px 0;color:#ffffff;">Content</td>
    <td style="padding:8px 0;text-align:center;color:#9ca3af;">${brief.agentActivity.contentGenerated} pieces</td>
    <td style="padding:8px 0;text-align:right;color:#818cf8;">generated</td>
  </tr>
  </table>
</td></tr>
</table>

<!-- CTA BUTTON -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0A0A14;">
<tr><td style="padding:24px;text-align:center;">
  <a href="https://devmaxx.app/dashboard" style="display:inline-block;background-color:#6366f1;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">View Full Dashboard &rarr;</a>
</td></tr>
</table>

<!-- FOOTER -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0A0A14;border-top:1px solid rgba(99,102,241,0.1);">
<tr><td style="padding:24px;text-align:center;">
  <div style="color:#4b5563;font-size:12px;line-height:1.6;">
    <div style="font-weight:600;color:#6b7280;">Devmaxx</div>
    <div>devmaxx.app &middot; Maxx your DevEx</div>
    <div style="margin-top:12px;">
      <a href="https://devmaxx.app/dashboard" style="color:#818cf8;text-decoration:none;">Dashboard</a>
      <span style="color:#374151;margin:0 8px;">|</span>
      <a href="https://x.com/devmaxxapp" style="color:#818cf8;text-decoration:none;">@devmaxxapp</a>
      <span style="color:#374151;margin:0 8px;">|</span>
      <a href="https://devmaxx.app/settings" style="color:#6b7280;text-decoration:none;">Unsubscribe</a>
    </div>
  </div>
</td></tr>
</table>

</div>
<!--[if mso]></td></tr></table><![endif]-->

</body>
</html>`;
}
