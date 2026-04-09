import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────

interface FeatureInput {
  featureName: string;
  description: string;
  url: string;
  type: 'tool' | 'feature' | 'improvement';
}

interface GeneratedPost {
  platform: string;
  content: string;
  qualityScore: number;
}

interface AnnouncementResult {
  featureName: string;
  postsGenerated: number;
  posts: Array<{ platform: string; contentPieceId: string; content: string }>;
}

// ─── FEATURES.md Parser ─────────────────────────────────────

interface ParsedFeature {
  name: string;
  date: string;
  url: string;
  description: string;
  type: 'tool' | 'feature' | 'improvement';
}

export function parseFeaturesFile(content: string): ParsedFeature[] {
  const features: ParsedFeature[] = [];
  const sections = content.split(/^## /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const name = lines[0].trim();
    const props: Record<string, string> = {};

    for (const line of lines.slice(1)) {
      const match = line.match(/^(\w+):\s*(.+)/);
      if (match) {
        props[match[1].trim()] = match[2].trim();
      }
    }

    if (name && props.url && props.description) {
      features.push({
        name,
        date: props.date ?? new Date().toISOString().slice(0, 10),
        url: props.url,
        description: props.description,
        type: (props.type as ParsedFeature['type']) ?? 'feature',
      });
    }
  }

  return features;
}

// ─── Claude Post Generation ─────────────────────────────────

async function generateAnnouncementPosts(
  feature: FeatureInput
): Promise<GeneratedPost[]> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You are the social media strategist for Devmaxx (devmaxx.app), an AI-powered platform for Roblox game creators.

Generate announcement posts for a new feature/tool launch. Each post should feel exciting but authentic — like a builder announcing what they shipped.

RULES:
- X/Twitter: MAX 240 characters (leave room for link). Hook first — surprising stat, bold claim, or provocative question. Then what it does in one sentence. End with link. Add one hashtag: #RobloxDev or #RobloxCreator.
- LinkedIn: 300-500 words. Builder story angle: "We just shipped X." Why it matters for Roblox creators. How it works briefly. Professional but energetic tone. End with CTA and link.
- Instagram: 2-3 punchy sentences. End with 5 relevant hashtags (#RobloxDev #RobloxCreator #DevEx #GameDev #IndieGame).

Social handles: @devmaxxapp (X, TikTok), @devmaxx.app (Instagram), Devmaxx (LinkedIn)

Self-rate each post 1-10. Only include posts rated 7+.

Respond ONLY with valid JSON array:
[
  {
    "platform": "x",
    "content": "The tweet text",
    "qualityScore": 9
  },
  {
    "platform": "linkedin",
    "content": "The LinkedIn post",
    "qualityScore": 8
  },
  {
    "platform": "instagram",
    "content": "The Instagram caption",
    "qualityScore": 8
  }
]`,
    messages: [
      {
        role: 'user',
        content: `Generate announcement posts for this new ${feature.type}:

Name: ${feature.featureName}
Description: ${feature.description}
URL: ${feature.url}
Type: ${feature.type}

Generate X, LinkedIn, and Instagram posts.`,
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array in response');

  const posts = JSON.parse(jsonMatch[0]) as GeneratedPost[];
  return posts.filter((p) => p.qualityScore >= 7);
}

// ─── Main Pipeline ──────────────────────────────────────────

export async function announceFeature(
  db: PrismaClient,
  feature: FeatureInput
): Promise<AnnouncementResult> {
  console.log(`[FeatureAnnouncement] Generating posts for: ${feature.featureName}`);

  // Get system creator
  const creator = await db.creator.findFirst({
    where: { email: 'kevin@devmaxx.app' },
  });
  if (!creator) {
    throw new Error('System creator (kevin@devmaxx.app) not found');
  }

  // Generate posts with Claude
  const posts = await generateAnnouncementPosts(feature);
  console.log(`[FeatureAnnouncement] Claude generated ${posts.length} posts`);

  // Save to ContentPiece queue
  const savedPosts: AnnouncementResult['posts'] = [];

  for (const post of posts) {
    // Enforce X character limit
    if (post.platform === 'x' && post.content.length > 280) {
      console.log(`[FeatureAnnouncement] Skipping X post — ${post.content.length} chars (max 280)`);
      continue;
    }

    const piece = await db.contentPiece.create({
      data: {
        creatorId: creator.id,
        type: 'social_post',
        platform: post.platform,
        content: post.content,
        qualityScore: post.qualityScore,
        status: 'approved',
        sourceData: {
          agentName: 'FeatureAnnouncementAgent',
          featureName: feature.featureName,
          featureType: feature.type,
          featureUrl: feature.url,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    savedPosts.push({
      platform: post.platform,
      contentPieceId: piece.id,
      content: post.content,
    });

    console.log(`[FeatureAnnouncement] Queued ${post.platform} post: ${piece.id} (quality: ${post.qualityScore}/10)`);
  }

  console.log(`[FeatureAnnouncement] Complete — ${savedPosts.length} posts queued for ${feature.featureName}`);

  return {
    featureName: feature.featureName,
    postsGenerated: savedPosts.length,
    posts: savedPosts,
  };
}

// ─── Auto-announce unannounced features ─────────────────────

export async function autoAnnounceFeatures(
  db: PrismaClient,
  featuresContent: string
): Promise<{ announced: string[]; skipped: string[] }> {
  const features = parseFeaturesFile(featuresContent);
  const announced: string[] = [];
  const skipped: string[] = [];

  for (const feature of features) {
    const kvKey = `announced_feature_${feature.name.replace(/\s+/g, '_').toLowerCase()}`;

    // Check if already announced
    const existing = await db.keyValue.findUnique({ where: { key: kvKey } });
    if (existing) {
      skipped.push(feature.name);
      continue;
    }

    try {
      await announceFeature(db, {
        featureName: feature.name,
        description: feature.description,
        url: feature.url,
        type: feature.type,
      });

      // Mark as announced
      await db.keyValue.create({
        data: {
          key: kvKey,
          value: new Date().toISOString(),
        },
      });

      announced.push(feature.name);
      console.log(`[FeatureAnnouncement] Auto-announced: ${feature.name}`);
    } catch (err) {
      console.error(`[FeatureAnnouncement] Failed to announce ${feature.name}:`, err);
      skipped.push(feature.name);
    }
  }

  return { announced, skipped };
}
