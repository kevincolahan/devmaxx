export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// ─── LinkedIn Member Posting via v2 UGC Posts API ────────────

let cachedPersonId: string | null = null;

async function getPersonId(accessToken: string): Promise<string> {
  const envId = (process.env.LINKEDIN_PERSON_ID || '').trim();
  if (envId) return envId;

  if (cachedPersonId) return cachedPersonId;

  console.log('[post-linkedin] Fetching person ID from /v2/userinfo');
  const res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LinkedIn /v2/userinfo failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { sub?: string };
  if (!data.sub) throw new Error('LinkedIn /v2/userinfo returned no sub field');

  cachedPersonId = data.sub;
  console.log(`[post-linkedin] Resolved person ID: ${data.sub}`);
  return data.sub;
}

// ─── Route Handler ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { text, contentPieceId } = (await req.json()) as { text?: string; contentPieceId?: string };

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
  console.log('[post-linkedin] LinkedIn token prefix:', accessToken?.slice(0, 10));
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing LINKEDIN_ACCESS_TOKEN' }, { status: 503 });
  }

  let personId: string;
  try {
    personId = await getPersonId(accessToken);
  } catch (err) {
    console.error('[post-linkedin] Failed to get person ID:', err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  const authorUrn = personId.startsWith('urn:') ? personId : `urn:li:person:${personId}`;

  const body = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text,
        },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  console.log(`[post-linkedin] Posting as ${authorUrn} (${text.length} chars) to /v2/ugcPosts`);

  try {
    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });

    console.log(`[post-linkedin] Response status: ${response.status}`);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[post-linkedin] LinkedIn API ${response.status}:`, errorBody);
      return NextResponse.json(
        { error: `LinkedIn API ${response.status}: ${errorBody}` },
        { status: 502 }
      );
    }

    const postUrn = response.headers.get('x-restli-id') ?? '';
    const activityId = postUrn.replace('urn:li:share:', '').replace('urn:li:ugcPost:', '');
    const postUrl = activityId
      ? `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}`
      : 'https://www.linkedin.com/in/me/recent-activity/';

    console.log(`[post-linkedin] Success — ${postUrn}`);

    // Update content piece status if provided
    if (contentPieceId) {
      try {
        const API_BASE = process.env.API_BASE_URL || 'https://devmaxx-production.up.railway.app';
        await fetch(`${API_BASE}/api/content/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: contentPieceId,
            status: 'published',
            performance: { postId: postUrn, postUrl, platform: 'linkedin', postedAt: new Date().toISOString() },
          }),
        });
      } catch (err) {
        console.error('[post-linkedin] Failed to update content piece:', err);
      }
    }

    return NextResponse.json({ success: true, postId: postUrn, postUrl });
  } catch (err) {
    console.error('[post-linkedin] Fetch error:', err);
    return NextResponse.json(
      { error: `Failed to reach LinkedIn API: ${String(err)}` },
      { status: 502 }
    );
  }
}
