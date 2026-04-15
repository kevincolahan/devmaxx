export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// ─── Person ID helper ───────────────────────────────────────

let cachedPersonId: string | null = null;

async function getPersonId(accessToken: string): Promise<string> {
  const envId = (process.env.LINKEDIN_PERSON_ID || '').trim();
  if (envId) return envId;

  if (cachedPersonId) return cachedPersonId;

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
  return data.sub;
}

// ─── Route Handler ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth: session OR CRON_SECRET bearer token (for Railway → Vercel proxy)
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronAuth) {
    const session = await auth();
    if (!session?.user?.email || session.user.email !== 'kevin@devmaxx.app') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { action, postUrn, commentText, targetPersonUrn, connectionMessage } = (await req.json()) as {
    action?: 'like' | 'comment' | 'connect';
    postUrn?: string;
    commentText?: string;
    targetPersonUrn?: string;
    connectionMessage?: string;
  };

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }

  const accessToken = (process.env.LINKEDIN_ACCESS_TOKEN || '').trim();
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing LINKEDIN_ACCESS_TOKEN' }, { status: 503 });
  }

  let personId: string;
  try {
    personId = await getPersonId(accessToken);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  const actorUrn = personId.startsWith('urn:') ? personId : `urn:li:person:${personId}`;

  try {
    if (action === 'like') {
      if (!postUrn) {
        return NextResponse.json({ error: 'postUrn is required for like' }, { status: 400 });
      }

      console.log(`[linkedin-engage] Liking ${postUrn}`);

      const response = await fetch('https://api.linkedin.com/v2/reactions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          root: postUrn,
          reactionType: 'LIKE',
          actor: actorUrn,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`[linkedin-engage] Like failed ${response.status}:`, body);
        return NextResponse.json({ error: `LinkedIn API ${response.status}: ${body}` }, { status: 502 });
      }

      console.log(`[linkedin-engage] Like success on ${postUrn}`);
      return NextResponse.json({ success: true, action: 'like', postUrn });
    }

    if (action === 'comment') {
      if (!postUrn || !commentText) {
        return NextResponse.json({ error: 'postUrn and commentText are required for comment' }, { status: 400 });
      }

      console.log(`[linkedin-engage] Commenting on ${postUrn} (${commentText.length} chars)`);

      const response = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          actor: actorUrn,
          message: { text: commentText },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`[linkedin-engage] Comment failed ${response.status}:`, body);
        return NextResponse.json({ error: `LinkedIn API ${response.status}: ${body}` }, { status: 502 });
      }

      const commentId = response.headers.get('x-restli-id') ?? '';
      console.log(`[linkedin-engage] Comment success: ${commentId}`);
      return NextResponse.json({ success: true, action: 'comment', postUrn, commentId });
    }

    if (action === 'connect') {
      if (!targetPersonUrn) {
        return NextResponse.json({ error: 'targetPersonUrn is required for connect' }, { status: 400 });
      }

      console.log(`[linkedin-engage] Connection request to ${targetPersonUrn}`);

      const response = await fetch('https://api.linkedin.com/v2/invitations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          invitee: targetPersonUrn,
          message: { text: connectionMessage || '' },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`[linkedin-engage] Connect failed ${response.status}:`, body);
        return NextResponse.json({ error: `LinkedIn API ${response.status}: ${body}` }, { status: 502 });
      }

      console.log(`[linkedin-engage] Connection request sent to ${targetPersonUrn}`);
      return NextResponse.json({ success: true, action: 'connect', targetPersonUrn });
    }

    return NextResponse.json({ error: 'action must be like, comment, or connect' }, { status: 400 });
  } catch (err) {
    console.error('[linkedin-engage] Fetch error:', err);
    return NextResponse.json({ error: `Failed to reach LinkedIn API: ${String(err)}` }, { status: 502 });
  }
}
