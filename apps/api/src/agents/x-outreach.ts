import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

// ─── Vercel Proxy Config ────────────────────────────────────

const VERCEL_BASE = 'https://www.devmaxx.app';
const CRON_SECRET = (process.env.CRON_SECRET || '').trim();

function proxyHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${CRON_SECRET}`,
  };
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

// ─── Twitter Search (via Vercel proxy) ──────────────────────

async function searchRecentTweets(): Promise<{
  tweets: SearchTweet[];
  users: SearchUser[];
}> {
  const query = '(roblox devex OR roblox monetization OR roblox analytics OR roblox game revenue OR roblox creator economy) -is:retweet -is:reply lang:en';

  const params = new URLSearchParams({
    query,
    max_results: '50',
  });

  console.log(`[XOutreach] Searching tweets via Vercel proxy`);

  const res = await fetch(`${VERCEL_BASE}/api/twitter/search?${params}`, {
    headers: proxyHeaders(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitter search proxy ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    tweets: SearchTweet[];
    users: SearchUser[];
    meta?: { result_count: number };
  };

  console.log(`[XOutreach] Search returned ${data.meta?.result_count ?? 0} tweets`);

  return {
    tweets: data.tweets ?? [],
    users: data.users ?? [],
  };
}

// ─── Quote Tweet (via Vercel proxy) ──────────────────────────

async function postQuoteTweet(
  text: string,
  quoteTweetId: string
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  const url = `${VERCEL_BASE}/api/twitter/reply`;
  const payload = { text, quoteTweetId };

  console.log(`[XOutreach] postQuoteTweet() → POST ${url}`);
  console.log(`[XOutreach] postQuoteTweet() payload: ${JSON.stringify(payload)}`);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: proxyHeaders(),
      body: JSON.stringify(payload),
    });
  } catch (fetchErr) {
    console.error(`[XOutreach] postQuoteTweet() fetch exception:`, fetchErr);
    return { success: false, error: `Fetch failed: ${String(fetchErr)}` };
  }

  const body = await res.text();
  console.log(`[XOutreach] postQuoteTweet() response: status=${res.status} body=${body.slice(0, 500)}`);

  if (!res.ok) {
    return { success: false, error: `Quote proxy ${res.status}: ${body}` };
  }

  let data: { success?: boolean; tweetId?: string; error?: string };
  try {
    data = JSON.parse(body);
  } catch {
    return { success: false, error: `Invalid JSON response: ${body.slice(0, 200)}` };
  }

  if (!data.success) {
    return { success: false, error: data.error ?? `Proxy returned success=false: ${body.slice(0, 200)}` };
  }

  return { success: true, tweetId: data.tweetId };
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
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are Kevin Colahan — founder of Devmaxx (devmaxx.app), a Roblox creator yourself. You're writing QUOTE TWEETS (not replies) that add value to the original tweet. The original tweet will appear embedded below your text automatically.

IMPORTANT: These are QUOTE TWEETS. Your text must be self-contained commentary that makes sense on its own, with the quoted tweet visible below. Don't address the author directly with "you" — write it as if sharing their tweet with your audience and adding insight.

CLASSIFY each tweet into one of these categories:
- "analytics_question": asking how to track metrics, DAU, retention, etc.
- "monetization_help": asking about pricing, DevEx, revenue optimization
- "frustration": struggling with revenue, metrics, or game growth
- "milestone": celebrating earnings, player counts, or achievements
- "general_roblox": general Roblox creator content, not specifically about business
- "skip": spam, bots, irrelevant, or not worth quote tweeting

VOICE — how Kevin sounds:
- Casual, direct, no filler. Like sharing a take with your followers.
- Uses short sentences. Gets to the point.
- Shares real tactical advice, not generic "keep grinding" stuff.
- Never uses emoji. No 🎮 📊 🚀 ever.
- Sounds like someone who has been in the trenches, not a marketer.

QUOTE TWEET STYLE EXAMPLES:

"This is the part most Roblox devs skip. D1 retention above 20% before you even think about monetization."

"Real talk — A/B testing game pass prices is the single highest-ROI thing a solo creator can do. Most never try it."

"Congrats to this creator. Hitting consistent DevEx is harder than people think."

"Retention is the silent killer. If your D1 is under 15%, no amount of marketing fixes it."

PRODUCT MENTION RULES:
- Only 40% of quote tweets should mention devmaxx.app. The other 60% should be purely insightful.
- When mentioning, weave naturally: "This is exactly why I built devmaxx.app — most creators don't track this."
- NEVER mention devmaxx.app for milestone or frustration tweets. Just be human.

CATEGORY GUIDELINES:

milestone: Genuine congrats framed for your audience. "Love seeing this. The grind is real and it pays off."

analytics_question: Share your take on the right approach. ~40% mention devmaxx.app.

monetization_help: Give a concrete tactical take. ~40% mention devmaxx.app.

frustration: Empathetic insight. NEVER mention devmaxx.app. Just share what works.

general_roblox: Set to "skip" unless directly about analytics/monetization.

CRITICAL RULES:
- Keep ALL text under 260 characters (quote tweets need room for the embed)
- NO emoji anywhere
- Vary every quote tweet — never use the same phrasing twice
- Give SPECIFIC insight relevant to the original tweet
- If a tweet is ambiguous or not clearly about Roblox business, set to "skip"
- Write as commentary for your followers, not a direct reply to the author

${previousReplies.length > 0 ? `\nPREVIOUS QUOTE TWEETS (do NOT repeat these or use similar phrasing):\n${previousReplies.map((r) => `- "${r}"`).join('\n')}` : ''}

Respond ONLY with valid JSON array:
[
  {
    "tweetId": "tweet_id",
    "category": "analytics_question",
    "replyDraft": "The quote tweet text under 260 chars"
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
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

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

    // Skip: too old (>48 hours)
    if (createdAt < fortyEightHoursAgo) {
      console.log(`[XOutreach] Skipping ${tweet.id} — older than 48 hours`);
      result.skipped++;
      continue;
    }

    // Skip: low followers (<1)
    if (followers < 1) {
      console.log(`[XOutreach] Skipping ${tweet.id} by @${username} — ${followers} followers (min 1)`);
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

  console.log(`[XOutreach] Claude classified ${classified.length} tweets:`);
  for (const item of classified) {
    console.log(`[XOutreach]   tweet=${item.tweetId} category=${item.category} draft=${item.replyDraft ? `"${item.replyDraft.slice(0, 60)}..." (${item.replyDraft.length} chars)` : 'null'}`);
  }

  // Step 4 & 5 — Post replies with safety checks
  const replyableCategories = new Set<OutreachCategory>([
    'analytics_question',
    'monetization_help',
    'frustration',
    'milestone',
  ]);

  for (const item of classified) {
    const match = eligibleTweets.find(({ tweet }) => tweet.id === item.tweetId);
    if (!match) {
      console.log(`[XOutreach] Skipping ${item.tweetId} — no match in eligible tweets`);
      continue;
    }

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
      console.log(`[XOutreach] Skipping ${tweet.id} by @${username} — category: ${item.category}`);
      result.skipped++;
      continue;
    }

    // Must be replyable category with a draft
    if (!replyableCategories.has(item.category)) {
      console.log(`[XOutreach] Skipping ${tweet.id} by @${username} — category "${item.category}" not in replyable set`);
      result.skipped++;
      continue;
    }
    if (!item.replyDraft) {
      console.log(`[XOutreach] Skipping ${tweet.id} by @${username} — no reply draft`);
      result.skipped++;
      continue;
    }

    // Enforce 260 char limit (quote tweets need room for embed)
    if (item.replyDraft.length > 260) {
      console.log(`[XOutreach] Skipping quote tweet for ${tweet.id} by @${username} — draft exceeds 260 chars (${item.replyDraft.length})`);
      result.skipped++;
      continue;
    }

    // Check daily limit again (in case we hit it during this batch)
    if (repliesToday >= 5) {
      console.log(`[XOutreach] Daily limit reached (${repliesToday}/5) — skipping @${username}`);
      result.skipped++;
      continue;
    }

    // Check for duplicate reply text
    if (previousReplies.includes(item.replyDraft)) {
      console.log(`[XOutreach] Skipping reply to ${tweet.id} by @${username} — duplicate text`);
      result.skipped++;
      continue;
    }

    // Post the reply
    try {
      console.log(`[XOutreach] >>> POSTING QUOTE TWEET about @${username} (${item.category})`);
      console.log(`[XOutreach]     tweet_id: ${tweet.id}`);
      console.log(`[XOutreach]     draft: "${item.replyDraft}"`);

      const quoteResult = await postQuoteTweet(item.replyDraft, tweet.id);

      console.log(`[XOutreach]     result: success=${quoteResult.success} tweetId=${quoteResult.tweetId ?? 'none'} error=${quoteResult.error ?? 'none'}`);

      if (quoteResult.success) {
        const quoteUrl = quoteResult.tweetId
          ? `https://x.com/devmaxxapp/status/${quoteResult.tweetId}`
          : null;

        await db.xOutreachLog.update({
          where: { id: logEntry.id },
          data: {
            replyPosted: true,
            postedAt: new Date(),
            replyUrl: quoteUrl,
          },
        });

        result.repliesPosted++;
        repliesToday++;
        recentlyRepliedAuthors.add(tweet.author_id);
        previousReplies.push(item.replyDraft);

        console.log(`[XOutreach] SUCCESS — quote tweeted about @${username}: ${quoteUrl ?? quoteResult.tweetId}`);
      } else {
        console.error(`[XOutreach] FAILED to quote tweet about @${username}: ${quoteResult.error}`);
        result.errors.push(`Quote tweet about @${username} failed: ${quoteResult.error}`);
      }
    } catch (err) {
      console.error(`[XOutreach] EXCEPTION quote tweeting about @${username}:`, err);
      result.errors.push(`Quote tweet about @${username} error: ${String(err)}`);
    }
  }

  console.log(
    `[XOutreach] Complete — searched: ${result.tweetsSearched}, eligible: ${result.tweetsEligible}, replied: ${result.repliesPosted}, skipped: ${result.skipped}`
  );

  return result;
}
