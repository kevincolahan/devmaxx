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

function buildAuthorizationHeader(
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

  // For GET requests, include query params in signature base
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

// ─── Twitter API helpers ────────────────────────────────────

interface TwitterMention {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
}

interface TwitterUser {
  id: string;
  username: string;
  public_metrics?: {
    followers_count: number;
  };
}

async function getTwitterUserId(): Promise<string> {
  const userId = (process.env.TWITTER_USER_ID || '').trim();
  if (userId) return userId;

  // Look up by username
  const url = 'https://api.twitter.com/2/users/by/username/devmaxxapp';
  const auth = buildAuthorizationHeader('GET', url);

  const res = await fetch(url, {
    headers: { Authorization: auth },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to look up Twitter user: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { data?: { id: string } };
  if (!data.data?.id) throw new Error('Twitter user lookup returned no data');

  console.log(`[MentionsAgent] Resolved @devmaxxapp → user ID: ${data.data.id}`);
  return data.data.id;
}

async function fetchMentions(
  userId: string,
  sinceId?: string
): Promise<{ mentions: TwitterMention[]; users: TwitterUser[] }> {
  const baseUrl = `https://api.twitter.com/2/users/${userId}/mentions`;
  const params: Record<string, string> = {
    max_results: '20',
    'tweet.fields': 'created_at,author_id',
    'user.fields': 'username,public_metrics',
    expansions: 'author_id',
  };
  if (sinceId) params.since_id = sinceId;

  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const auth = buildAuthorizationHeader('GET', baseUrl, params);

  const res = await fetch(`${baseUrl}?${queryString}`, {
    headers: { Authorization: auth },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitter mentions API ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    data?: TwitterMention[];
    includes?: { users?: TwitterUser[] };
  };

  return {
    mentions: data.data ?? [],
    users: data.includes?.users ?? [],
  };
}

async function postReply(text: string, inReplyToId: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  const url = 'https://api.twitter.com/2/tweets';
  const auth = buildAuthorizationHeader('POST', url);

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
    return { success: false, error: `Twitter API ${res.status}: ${body}` };
  }

  const data = (await res.json()) as { data?: { id: string } };
  return { success: true, tweetId: data.data?.id };
}

// ─── Claude classification + reply drafting ─────────────────

interface ClassifiedMention {
  mentionId: string;
  category: 'question' | 'positive' | 'roblox_help' | 'negative' | 'irrelevant' | 'reply_needed';
  replyDraft: string | null;
}

async function classifyAndDraftReplies(
  mentions: Array<{ id: string; text: string; username: string }>
): Promise<ClassifiedMention[]> {
  const client = new Anthropic();

  const mentionsList = mentions
    .map((m, i) => `[${i}] @${m.username}: "${m.text}" (tweet_id: ${m.id})`)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20251001',
    max_tokens: 2048,
    system: `You are the social media manager for Devmaxx (devmaxx.app), an AI-powered business platform for Roblox game creators.

Classify each mention and draft replies where appropriate.

Categories:
- "question" — asking about Devmaxx features, pricing, how it works
- "positive" — compliment, excited mention, sharing Devmaxx
- "roblox_help" — creator asking about Roblox business (pricing, analytics, DevEx)
- "negative" — complaint or criticism about Devmaxx
- "irrelevant" — spam, bots, unrelated mentions
- "reply_needed" — direct question needing a specific response

Draft reply rules:
- Keep under 280 characters
- Be helpful, friendly, not salesy
- For questions: answer specifically, link devmaxx.app if relevant
- For positive: thank warmly, suggest they check out a specific feature
- For roblox_help: give genuine advice, mention Devmaxx naturally
- For negative: DO NOT draft a reply (set to null)
- For irrelevant: DO NOT draft a reply (set to null)
- Never be defensive. Never argue.
- Social handles: @devmaxxapp

Respond ONLY with valid JSON array:
[
  {
    "mentionId": "tweet_id",
    "category": "question",
    "replyDraft": "Thanks for asking! Devmaxx automates pricing optimization for Roblox creators. Free tier available at devmaxx.app"
  }
]`,
    messages: [
      {
        role: 'user',
        content: `Classify these mentions of @devmaxxapp and draft replies:\n\n${mentionsList}`,
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array in classification response');

  return JSON.parse(jsonMatch[0]) as ClassifiedMention[];
}

// ─── Main pipeline ──────────────────────────────────────────

export async function runMentionsResponsePipeline(
  db: PrismaClient
): Promise<{
  mentionsProcessed: number;
  repliesPosted: number;
  flaggedNegative: number;
}> {
  console.log('[MentionsAgent] Starting mentions scan');

  // Get Twitter user ID
  let userId: string;
  try {
    userId = await getTwitterUserId();
  } catch (err) {
    console.error('[MentionsAgent] Failed to get user ID:', err);
    return { mentionsProcessed: 0, repliesPosted: 0, flaggedNegative: 0 };
  }

  // Get last processed mention ID
  const lastIdRow = await db.keyValue.findUnique({ where: { key: 'last_mention_id' } });
  const sinceId = lastIdRow?.value;

  // Fetch new mentions
  let mentions: TwitterMention[];
  let users: TwitterUser[];
  try {
    const result = await fetchMentions(userId, sinceId);
    mentions = result.mentions;
    users = result.users;
  } catch (err) {
    console.error('[MentionsAgent] Failed to fetch mentions:', err);
    return { mentionsProcessed: 0, repliesPosted: 0, flaggedNegative: 0 };
  }

  if (mentions.length === 0) {
    console.log('[MentionsAgent] No new mentions');
    return { mentionsProcessed: 0, repliesPosted: 0, flaggedNegative: 0 };
  }

  console.log(`[MentionsAgent] Found ${mentions.length} new mentions`);

  // Build user lookup
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Check which mentions we've already processed
  const existingIds = new Set(
    (await db.mentionLog.findMany({
      where: { mentionId: { in: mentions.map((m) => m.id) } },
      select: { mentionId: true },
    })).map((m) => m.mentionId)
  );

  const newMentions = mentions.filter((m) => !existingIds.has(m.id));
  if (newMentions.length === 0) {
    console.log('[MentionsAgent] All mentions already processed');
    return { mentionsProcessed: 0, repliesPosted: 0, flaggedNegative: 0 };
  }

  // Classify with Claude
  const mentionsForClaude = newMentions.map((m) => ({
    id: m.id,
    text: m.text,
    username: userMap.get(m.author_id)?.username ?? 'unknown',
  }));

  let classified: ClassifiedMention[];
  try {
    classified = await classifyAndDraftReplies(mentionsForClaude);
  } catch (err) {
    console.error('[MentionsAgent] Classification failed:', err);
    return { mentionsProcessed: 0, repliesPosted: 0, flaggedNegative: 0 };
  }

  // Check daily reply count
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let repliesToday = await db.mentionLog.count({
    where: { replyPosted: true, processedAt: { gte: today } },
  });

  // Check which users we've replied to in the last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentRepliedUsers = new Set(
    (await db.mentionLog.findMany({
      where: { replyPosted: true, processedAt: { gte: oneDayAgo } },
      select: { authorUsername: true },
    })).map((m) => m.authorUsername)
  );

  let repliesPosted = 0;
  let flaggedNegative = 0;
  const autoReplyCategories = new Set(['question', 'positive', 'roblox_help', 'reply_needed']);

  for (const item of classified) {
    const mention = newMentions.find((m) => m.id === item.mentionId);
    if (!mention) continue;

    const user = userMap.get(mention.author_id);
    const username = user?.username ?? 'unknown';
    const followers = user?.public_metrics?.followers_count ?? 0;

    if (item.category === 'negative') flaggedNegative++;

    // Store in DB
    const logEntry = await db.mentionLog.create({
      data: {
        mentionId: mention.id,
        authorId: mention.author_id,
        authorUsername: username,
        authorFollowers: followers,
        content: mention.text,
        category: item.category,
        replyDrafted: item.replyDraft,
      },
    });

    // Auto-post reply if eligible
    const shouldAutoReply =
      autoReplyCategories.has(item.category) &&
      item.replyDraft &&
      item.replyDraft.length <= 280 &&
      repliesToday < 10 &&
      !recentRepliedUsers.has(username) &&
      followers > 0;

    if (shouldAutoReply && item.replyDraft) {
      try {
        const result = await postReply(item.replyDraft, mention.id);
        if (result.success) {
          await db.mentionLog.update({
            where: { id: logEntry.id },
            data: { replyPosted: true, replyTweetId: result.tweetId },
          });
          repliesPosted++;
          repliesToday++;
          recentRepliedUsers.add(username);
          console.log(`[MentionsAgent] Replied to @${username} (${item.category}): ${result.tweetId}`);
        } else {
          console.error(`[MentionsAgent] Failed to reply to @${username}: ${result.error}`);
        }
      } catch (err) {
        console.error(`[MentionsAgent] Reply error for @${username}:`, err);
      }
    }
  }

  // Update last processed ID (highest ID = most recent)
  const maxId = newMentions.reduce((max, m) => (m.id > max ? m.id : max), sinceId ?? '0');
  await db.keyValue.upsert({
    where: { key: 'last_mention_id' },
    update: { value: maxId },
    create: { key: 'last_mention_id', value: maxId },
  });

  console.log(`[MentionsAgent] Done — processed: ${newMentions.length}, replied: ${repliesPosted}, flagged: ${flaggedNegative}`);

  return {
    mentionsProcessed: newMentions.length,
    repliesPosted,
    flaggedNegative,
  };
}
