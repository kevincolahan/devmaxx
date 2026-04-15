import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentContext, AgentResult } from '../lib/base-agent';
import { Resend } from 'resend';

// ─── Apify Scraping ──────────────────────────────────────────

const APIFY_BASE = 'https://api.apify.com/v2';

interface ScrapedArticle {
  title: string;
  url: string;
  date: string;
  snippet: string;
  source: 'roblox_newsroom' | 'devforum' | 'reddit';
}

async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>
): Promise<unknown[]> {
  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) throw new Error('APIFY_API_TOKEN not set');

  const runRes = await fetch(
    `${APIFY_BASE}/acts/${actorId}/runs?token=${apiToken}&waitForFinish=120`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  );

  if (!runRes.ok) {
    const text = await runRes.text();
    throw new Error(`Apify actor ${actorId} failed (${runRes.status}): ${text}`);
  }

  const runData = (await runRes.json()) as { data: { defaultDatasetId: string } };
  const datasetId = runData.data.defaultDatasetId;

  const dataRes = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${apiToken}&format=json`
  );

  if (!dataRes.ok) {
    throw new Error(`Failed to fetch Apify dataset ${datasetId}`);
  }

  return (await dataRes.json()) as unknown[];
}

async function fetchRobloxNewsroom(): Promise<ScrapedArticle[]> {
  try {
    const items = await runApifyActor('apify~rss-feed-reader', {
      urls: [{ url: 'https://corp.roblox.com/feed/' }],
      maxItems: 20,
    });

    return (items as Array<Record<string, unknown>>)
      .filter((item) => {
        const pubDate = new Date(String(item.pubDate ?? item.isoDate ?? ''));
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return pubDate >= sevenDaysAgo;
      })
      .map((item) => ({
        title: String(item.title ?? ''),
        url: String(item.link ?? item.url ?? ''),
        date: String(item.pubDate ?? item.isoDate ?? ''),
        snippet: String(item.contentSnippet ?? item.description ?? '').slice(0, 500),
        source: 'roblox_newsroom' as const,
      }));
  } catch (err) {
    console.error('[NewsMonitor] Roblox newsroom scrape failed:', err);
    return [];
  }
}

async function fetchDevForumAnnouncements(): Promise<ScrapedArticle[]> {
  try {
    const items = await runApifyActor('apify~web-scraper', {
      startUrls: [{ url: 'https://devforum.roblox.com/c/updates/announcements/36.json' }],
      pageFunction: `async function pageFunction(context) {
        const data = JSON.parse(context.body);
        const topics = data.topic_list?.topics ?? [];
        return topics.slice(0, 15).map(t => ({
          title: t.title,
          url: 'https://devforum.roblox.com/t/' + t.slug + '/' + t.id,
          date: t.created_at,
          snippet: t.excerpt || t.title,
          views: t.views,
          likeCount: t.like_count,
        }));
      }`,
      maxRequestsPerCrawl: 1,
    });

    return (items as Array<Record<string, unknown>>)
      .filter((item) => {
        const created = new Date(String(item.date ?? ''));
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return created >= sevenDaysAgo;
      })
      .map((item) => ({
        title: String(item.title ?? ''),
        url: String(item.url ?? ''),
        date: String(item.date ?? ''),
        snippet: String(item.snippet ?? '').slice(0, 500),
        source: 'devforum' as const,
      }));
  } catch (err) {
    console.error('[NewsMonitor] DevForum scrape failed:', err);
    return [];
  }
}

async function fetchRedditRobloxDev(): Promise<ScrapedArticle[]> {
  try {
    const items = await runApifyActor('apify~web-scraper', {
      startUrls: [{ url: 'https://www.reddit.com/r/robloxgamedev/top.json?t=week&limit=15' }],
      pageFunction: `async function pageFunction(context) {
        const data = JSON.parse(context.body);
        const posts = data.data?.children ?? [];
        return posts.map(p => ({
          title: p.data.title,
          url: 'https://reddit.com' + p.data.permalink,
          date: new Date(p.data.created_utc * 1000).toISOString(),
          snippet: (p.data.selftext || '').slice(0, 500),
          score: p.data.score,
          numComments: p.data.num_comments,
        }));
      }`,
      maxRequestsPerCrawl: 1,
    });

    return (items as Array<Record<string, unknown>>).map((item) => ({
      title: String(item.title ?? ''),
      url: String(item.url ?? ''),
      date: String(item.date ?? ''),
      snippet: String(item.snippet ?? '').slice(0, 500),
      source: 'reddit' as const,
    }));
  } catch (err) {
    console.error('[NewsMonitor] Reddit scrape failed:', err);
    return [];
  }
}

// ─── Agent ───────────────────────────────────────────────────

interface ScoredArticle extends ScrapedArticle {
  relevanceScore: number;
  opportunityScore: number;
}

interface GeneratedContent {
  blogTitle: string;
  blogBody: string;
  twitterThread: string[];
  linkedinPost: string;
  tiktokScript: string;
}

interface NewsAnalysisOutput {
  scoredArticles: Array<{
    title: string;
    url: string;
    relevanceScore: number;
    opportunityScore: number;
  }>;
}

interface ContentGenerationOutput {
  blogTitle: string;
  blogBody: string;
  twitterThread: string[];
  linkedinPost: string;
  tiktokScript: string;
}

export class RobloxNewsMonitorAgent extends BaseAgent {
  constructor() {
    super('RobloxNewsMonitorAgent');
  }

  buildSystemPrompt(_ctx: AgentContext): string {
    return `You are a Roblox industry analyst for Devmaxx, an AI platform for Roblox creators.

You analyze Roblox news, announcements, and community posts and score each on two dimensions:

1. **Relevance to Roblox creator business** (1-10): How much does this affect game creators' revenue, development workflow, or player engagement?
2. **Content opportunity score** (1-10): How much potential does this have for creating marketing content that positions Devmaxx as a thought leader?

Scoring guide:
- 9-10: Major platform change (new monetization features, DevEx changes, API updates)
- 7-8: Significant update (new tools, policy changes, marketplace updates)
- 5-6: Moderately interesting (community events, minor updates)
- 1-4: Low relevance (cosmetic updates, unrelated news)

Respond ONLY with valid JSON:
{
  "scoredArticles": [
    {
      "title": "Article title",
      "url": "url",
      "relevanceScore": 8,
      "opportunityScore": 9
    }
  ]
}`;
  }

  buildUserPrompt(ctx: AgentContext): string {
    const articles = ctx.inputData.articles as ScrapedArticle[];

    let prompt = `Score the following ${articles.length} Roblox news items on relevance and content opportunity:\n\n`;

    for (const article of articles) {
      prompt += `SOURCE: ${article.source}\n`;
      prompt += `TITLE: ${article.title}\n`;
      prompt += `URL: ${article.url}\n`;
      prompt += `DATE: ${article.date}\n`;
      prompt += `SNIPPET: ${article.snippet}\n\n`;
    }

    prompt += `Score each article. Only include articles that exist in the list above.`;
    return prompt;
  }

  async parseResponse(r: Anthropic.Message, _ctx: AgentContext): Promise<AgentResult> {
    const text = r.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let output: NewsAnalysisOutput;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      output = JSON.parse(jsonMatch[0]) as NewsAnalysisOutput;
    } catch {
      return {
        action: 'scoring_failed',
        output: { error: 'Failed to parse scoring response', rawResponse: text },
        status: 'failed',
      };
    }

    const highScoring = output.scoredArticles.filter(
      (a) => a.relevanceScore >= 7 && a.opportunityScore >= 7
    );

    return {
      action: highScoring.length > 0 ? 'opportunities_found' : 'no_opportunities',
      output: {
        totalScanned: output.scoredArticles.length,
        highScoring,
      },
      robuxImpact: 0,
      status: 'success',
    };
  }

  async executeActions(_result: AgentResult, _ctx: AgentContext): Promise<void> {
    // Content generation happens in runFullPipeline
  }

  // ─── Content generation for a single high-scoring article ──

  private async generateContentForArticle(
    article: ScoredArticle
  ): Promise<ContentGenerationOutput> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 2048,
      system: `You are a content strategist for Devmaxx (devmaxx.app), an AI platform for Roblox game creators.

Generate marketing content about a Roblox news item. All content should position Devmaxx as the go-to tool for Roblox creators.

Social handles: @devmaxxapp (X, TikTok), @devmaxx.app (Instagram), Devmaxx (LinkedIn)

Respond ONLY with valid JSON:
{
  "blogTitle": "What [announcement] Means for Your DevEx Earnings",
  "blogBody": "600-800 word blog post. Structure: What happened → Why it matters → What creators should do → How Devmaxx helps. SEO-optimized. Include a CTA linking to devmaxx.app.",
  "twitterThread": ["Tweet 1 (hook)", "Tweet 2", "Tweet 3", "Tweet 4", "Tweet 5 (CTA)"],
  "linkedinPost": "3 paragraphs. Professional creator economy angle. End with engagement question.",
  "tiktokScript": "45-60 second script. Hook in first line. CTA at end."
}

Rules:
- Blog must be 600-800 words
- Each tweet must be under 280 characters
- LinkedIn should be professional but accessible
- TikTok script should be conversational and punchy
- Always reference specific facts from the article
- Never fabricate statistics`,
      messages: [
        {
          role: 'user',
          content: `Generate content for this Roblox news item:

TITLE: ${article.title}
SOURCE: ${article.source}
URL: ${article.url}
DATE: ${article.date}
CONTENT: ${article.snippet}

Relevance score: ${article.relevanceScore}/10
Content opportunity: ${article.opportunityScore}/10`,
        },
      ],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in content generation response');

    return JSON.parse(jsonMatch[0]) as ContentGenerationOutput;
  }

  // ─── Full pipeline ─────────────────────────────────────────

  async runFullPipeline(
    creatorId: string,
    db: import('@prisma/client').PrismaClient
  ): Promise<AgentResult & { contentCount: number }> {
    // Step 1: Scrape all sources in parallel
    const [newsroom, devforum, reddit] = await Promise.all([
      fetchRobloxNewsroom(),
      fetchDevForumAnnouncements(),
      fetchRedditRobloxDev(),
    ]);

    const allArticles = [...newsroom, ...devforum, ...reddit];

    if (allArticles.length === 0) {
      const result: AgentResult = {
        action: 'no_articles_found',
        output: { message: 'No articles found from any source this week' },
        robuxImpact: 0,
        status: 'success',
      };
      await db.agentRun.create({
        data: {
          creatorId,
          agentName: this.agentName,
          input: { sources: ['roblox_newsroom', 'devforum', 'reddit'] },
          output: result.output as Record<string, unknown> as never,
          action: result.action,
          robuxImpact: 0,
          status: result.status,
        },
      });
      return { ...result, contentCount: 0 };
    }

    // Step 2: Score all articles with Claude
    const context: AgentContext = {
      creatorId,
      inputData: { articles: allArticles },
      db,
    };

    const scoringResult = await this.run(context);

    if (scoringResult.action !== 'opportunities_found') {
      return { ...scoringResult, contentCount: 0 };
    }

    const highScoring = (scoringResult.output as Record<string, unknown>).highScoring as Array<{
      title: string;
      url: string;
      relevanceScore: number;
      opportunityScore: number;
    }>;

    // Step 3: Generate content for each high-scoring article
    let contentCount = 0;
    const generatedSummaries: Array<{
      title: string;
      url: string;
      piecesCreated: number;
    }> = [];

    for (const scored of highScoring) {
      const article: ScoredArticle = {
        ...allArticles.find((a) => a.url === scored.url) ?? {
          title: scored.title,
          url: scored.url,
          date: new Date().toISOString(),
          snippet: '',
          source: 'roblox_newsroom' as const,
        },
        relevanceScore: scored.relevanceScore,
        opportunityScore: scored.opportunityScore,
      };

      try {
        const generated = await this.generateContentForArticle(article);
        const sourceData = {
          articleUrl: article.url,
          articleTitle: article.title,
          articleSource: article.source,
          relevanceScore: article.relevanceScore,
          opportunityScore: article.opportunityScore,
          agentName: this.agentName,
          generatedAt: new Date().toISOString(),
        };

        let piecesCreated = 0;

        const avgScore = Math.round((article.relevanceScore + article.opportunityScore) / 2);
        // Auto-approve content scoring 7+ on average, otherwise draft
        const autoStatus = avgScore >= 7 ? 'approved' : 'draft';

        // Blog article
        await db.contentPiece.create({
          data: {
            creatorId,
            type: 'news_response',
            platform: 'blog',
            content: `# ${generated.blogTitle}\n\n${generated.blogBody}`,
            qualityScore: avgScore,
            status: autoStatus,
            sourceData,
          },
        });
        piecesCreated++;

        // X/Twitter thread — each tweet as a separate piece
        for (let i = 0; i < generated.twitterThread.length; i++) {
          const tweet = generated.twitterThread[i];
          if (tweet.length <= 280) {
            await db.contentPiece.create({
              data: {
                creatorId,
                type: 'news_response',
                platform: 'x',
                content: tweet,
                qualityScore: avgScore,
                status: autoStatus,
                sourceData: { ...sourceData, threadPosition: i + 1, threadTotal: generated.twitterThread.length },
              },
            });
            piecesCreated++;
          }
        }

        // LinkedIn post
        await db.contentPiece.create({
          data: {
            creatorId,
            type: 'news_response',
            platform: 'linkedin',
            content: generated.linkedinPost,
            qualityScore: avgScore,
            status: autoStatus,
            sourceData,
          },
        });
        piecesCreated++;

        // TikTok script
        await db.contentPiece.create({
          data: {
            creatorId,
            type: 'news_response',
            platform: 'tiktok',
            content: generated.tiktokScript,
            qualityScore: avgScore,
            status: autoStatus,
            sourceData,
          },
        });
        piecesCreated++;

        contentCount += piecesCreated;
        generatedSummaries.push({
          title: article.title,
          url: article.url,
          piecesCreated,
        });
      } catch (err) {
        console.error(`[NewsMonitor] Content gen failed for "${article.title}":`, err);
      }
    }

    // Step 4: Send digest email
    if (contentCount > 0) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.FROM_EMAIL ?? 'onboarding@resend.dev',
          to: 'kevin@devmaxx.app',
          subject: `Devmaxx found ${contentCount} content opportunities this week`,
          html: buildDigestHtml(generatedSummaries, contentCount),
        });
      } catch (err) {
        console.error('[NewsMonitor] Failed to send digest email:', err);
      }
    }

    return {
      action: 'content_generated',
      output: {
        articlesScanned: allArticles.length,
        highScoringCount: highScoring.length,
        contentPiecesCreated: contentCount,
        summaries: generatedSummaries,
      },
      robuxImpact: 0,
      status: 'success',
      contentCount,
    };
  }
}

// ─── Digest email HTML ───────────────────────────────────────

function buildDigestHtml(
  summaries: Array<{ title: string; url: string; piecesCreated: number }>,
  totalPieces: number
): string {
  const rows = summaries
    .map(
      (s) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #1f2937;">
        <a href="${s.url}" style="color:#818cf8;text-decoration:none;font-weight:600;">${s.title}</a>
        <div style="color:#9ca3af;font-size:13px;margin-top:4px;">${s.piecesCreated} content pieces generated</div>
      </td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">

<div style="text-align:center;margin-bottom:32px;">
  <h1 style="font-size:24px;font-weight:700;margin:0;">Devmaxx News Monitor</h1>
  <p style="color:#9ca3af;margin:8px 0 0;">Weekly Content Opportunities</p>
</div>

<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:24px;margin-bottom:16px;">
  <div style="font-size:14px;color:#6366f1;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">This Week</div>
  <div style="font-size:36px;font-weight:700;">${totalPieces}</div>
  <div style="color:#9ca3af;font-size:14px;">content pieces ready for review</div>
</div>

<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;overflow:hidden;margin-bottom:24px;">
  <div style="padding:16px;border-bottom:1px solid #1f2937;">
    <h2 style="font-size:14px;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;margin:0;">Source Articles</h2>
  </div>
  <table style="width:100%;border-collapse:collapse;">
    ${rows}
  </table>
</div>

<div style="text-align:center;">
  <a href="https://devmaxx.app/dashboard" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
    Review in Dashboard
  </a>
</div>

<div style="text-align:center;color:#6b7280;font-size:12px;margin-top:32px;">
  <p>Devmaxx &middot; devmaxx.app &middot; Maxx your DevEx</p>
</div>

</div>
</body>
</html>`;
}
