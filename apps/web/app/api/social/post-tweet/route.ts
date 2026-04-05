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
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { text, contentPieceId } = (await req.json()) as { text?: string; contentPieceId?: string };

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  if (text.length > 280) {
    return NextResponse.json({ error: `Tweet exceeds 280 characters (${text.length})` }, { status: 400 });
  }

  // Load and trim credentials
  const apiKey = (process.env.TWITTER_API_KEY || '').trim();
  const apiSecret = (process.env.TWITTER_API_SECRET || '').trim();
  const accessToken = (process.env.TWITTER_ACCESS_TOKEN || '').trim();
  const accessSecret = (process.env.TWITTER_ACCESS_SECRET || '').trim();

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    const missing = [
      !apiKey && 'TWITTER_API_KEY',
      !apiSecret && 'TWITTER_API_SECRET',
      !accessToken && 'TWITTER_ACCESS_TOKEN',
      !accessSecret && 'TWITTER_ACCESS_SECRET',
    ].filter(Boolean);
    console.error('[post-tweet] Missing credentials:', missing);
    return NextResponse.json({ error: `Missing Twitter credentials: ${missing.join(', ')}` }, { status: 503 });
  }

  const twitterUrl = 'https://api.twitter.com/2/tweets';
  const authorization = buildAuthorizationHeader('POST', twitterUrl, apiKey, apiSecret, accessToken, accessSecret);

  console.log(`[post-tweet] Posting tweet (${text.length} chars)`);
  console.log(`[post-tweet] Key lengths — apiKey: ${apiKey.length}, apiSecret: ${apiSecret.length}, accessToken: ${accessToken.length}, accessSecret: ${accessSecret.length}`);

  try {
    const response = await fetch(twitterUrl, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    const body = await response.text();

    if (!response.ok) {
      console.error(`[post-tweet] Twitter API ${response.status}:`, body);
      return NextResponse.json(
        { error: `Twitter API ${response.status}: ${body}` },
        { status: 502 }
      );
    }

    const data = JSON.parse(body) as { data?: { id: string; text: string } };

    if (!data.data?.id) {
      console.error('[post-tweet] Unexpected response:', body);
      return NextResponse.json(
        { error: `Unexpected Twitter response: ${body}` },
        { status: 502 }
      );
    }

    const tweetId = data.data.id;
    const tweetUrl = `https://x.com/devmaxxapp/status/${tweetId}`;

    console.log(`[post-tweet] Success — ${tweetUrl}`);

    // Update content piece status if contentPieceId provided
    if (contentPieceId) {
      try {
        const API_BASE = process.env.API_BASE_URL || 'https://devmaxx-production.up.railway.app';
        await fetch(`${API_BASE}/api/content/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: contentPieceId,
            status: 'published',
            performance: { tweetId, tweetUrl, postedAt: new Date().toISOString() },
          }),
        });
      } catch (err) {
        console.error('[post-tweet] Failed to update content piece status:', err);
        // Don't fail the response — tweet was posted successfully
      }
    }

    return NextResponse.json({ success: true, tweetId, tweetUrl });
  } catch (err) {
    console.error('[post-tweet] Fetch error:', err);
    return NextResponse.json(
      { error: `Failed to reach Twitter API: ${String(err)}` },
      { status: 502 }
    );
  }
}
