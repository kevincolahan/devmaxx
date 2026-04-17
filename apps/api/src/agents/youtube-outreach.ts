import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
}

interface YouTubeVideoStats {
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

interface ClassifiedVideo {
  videoId: string;
  commentDraft: string | null;
  qualityScore: number;
  reasoning: string;
}

// ─── Google OAuth 2.0 Token Refresh ─────────────────────────

async function getAccessToken(): Promise<string> {
  const clientId = (process.env.YOUTUBE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.YOUTUBE_CLIENT_SECRET || '').trim();
  const refreshToken = (process.env.YOUTUBE_REFRESH_TOKEN || '').trim();

  if (!clientId || !clientSecret || !refreshToken) {
    const missing = [
      !clientId && 'YOUTUBE_CLIENT_ID',
      !clientSecret && 'YOUTUBE_CLIENT_SECRET',
      !refreshToken && 'YOUTUBE_REFRESH_TOKEN',
    ].filter(Boolean);
    throw new Error(`Missing YouTube credentials: ${missing.join(', ')}`);
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google OAuth token refresh failed ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ─── YouTube Data API v3 ────────────────────────────────────

async function searchVideos(accessToken: string): Promise<YouTubeVideo[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    part: 'snippet',
    q: 'roblox devex 2026 OR roblox monetization OR roblox game revenue OR roblox analytics',
    type: 'video',
    order: 'date',
    publishedAfter: sevenDaysAgo.toISOString(),
    maxResults: '10',
    relevanceLanguage: 'en',
  });

  console.log(`[YTOutreach] Searching videos: ${params.get('q')?.slice(0, 60)}...`);

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube search API ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    items?: Array<{
      id: { videoId: string };
      snippet: {
        title: string;
        description: string;
        channelId: string;
        channelTitle: string;
        publishedAt: string;
      };
    }>;
  };

  const videos: YouTubeVideo[] = (data.items ?? []).map((item) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
  }));

  console.log(`[YTOutreach] Search returned ${videos.length} videos`);
  return videos;
}

async function getVideoStats(
  accessToken: string,
  videoIds: string[]
): Promise<Map<string, YouTubeVideoStats>> {
  const params = new URLSearchParams({
    part: 'statistics',
    id: videoIds.join(','),
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube videos API ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      statistics: {
        viewCount: string;
        likeCount: string;
        commentCount: string;
      };
    }>;
  };

  const stats = new Map<string, YouTubeVideoStats>();
  for (const item of data.items ?? []) {
    stats.set(item.id, {
      viewCount: parseInt(item.statistics.viewCount) || 0,
      likeCount: parseInt(item.statistics.likeCount) || 0,
      commentCount: parseInt(item.statistics.commentCount) || 0,
    });
  }

  return stats;
}

async function postComment(
  accessToken: string,
  videoId: string,
  text: string
): Promise<{ success: boolean; commentId?: string; error?: string }> {
  console.log(`[YTOutreach] Posting comment on ${videoId} (${text.length} chars)`);

  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/commentThreads?part=snippet',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          videoId,
          topLevelComment: {
            snippet: {
              textOriginal: text,
            },
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`[YTOutreach] Comment failed ${res.status}: ${body}`);
    return { success: false, error: `YouTube API ${res.status}: ${body}` };
  }

  const data = (await res.json()) as { id?: string };
  console.log(`[YTOutreach] Comment posted: ${data.id}`);
  return { success: true, commentId: data.id };
}

// ─── Claude Analysis + Comment Drafting ─────────────────────

async function analyzeAndDraftComments(
  videos: Array<{
    id: string;
    title: string;
    description: string;
    channelTitle: string;
    viewCount: number;
  }>,
  previousComments: string[]
): Promise<ClassifiedVideo[]> {
  const client = new Anthropic();

  const videoList = videos
    .map(
      (v, i) =>
        `[${i}] "${v.title}" by ${v.channelTitle} (${v.viewCount.toLocaleString()} views)\nDescription: ${v.description.slice(0, 200)}\nvideo_id: ${v.id}`
    )
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a Roblox game monetization expert who genuinely helps creators. You comment on YouTube videos about Roblox development, DevEx, and monetization with real, helpful advice.

Your goal: leave a comment that adds genuine value to the conversation AND naturally mentions devmaxx.app.

COMMENT STRUCTURE (max 3 sentences):
1. First sentence: Genuinely helpful advice or insight directly related to the video topic. Reference something specific from the title/description.
2. Second sentence: Expand on the advice with a concrete, actionable tip.
3. Third sentence (optional): Naturally mention devmaxx.app as a tool that helps with this, phrased as "I built a tool that..." or "devmaxx.app automates this if..." — NOT "check out" or "visit" or "click".

CRITICAL RULES:
- Must feel like a real human comment, not spam
- First sentence MUST be about the video content, not about Devmaxx
- No emojis unless the video title uses them
- No spammy phrases: "check out", "visit", "click", "amazing video", "great content"
- Include devmaxx.app link naturally (not as a CTA)
- Be specific to what the video is about — generic comments get flagged as spam
- Rate your own comment 1-10 on quality:
  - 9-10: Genuinely adds to the discussion, comment section would welcome it
  - 7-8: Helpful but slightly generic
  - 5-6: Feels a bit forced or promotional
  - 1-4: Spam territory, do not post
- Only return comments rated 8+

${previousComments.length > 0 ? `\nPREVIOUS COMMENTS (vary your approach, never repeat):\n${previousComments.map((c) => `- "${c}"`).join('\n')}` : ''}

Respond ONLY with valid JSON array:
[
  {
    "videoId": "video_id",
    "commentDraft": "The comment text or null if not worth commenting",
    "qualityScore": 9,
    "reasoning": "Why this comment adds value / why skipping"
  }
]`,
    messages: [
      {
        role: 'user',
        content: `Analyze these Roblox videos and draft helpful comments:\n\n${videoList}`,
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array in classification response');

  return JSON.parse(jsonMatch[0]) as ClassifiedVideo[];
}

// ─── Main Pipeline ──────────────────────────────────────────

export interface YouTubeOutreachResult {
  videosSearched: number;
  videosEligible: number;
  commentsPosted: number;
  skipped: number;
  errors: string[];
}

export async function runYouTubeOutreachPipeline(
  db: PrismaClient
): Promise<YouTubeOutreachResult> {
  const result: YouTubeOutreachResult = {
    videosSearched: 0,
    videosEligible: 0,
    commentsPosted: 0,
    skipped: 0,
    errors: [],
  };

  // Get access token
  let accessToken: string;
  try {
    accessToken = await getAccessToken();
    console.log('[YTOutreach] OAuth token refreshed');
  } catch (err) {
    console.error('[YTOutreach] Token refresh failed:', err);
    result.errors.push(`Token refresh failed: ${String(err)}`);
    return result;
  }

  // Step 1 — Search for relevant videos
  let videos: YouTubeVideo[];
  try {
    videos = await searchVideos(accessToken);
    result.videosSearched = videos.length;
  } catch (err) {
    console.error('[YTOutreach] Search failed:', err);
    result.errors.push(`Search failed: ${String(err)}`);
    return result;
  }

  if (videos.length === 0) {
    console.log('[YTOutreach] No videos found');
    return result;
  }

  // Get video stats for view count filtering
  let statsMap: Map<string, YouTubeVideoStats>;
  try {
    statsMap = await getVideoStats(
      accessToken,
      videos.map((v) => v.id)
    );
  } catch (err) {
    console.error('[YTOutreach] Stats fetch failed:', err);
    result.errors.push(`Stats fetch failed: ${String(err)}`);
    return result;
  }

  // Step 2 — Filter videos
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get already-commented video IDs
  const existingLogs = await db.youTubeOutreachLog.findMany({
    where: { videoId: { in: videos.map((v) => v.id) } },
    select: { videoId: true },
  });
  const alreadyCommented = new Set(existingLogs.map((l) => l.videoId));

  // Get channels we've commented on in last 30 days
  const recentChannelComments = await db.youTubeOutreachLog.findMany({
    where: {
      commentPosted: true,
      postedAt: { gte: thirtyDaysAgo },
    },
    select: { channelId: true },
  });
  const recentlyCommentedChannels = new Set(
    recentChannelComments.map((r) => r.channelId)
  );

  // Check weekly comment limit (max 3 per week)
  const weekStart = new Date();
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
  weekStart.setUTCHours(0, 0, 0, 0);
  let commentsThisWeek = await db.youTubeOutreachLog.count({
    where: { commentPosted: true, postedAt: { gte: weekStart } },
  });

  console.log(`[YTOutreach] Comments this week: ${commentsThisWeek}/3`);

  if (commentsThisWeek >= 3) {
    console.log('[YTOutreach] Weekly comment limit reached (3/3) — skipping');
    result.skipped = videos.length;
    return result;
  }

  // Get previous comment texts to avoid duplicates
  const previousCommentRows = await db.youTubeOutreachLog.findMany({
    where: { commentPosted: true },
    select: { commentDrafted: true },
    orderBy: { postedAt: 'desc' },
    take: 15,
  });
  const previousComments = previousCommentRows
    .map((r) => r.commentDrafted)
    .filter((c): c is string => c !== null);

  // Our own channel ID to skip
  const ownChannelId = (process.env.YOUTUBE_CHANNEL_ID || '').trim();

  // Roblox official channels to skip
  const officialChannels = new Set([
    'UCjiPEaapiHbkclEvguPjMng', // Roblox official
    'UC0Tod_JfpxjNfZEXMoWB_aQ', // Roblox Developer
  ]);

  const eligibleVideos: Array<{
    video: YouTubeVideo;
    stats: YouTubeVideoStats;
  }> = [];

  for (const video of videos) {
    const stats = statsMap.get(video.id);

    // Skip: already commented
    if (alreadyCommented.has(video.id)) {
      console.log(`[YTOutreach] Skipping ${video.id} — already processed`);
      result.skipped++;
      continue;
    }

    // Skip: too old
    if (new Date(video.publishedAt) < sevenDaysAgo) {
      console.log(`[YTOutreach] Skipping ${video.id} — older than 7 days`);
      result.skipped++;
      continue;
    }

    // Skip: too few views
    if (stats && stats.viewCount < 100) {
      console.log(
        `[YTOutreach] Skipping ${video.id} "${video.title}" — ${stats.viewCount} views (min 100)`
      );
      result.skipped++;
      continue;
    }

    // Skip: Roblox official channels
    if (officialChannels.has(video.channelId)) {
      console.log(`[YTOutreach] Skipping ${video.id} — Roblox official channel`);
      result.skipped++;
      continue;
    }

    // Skip: own channel
    if (ownChannelId && video.channelId === ownChannelId) {
      console.log(`[YTOutreach] Skipping ${video.id} — own channel`);
      result.skipped++;
      continue;
    }

    // Skip: already commented on this channel in last 30 days
    if (recentlyCommentedChannels.has(video.channelId)) {
      console.log(
        `[YTOutreach] Skipping ${video.id} — commented on ${video.channelTitle} in last 30 days`
      );
      result.skipped++;
      continue;
    }

    eligibleVideos.push({ video, stats: stats ?? { viewCount: 0, likeCount: 0, commentCount: 0 } });
  }

  result.videosEligible = eligibleVideos.length;
  console.log(`[YTOutreach] ${eligibleVideos.length} videos eligible for analysis`);

  if (eligibleVideos.length === 0) {
    return result;
  }

  // Step 3 — Claude analyzes and drafts comments
  const videosForClaude = eligibleVideos.map(({ video, stats }) => ({
    id: video.id,
    title: video.title,
    description: video.description,
    channelTitle: video.channelTitle,
    viewCount: stats.viewCount,
  }));

  let classified: ClassifiedVideo[];
  try {
    classified = await analyzeAndDraftComments(videosForClaude, previousComments);
  } catch (err) {
    console.error('[YTOutreach] Classification failed:', err);
    result.errors.push(`Classification failed: ${String(err)}`);
    return result;
  }

  console.log(`[YTOutreach] Claude analyzed ${classified.length} videos`);

  // Step 4 & 5 — Post comments with safety checks
  for (const item of classified) {
    const match = eligibleVideos.find(({ video }) => video.id === item.videoId);
    if (!match) continue;

    const { video, stats } = match;

    // Log every classification to DB
    const logEntry = await db.youTubeOutreachLog.create({
      data: {
        videoId: video.id,
        channelId: video.channelId,
        videoTitle: video.title,
        commentDrafted: item.commentDraft,
        qualityScore: item.qualityScore,
        commentPosted: false,
      },
    });

    // Quality gate: only post 8+
    if (item.qualityScore < 8) {
      console.log(
        `[YTOutreach] Skipping ${video.id} — quality ${item.qualityScore}/10 (min 8): ${item.reasoning}`
      );
      result.skipped++;
      continue;
    }

    // No draft
    if (!item.commentDraft) {
      console.log(`[YTOutreach] Skipping ${video.id} — no draft: ${item.reasoning}`);
      result.skipped++;
      continue;
    }

    // Check weekly limit again
    if (commentsThisWeek >= 3) {
      console.log('[YTOutreach] Weekly limit reached — skipping remaining');
      result.skipped++;
      continue;
    }

    // Check for duplicate comment text
    if (previousComments.includes(item.commentDraft)) {
      console.log(`[YTOutreach] Skipping ${video.id} — duplicate comment text`);
      result.skipped++;
      continue;
    }

    // Check for spammy phrases
    const spamPhrases = ['check out', 'visit', 'click', 'subscribe to'];
    const lowerDraft = item.commentDraft.toLowerCase();
    const hasSpam = spamPhrases.some((phrase) => lowerDraft.includes(phrase));
    if (hasSpam) {
      console.log(
        `[YTOutreach] Skipping ${video.id} — draft contains spammy phrase`
      );
      result.skipped++;
      continue;
    }

    // Post the comment
    try {
      console.log(
        `[YTOutreach] Commenting on "${video.title}" by ${video.channelTitle} (${stats.viewCount} views, quality ${item.qualityScore}/10)`
      );
      const commentResult = await postComment(
        accessToken,
        video.id,
        item.commentDraft
      );

      if (commentResult.success) {
        const commentUrl = `https://www.youtube.com/watch?v=${video.id}&lc=${commentResult.commentId}`;

        await db.youTubeOutreachLog.update({
          where: { id: logEntry.id },
          data: {
            commentPosted: true,
            postedAt: new Date(),
            commentUrl,
          },
        });

        // Store in KeyValue for quick lookup
        await db.keyValue.upsert({
          where: { key: `yt_commented_${video.id}` },
          update: { value: new Date().toISOString() },
          create: {
            key: `yt_commented_${video.id}`,
            value: new Date().toISOString(),
          },
        });

        result.commentsPosted++;
        commentsThisWeek++;
        recentlyCommentedChannels.add(video.channelId);
        previousComments.push(item.commentDraft);

        console.log(
          `[YTOutreach] SUCCESS — commented on "${video.title}": ${commentUrl}`
        );
      } else {
        console.error(
          `[YTOutreach] Failed to comment on "${video.title}": ${commentResult.error}`
        );
        result.errors.push(
          `Comment on "${video.title}" failed: ${commentResult.error}`
        );
      }
    } catch (err) {
      console.error(
        `[YTOutreach] Error commenting on "${video.title}":`,
        err
      );
      result.errors.push(
        `Comment on "${video.title}" error: ${String(err)}`
      );
    }
  }

  console.log(
    `[YTOutreach] Complete — searched: ${result.videosSearched}, eligible: ${result.videosEligible}, commented: ${result.commentsPosted}, skipped: ${result.skipped}`
  );

  return result;
}
