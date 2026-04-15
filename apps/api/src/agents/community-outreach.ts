import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

// ─── Reddit OAuth2 API ──────────────────────────────────────

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let redditToken: { token: string; expiresAt: number } | null = null;

async function getRedditToken(): Promise<string> {
  if (redditToken && Date.now() < redditToken.expiresAt) {
    return redditToken.token;
  }

  const clientId = (process.env.REDDIT_CLIENT_ID || '').trim();
  const clientSecret = (process.env.REDDIT_CLIENT_SECRET || '').trim();
  const username = (process.env.REDDIT_USERNAME || '').trim();
  const password = (process.env.REDDIT_PASSWORD || '').trim();

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error('Missing Reddit credentials (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD)');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const userAgent = (process.env.REDDIT_USER_AGENT || 'Devmaxx/1.0').trim();

  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
    },
    body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Reddit OAuth failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as RedditTokenResponse;
  redditToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

interface RedditPostResult {
  success: boolean;
  postUrl?: string;
  error?: string;
}

async function postToReddit(
  subreddit: string,
  title: string,
  text: string
): Promise<RedditPostResult> {
  const token = await getRedditToken();
  const userAgent = (process.env.REDDIT_USER_AGENT || 'Devmaxx/1.0').trim();

  const res = await fetch('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
    },
    body: new URLSearchParams({
      sr: subreddit,
      kind: 'self',
      title,
      text,
      api_type: 'json',
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    return { success: false, error: `Reddit API ${res.status}: ${body}` };
  }

  const data = (await res.json()) as {
    json?: { data?: { url?: string; name?: string }; errors?: string[][] };
  };

  if (data.json?.errors && data.json.errors.length > 0) {
    return { success: false, error: `Reddit errors: ${JSON.stringify(data.json.errors)}` };
  }

  return {
    success: true,
    postUrl: data.json?.data?.url ?? `https://reddit.com/r/${subreddit}`,
  };
}

// ─── DevForum Discourse API ─────────────────────────────────

interface DevForumPostResult {
  success: boolean;
  postUrl?: string;
  error?: string;
}

async function postToDevForum(
  title: string,
  raw: string,
  categoryId: number
): Promise<DevForumPostResult> {
  const apiKey = (process.env.DEVFORUM_API_KEY || '').trim();
  const username = (process.env.DEVFORUM_USERNAME || '').trim();

  if (!apiKey || !username) {
    return { success: false, error: 'Missing DEVFORUM_API_KEY or DEVFORUM_USERNAME' };
  }

  const res = await fetch('https://devforum.roblox.com/posts.json', {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Api-Username': username,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      raw,
      category: categoryId,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { success: false, error: `DevForum API ${res.status}: ${body}` };
  }

  const data = (await res.json()) as { topic_id?: number; topic_slug?: string };

  return {
    success: true,
    postUrl: data.topic_id
      ? `https://devforum.roblox.com/t/${data.topic_slug ?? 'post'}/${data.topic_id}`
      : 'https://devforum.roblox.com',
  };
}

// ─── Claude content generation ──────────────────────────────

interface GeneratedOutreach {
  redditTitle: string;
  redditBody: string;
  devforumTitle: string;
  devforumBody: string;
  qualityScore: number;
}

async function generateOutreachContent(
  previousPosts: string[]
): Promise<GeneratedOutreach> {
  const client = new Anthropic();

  const previousList = previousPosts.length > 0
    ? `\n\nPREVIOUS POSTS (do NOT repeat these themes or angles):\n${previousPosts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
    : '';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20251001',
    max_tokens: 2048,
    system: `You are a community manager for Devmaxx (devmaxx.app), an AI-powered business platform for Roblox game creators.

Write community posts for Reddit (r/robloxgamedev) and Roblox DevForum that:
- Lead with VALUE, not promotion
- Share genuine insight about Roblox creator business
- Mention Devmaxx naturally as your tool, not as an ad
- Ask for feedback or beta testers
- Sound like a real developer, not a marketer
- Are different each week — vary the angle, topic, hook

Good angles:
- Share a specific metric insight (e.g., "D7 retention is the most underrated metric")
- Ask a question the community cares about
- Offer a free resource or analysis
- Share lessons from building for Roblox creators
- Discuss DevEx optimization strategies

BAD (never do these):
- "Check out my product!" spam
- Fake enthusiasm or hype
- Clickbait titles
- Posting the same thing twice
- Ignoring subreddit rules

Self-rate quality 1-10:
- 9-10: Genuinely helpful, would get upvoted organically
- 7-8: Good value, natural mention
- 5-6: Too promotional, needs rework
- 1-4: Spam territory, do not post

Respond ONLY with valid JSON:
{
  "redditTitle": "Post title for Reddit (compelling, not clickbait)",
  "redditBody": "Full post body for Reddit. 150-300 words. Value-first. Link devmaxx.app at end.",
  "devforumTitle": "Post title for DevForum (more professional tone)",
  "devforumBody": "Full post body for DevForum. 200-400 words. More detailed, technical angle.",
  "qualityScore": 8
}`,
    messages: [
      {
        role: 'user',
        content: `Generate this week's community outreach posts for Roblox developer communities.

Current date: ${new Date().toISOString().split('T')[0]}
Platform: devmaxx.app — free tier available
Key features: weekly growth briefs, pricing optimization, competitor tracking, AI player support
Target: Roblox game creators who want to maximize DevEx earnings${previousList}

Generate fresh, unique content that hasn't been posted before.`,
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in outreach generation response');

  return JSON.parse(jsonMatch[0]) as GeneratedOutreach;
}

// ─── Main Pipeline ──────────────────────────────────────────

interface OutreachResult {
  generated: boolean;
  qualityScore: number;
  redditPosted: boolean;
  redditUrl?: string;
  devforumPosted: boolean;
  devforumUrl?: string;
  skippedReason?: string;
}

export async function runCommunityOutreachPipeline(
  db: PrismaClient
): Promise<OutreachResult> {
  console.log('[CommunityOutreach] Starting weekly outreach');

  // Check cooldown — never post if last post was less than 7 days ago
  const lastPostRow = await db.keyValue.findUnique({ where: { key: 'last_community_post_date' } });
  if (lastPostRow) {
    const lastDate = new Date(lastPostRow.value);
    const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      console.log(`[CommunityOutreach] Skipping — last post was ${daysSince.toFixed(1)} days ago`);
      return {
        generated: false,
        qualityScore: 0,
        redditPosted: false,
        devforumPosted: false,
        skippedReason: `Last post was ${daysSince.toFixed(1)} days ago (min 7)`,
      };
    }
  }

  // Get previous post titles to avoid repetition
  const previousPosts = await db.keyValue.findUnique({ where: { key: 'community_post_history' } });
  const postHistory: string[] = previousPosts ? JSON.parse(previousPosts.value) : [];

  // Generate content with Claude
  let content: GeneratedOutreach;
  try {
    content = await generateOutreachContent(postHistory.slice(-10));
  } catch (err) {
    console.error('[CommunityOutreach] Content generation failed:', err);
    return {
      generated: false,
      qualityScore: 0,
      redditPosted: false,
      devforumPosted: false,
      skippedReason: `Generation failed: ${String(err)}`,
    };
  }

  console.log(`[CommunityOutreach] Generated content — quality: ${content.qualityScore}/10`);

  // Only post if quality is 8+
  if (content.qualityScore < 8) {
    console.log(`[CommunityOutreach] Skipping — quality ${content.qualityScore} < 8`);
    return {
      generated: true,
      qualityScore: content.qualityScore,
      redditPosted: false,
      devforumPosted: false,
      skippedReason: `Quality score ${content.qualityScore} below threshold (8)`,
    };
  }

  const result: OutreachResult = {
    generated: true,
    qualityScore: content.qualityScore,
    redditPosted: false,
    devforumPosted: false,
  };

  // Post to Reddit r/robloxgamedev
  const hasRedditCreds = process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET;
  if (hasRedditCreds) {
    try {
      const redditResult = await postToReddit('robloxgamedev', content.redditTitle, content.redditBody);
      if (redditResult.success) {
        result.redditPosted = true;
        result.redditUrl = redditResult.postUrl;
        console.log(`[CommunityOutreach] Reddit posted: ${redditResult.postUrl}`);
      } else {
        console.error(`[CommunityOutreach] Reddit failed: ${redditResult.error}`);
      }
    } catch (err) {
      console.error('[CommunityOutreach] Reddit error:', err);
    }
  } else {
    console.log('[CommunityOutreach] Skipping Reddit — no credentials');
  }

  // Post to DevForum
  const hasDevForumCreds = process.env.DEVFORUM_API_KEY && process.env.DEVFORUM_USERNAME;
  if (hasDevForumCreds) {
    try {
      // Category 63 = Community Resources (adjust if needed)
      const devforumResult = await postToDevForum(content.devforumTitle, content.devforumBody, 63);
      if (devforumResult.success) {
        result.devforumPosted = true;
        result.devforumUrl = devforumResult.postUrl;
        console.log(`[CommunityOutreach] DevForum posted: ${devforumResult.postUrl}`);
      } else {
        console.error(`[CommunityOutreach] DevForum failed: ${devforumResult.error}`);
      }
    } catch (err) {
      console.error('[CommunityOutreach] DevForum error:', err);
    }
  } else {
    console.log('[CommunityOutreach] Skipping DevForum — no credentials');
  }

  // Update tracking
  if (result.redditPosted || result.devforumPosted) {
    await db.keyValue.upsert({
      where: { key: 'last_community_post_date' },
      update: { value: new Date().toISOString() },
      create: { key: 'last_community_post_date', value: new Date().toISOString() },
    });

    const updatedHistory = [...postHistory, content.redditTitle].slice(-20);
    await db.keyValue.upsert({
      where: { key: 'community_post_history' },
      update: { value: JSON.stringify(updatedHistory) },
      create: { key: 'community_post_history', value: JSON.stringify(updatedHistory) },
    });

    // Store the latest post details for dashboard
    await db.keyValue.upsert({
      where: { key: 'community_last_post' },
      update: {
        value: JSON.stringify({
          redditTitle: content.redditTitle,
          redditUrl: result.redditUrl,
          redditPosted: result.redditPosted,
          devforumTitle: content.devforumTitle,
          devforumUrl: result.devforumUrl,
          devforumPosted: result.devforumPosted,
          qualityScore: content.qualityScore,
          postedAt: new Date().toISOString(),
        }),
      },
      create: {
        key: 'community_last_post',
        value: JSON.stringify({
          redditTitle: content.redditTitle,
          redditUrl: result.redditUrl,
          redditPosted: result.redditPosted,
          devforumTitle: content.devforumTitle,
          devforumUrl: result.devforumUrl,
          devforumPosted: result.devforumPosted,
          qualityScore: content.qualityScore,
          postedAt: new Date().toISOString(),
        }),
      },
    });
  }

  console.log(`[CommunityOutreach] Done — reddit: ${result.redditPosted}, devforum: ${result.devforumPosted}`);
  return result;
}
