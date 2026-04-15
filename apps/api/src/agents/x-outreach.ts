import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import { createHmac, randomBytes } from 'crypto';

// ─── OAuth 1.0a for Twitter API ─────────────────────────────

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function buildOAuthHeader(
  method: string,
  url: string,
  queryParams: Record<string, string> = {}
): string {
  const apiKey = (process.env.TWITTER_API_KEY || '').trim();
  const apiSecret = (process.env.TWITTER_API_SECRET || '').trim();
  const accessToken = (process.env.TWITTER_ACCESS_TOKEN || '').trim();
  const accessSecret = (process.env.TWITTER_ACCESS_SECRET || '').trim();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: randomBytes(32).toString('hex').slice(0, 32),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const allParams = { ...oauthParams, ...queryParams };

  const sortedParams = Object.keys(allParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(allParams[key])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams),
  ].join('&');

  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessSecret)}`;

  const signature = createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');

  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

// ─── Types ──────────────────────────────────────────────────

interface SearchTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    impression_count: number;
  };
}

interface SearchUser {
  id: string;
  username: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

type OutreachCategory =
  | 'analytics_question'
  | 'monetization_help'
  | 'frustration'
  | 'milestone'
  | 'general_roblox'
  | 'skip';

interface ClassifiedTweet {
  tweetId: string;
  category: OutreachCategory;
  replyDraft: string | null;
}

// ─── Twitter Search (Bearer Token) ──────────────────────────

async function searchRecentTweets(): Promise<{
  tweets: SearchTweet[];
  users: SearchUser[];
}> {
  const bearerToken = (process.env.TWITTER_BEARER_TOKEN || '').trim();
  if (!bearerToken) {
    throw new Error('TWITTER_BEARER_TOKEN is not set');
  }

  const baseUrl = 'https://api.twitter.com/2/tweets/search/recent';
  const params: Record<string, string> = {
    query:
      '(roblox devex OR roblox monetization OR roblox analytics OR roblox game revenue OR roblox creator economy) -is:retweet -is:reply lang:en',
    max_results: '10',
    'tweet.fields': 'author_id,created_at,public_metrics',
    'user.fields': 'username,public_metrics',
    expansions: 'author_id',
  };

  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  console.log(`[XOutreach] Searching tweets: ${baseUrl}?${queryString.slice(0, 100)}...`);

  const res = await fetch(`${baseUrl}?${queryString}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitter search API ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    data?: SearchTweet[];
    includes?: { users?: SearchUser[] };
    meta?: { result_count: number };
  };

  console.log(`[XOutreach] Search returned ${data.meta?.result_count ?? 0} tweets`);

  return {
    tweets: data.data ?? [],
    users: data.includes?.users ?? [],
  };
}

// ─── Twitter Reply (OAuth 1.0a) ─────────────────────────────

async function postReply(
  text: string,
  inReplyToId: string
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  const url = 'https://api.twitter.com/2/tweets';
  const auth = buildOAuthHeader('POST', url);

  console.log(`[XOutreach] Posting reply to ${inReplyToId} (${text.length} chars)`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      reply: { in_reply_to_tweet_id: inReplyToId },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[XOutreach] Reply failed ${res.status}: ${body}`);
    return { success: false, error: `Twitter API ${res.status}: ${body}` };
  }

  const data = (await res.json()) as { data?: { id: string } };
  console.log(`[XOutreach] Reply posted: ${data.data?.id}`);
  return { success: true, tweetId: data.data?.id };
}

// ─── Claude Classification + Reply Drafting ─────────────────

async function classifyAndDraftReplies(
  tweets: Array<{ id: string; text: string; username: string; followers: number }>,
  previousReplies: string[]
): Promise<ClassifiedTweet[]> {
  const client = new Anthropic();

  const tweetList = tweets
    .map(
      (t, i) =>
        `[${i}] @${t.username} (${t.followers} followers): "${t.text}" (tweet_id: ${t.id})`
    )
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20251001',
    max_tokens: 2048,
    system: `You are the growth strategist for Devmaxx (devmaxx.app), an AI-powered platform that helps Roblox game creators maximize DevEx earnings.

Your job: find tweets from Roblox developers discussing monetization, analytics, or DevEx and craft genuinely helpful replies that mention Devmaxx naturally.

CLASSIFY each tweet into one of these categories:
- "analytics_question": asking how to track metrics, DAU, retention, etc.
- "monetization_help": asking about pricing, DevEx, revenue optimization
- "frustration": struggling with revenue, metrics, or game growth
- "milestone": celebrating earnings, player counts, or achievements
- "general_roblox": general Roblox creator content, not specifically about business
- "skip": spam, bots, irrelevant, or not worth replying to

REPLY TEMPLATES (vary each reply — never use identical text):

analytics_question:
Give specific metric advice (DAU, retention cohorts, session length). Mention devmaxx.app naturally at the end. Example tone: "DAU and retention cohorts are the two metrics that matter most. [specific advice]. I built something that tracks this automatically — devmaxx.app if you're curious 🎮"

monetization_help:
Give concrete pricing/revenue advice (A/B testing, price elasticity). Mention devmaxx.app as a tool that automates this. Example tone: "A/B testing your item prices is the fastest win — even a 10-15% price increase on high-demand items can significantly impact DevEx. [specific advice]. devmaxx.app automates this if helpful."

frustration:
Be empathetic and give actionable advice. Do NOT include a link — just be genuinely helpful. Example tone: "Retention is usually the culprit when revenue plateaus. [specific advice]. Happy to share more if useful."

milestone:
Congratulate authentically and suggest next steps. Mention devmaxx.app naturally. Example tone: "Congrats! The next level is usually optimizing pricing and retention to compound those earnings. devmaxx.app can help automate that 🎮"

general_roblox:
Set category to "skip" — don't reply unless directly relevant to analytics/monetization.

CRITICAL RULES:
- Keep ALL replies under 280 characters
- Never be salesy or spammy — be a helpful creator, not an advertiser
- Vary every reply — never use the same text twice
- Give SPECIFIC, actionable advice relevant to what they said
- For frustration: NO links, just be helpful
- If a tweet is ambiguous or not clearly about Roblox business, set to "skip"

${previousReplies.length > 0 ? `\nPREVIOUS REPLIES (do NOT repeat these):\n${previousReplies.map((r) => `- "${r}"`).join('\n')}` : ''}

Respond ONLY with valid JSON array:
[
  {
    "tweetId": "tweet_id",
    "category": "analytics_question",
    "replyDraft": "The reply text under 280 chars"
  }
]`,
    messages: [
      {
        role: 'user',
        content: `Classify these tweets and draft helpful replies:\n\n${tweetList}`,
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array in classification response');

  return JSON.parse(jsonMatch[0]) as ClassifiedTweet[];
}

// ─── Main Pipeline ──────────────────────────────────────────

export interface XOutreachResult {
  tweetsSearched: number;
  tweetsEligible: number;
  repliesPosted: number;
  skipped: number;
  errors: string[];
}

export async function runXOutreachPipeline(
  db: PrismaClient
): Promise<XOutreachResult> {
  const result: XOutreachResult = {
    tweetsSearched: 0,
    tweetsEligible: 0,
    repliesPosted: 0,
    skipped: 0,
    errors: [],
  };

  // Step 1 — Search for relevant tweets
  let tweets: SearchTweet[];
  let users: SearchUser[];
  try {
    const searchResult = await searchRecentTweets();
    tweets = searchResult.tweets;
    users = searchResult.users;
    result.tweetsSearched = tweets.length;
  } catch (err) {
    console.error('[XOutreach] Search failed:', err);
    result.errors.push(`Search failed: ${String(err)}`);
    return result;
  }

  if (tweets.length === 0) {
    console.log('[XOutreach] No tweets found');
    return result;
  }

  const userMap = new Map(users.map((u) => [u.id, u]));
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Step 2 — Filter tweets

  // Get our own user ID to skip self-tweets
  const devmaxxUser = users.find((u) => u.username.toLowerCase() === 'devmaxxapp');

  // Get already-replied tweet IDs from DB
  const existingLogs = await db.xOutreachLog.findMany({
    where: {
      tweetId: { in: tweets.map((t) => t.id) },
    },
    select: { tweetId: true },
  });
  const alreadyReplied = new Set(existingLogs.map((l) => l.tweetId));

  // Get recently replied author IDs (48 hour cooldown)
  const recentAuthorReplies = await db.xOutreachLog.findMany({
    where: {
      replyPosted: true,
      postedAt: { gte: fortyEightHoursAgo },
    },
    select: { authorId: true },
  });
  const recentlyRepliedAuthors = new Set(recentAuthorReplies.map((r) => r.authorId));

  // Check daily reply limit (max 5 per day)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  let repliesToday = await db.xOutreachLog.count({
    where: { replyPosted: true, postedAt: { gte: todayStart } },
  });

  console.log(`[XOutreach] Replies today so far: ${repliesToday}/5`);

  if (repliesToday >= 5) {
    console.log('[XOutreach] Daily reply limit reached (5/5) — skipping');
    result.skipped = tweets.length;
    return result;
  }

  // Get previous reply texts to avoid duplicates
  const previousReplyRows = await db.xOutreachLog.findMany({
    where: { replyPosted: true },
    select: { replyDrafted: true },
    orderBy: { postedAt: 'desc' },
    take: 20,
  });
  const previousReplies = previousReplyRows
    .map((r) => r.replyDrafted)
    .filter((r): r is string => r !== null);

  // Filter eligible tweets
  const eligibleTweets: Array<{
    tweet: SearchTweet;
    user: SearchUser;
  }> = [];

  for (const tweet of tweets) {
    const user = userMap.get(tweet.author_id);
    const username = user?.username ?? 'unknown';
    const followers = user?.public_metrics?.followers_count ?? 0;
    const createdAt = new Date(tweet.created_at);

    // Skip: self
    if (devmaxxUser && tweet.author_id === devmaxxUser.id) {
      console.log(`[XOutreach] Skipping ${tweet.id} — own tweet`);
      result.skipped++;
      continue;
    }

    // Skip: already replied
    if (alreadyReplied.has(tweet.id)) {
      console.log(`[XOutreach] Skipping ${tweet.id} — already processed`);
      result.skipped++;
      continue;
    }

    // Skip: too old (>6 hours)
    if (createdAt < sixHoursAgo) {
      console.log(`[XOutreach] Skipping ${tweet.id} — older than 6 hours`);
      result.skipped++;
      continue;
    }

    // Skip: low followers (<5)
    if (followers < 5) {
      console.log(`[XOutreach] Skipping ${tweet.id} by @${username} — ${followers} followers (min 5)`);
      result.skipped++;
      continue;
    }

    // Skip: already replied to this author in last 48 hours
    if (recentlyRepliedAuthors.has(tweet.author_id)) {
      console.log(`[XOutreach] Skipping ${tweet.id} — already replied to @${username} in last 48h`);
      result.skipped++;
      continue;
    }

    eligibleTweets.push({ tweet, user: user! });
  }

  result.tweetsEligible = eligibleTweets.length;
  console.log(`[XOutreach] ${eligibleTweets.length} tweets eligible for classification`);

  if (eligibleTweets.length === 0) {
    return result;
  }

  // Step 3 — Claude classifies and drafts replies
  const tweetsForClaude = eligibleTweets.map(({ tweet, user }) => ({
    id: tweet.id,
    text: tweet.text,
    username: user.username,
    followers: user.public_metrics?.followers_count ?? 0,
  }));

  let classified: ClassifiedTweet[];
  try {
    classified = await classifyAndDraftReplies(tweetsForClaude, previousReplies);
  } catch (err) {
    console.error('[XOutreach] Classification failed:', err);
    result.errors.push(`Classification failed: ${String(err)}`);
    return result;
  }

  console.log(`[XOutreach] Claude classified ${classified.length} tweets`);

  // Step 4 & 5 — Post replies with safety checks
  const replyableCategories = new Set<OutreachCategory>([
    'analytics_question',
    'monetization_help',
    'frustration',
    'milestone',
  ]);

  for (const item of classified) {
    const match = eligibleTweets.find(({ tweet }) => tweet.id === item.tweetId);
    if (!match) continue;

    const { tweet, user } = match;
    const username = user.username;

    // Log every classification to DB
    const logEntry = await db.xOutreachLog.create({
      data: {
        tweetId: tweet.id,
        authorId: tweet.author_id,
        authorUsername: username,
        tweetContent: tweet.text,
        category: item.category,
        replyDrafted: item.replyDraft,
        replyPosted: false,
        tweetUrl: `https://x.com/${username}/status/${tweet.id}`,
      },
    });

    // Skip categories that shouldn't get replies
    if (item.category === 'skip' || item.category === 'general_roblox') {
      console.log(`[XOutreach] Skipping ${tweet.id} — category: ${item.category}`);
      result.skipped++;
      continue;
    }

    // Must be replyable category with a draft
    if (!replyableCategories.has(item.category) || !item.replyDraft) {
      result.skipped++;
      continue;
    }

    // Enforce 280 char limit
    if (item.replyDraft.length > 280) {
      console.log(`[XOutreach] Skipping reply to ${tweet.id} — draft exceeds 280 chars (${item.replyDraft.length})`);
      result.skipped++;
      continue;
    }

    // Check daily limit again (in case we hit it during this batch)
    if (repliesToday >= 5) {
      console.log(`[XOutreach] Daily limit reached — skipping remaining`);
      result.skipped++;
      continue;
    }

    // Check for duplicate reply text
    if (previousReplies.includes(item.replyDraft)) {
      console.log(`[XOutreach] Skipping reply to ${tweet.id} — duplicate text`);
      result.skipped++;
      continue;
    }

    // Post the reply
    try {
      console.log(`[XOutreach] Replying to @${username} (${item.category}): "${item.replyDraft.slice(0, 60)}..."`);
      const replyResult = await postReply(item.replyDraft, tweet.id);

      if (replyResult.success) {
        const replyUrl = replyResult.tweetId
          ? `https://x.com/devmaxxapp/status/${replyResult.tweetId}`
          : null;

        await db.xOutreachLog.update({
          where: { id: logEntry.id },
          data: {
            replyPosted: true,
            postedAt: new Date(),
            replyUrl,
          },
        });

        result.repliesPosted++;
        repliesToday++;
        recentlyRepliedAuthors.add(tweet.author_id);
        previousReplies.push(item.replyDraft);

        console.log(`[XOutreach] SUCCESS — replied to @${username}: ${replyUrl ?? replyResult.tweetId}`);
      } else {
        console.error(`[XOutreach] Failed to reply to @${username}: ${replyResult.error}`);
        result.errors.push(`Reply to @${username} failed: ${replyResult.error}`);
      }
    } catch (err) {
      console.error(`[XOutreach] Error replying to @${username}:`, err);
      result.errors.push(`Reply to @${username} error: ${String(err)}`);
    }
  }

  console.log(
    `[XOutreach] Complete — searched: ${result.tweetsSearched}, eligible: ${result.tweetsEligible}, replied: ${result.repliesPosted}, skipped: ${result.skipped}`
  );

  return result;
}
