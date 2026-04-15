export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createHmac, randomBytes } from 'crypto';

// ─── OAuth 1.0a Implementation (inline for Vercel) ──────────

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  apiSecret: string,
  accessSecret: string
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams),
  ].join('&');

  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessSecret)}`;

  return createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');
}

function buildAuthorizationHeader(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessSecret: string
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: randomBytes(32).toString('hex').slice(0, 32),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const signature = generateOAuthSignature(method, url, oauthParams, apiSecret, accessSecret);
  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

// ─── Route Handler ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth: accept session OR CRON_SECRET bearer token (for Railway cron → Vercel proxy)
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronAuth) {
    const session = await auth();
    if (!session?.user?.email || session.user.email !== 'kevin@devmaxx.app') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { action, targetUserId } = (await req.json()) as {
    action?: 'follow' | 'unfollow';
    targetUserId?: string;
  };

  if (!action || !targetUserId) {
    return NextResponse.json({ error: 'action and targetUserId are required' }, { status: 400 });
  }

  if (action !== 'follow' && action !== 'unfollow') {
    return NextResponse.json({ error: 'action must be "follow" or "unfollow"' }, { status: 400 });
  }

  const apiKey = (process.env.TWITTER_API_KEY || '').trim();
  const apiSecret = (process.env.TWITTER_API_SECRET || '').trim();
  const accessToken = (process.env.TWITTER_ACCESS_TOKEN || '').trim();
  const accessSecret = (process.env.TWITTER_ACCESS_SECRET || '').trim();
  const myUserId = (process.env.TWITTER_USER_ID || '').trim();

  if (!apiKey || !apiSecret || !accessToken || !accessSecret || !myUserId) {
    return NextResponse.json({ error: 'Missing Twitter credentials or TWITTER_USER_ID' }, { status: 503 });
  }

  try {
    if (action === 'follow') {
      const url = `https://api.twitter.com/2/users/${myUserId}/following`;
      const authorization = buildAuthorizationHeader('POST', url, apiKey, apiSecret, accessToken, accessSecret);

      console.log(`[twitter-follow] Following user ${targetUserId}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });

      const body = await response.text();

      if (!response.ok) {
        console.error(`[twitter-follow] Follow failed ${response.status}:`, body);
        return NextResponse.json({ error: `Twitter API ${response.status}: ${body}` }, { status: 502 });
      }

      const data = JSON.parse(body) as { data?: { following: boolean; pending_follow: boolean } };
      console.log(`[twitter-follow] Follow success:`, data);

      return NextResponse.json({
        success: true,
        following: data.data?.following ?? false,
        pending: data.data?.pending_follow ?? false,
      });
    } else {
      // Unfollow
      const url = `https://api.twitter.com/2/users/${myUserId}/following/${targetUserId}`;
      const authorization = buildAuthorizationHeader('DELETE', url, apiKey, apiSecret, accessToken, accessSecret);

      console.log(`[twitter-follow] Unfollowing user ${targetUserId}`);

      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: authorization },
      });

      const body = await response.text();

      if (!response.ok) {
        console.error(`[twitter-follow] Unfollow failed ${response.status}:`, body);
        return NextResponse.json({ error: `Twitter API ${response.status}: ${body}` }, { status: 502 });
      }

      const data = JSON.parse(body) as { data?: { following: boolean } };
      console.log(`[twitter-follow] Unfollow success:`, data);

      return NextResponse.json({ success: true, following: data.data?.following ?? false });
    }
  } catch (err) {
    console.error('[twitter-follow] Fetch error:', err);
    return NextResponse.json({ error: `Failed to reach Twitter API: ${String(err)}` }, { status: 502 });
  }
}
