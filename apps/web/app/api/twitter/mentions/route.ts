export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes } from 'crypto';

// ─── OAuth 1.0a Implementation ──────────────────────────────

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
  queryParams: Record<string, string>,
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

  const allParams = { ...oauthParams, ...queryParams };
  const signature = generateOAuthSignature(method, url, allParams, apiSecret, accessSecret);
  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

// ─── Route Handler ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth: CRON_SECRET bearer token only
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = (process.env.TWITTER_API_KEY || '').trim();
  const apiSecret = (process.env.TWITTER_API_SECRET || '').trim();
  const accessToken = (process.env.TWITTER_ACCESS_TOKEN || '').trim();
  const accessSecret = (process.env.TWITTER_ACCESS_SECRET || '').trim();

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    return NextResponse.json({ error: 'Missing Twitter credentials' }, { status: 503 });
  }

  const sinceId = req.nextUrl.searchParams.get('since_id') || undefined;

  try {
    // Step 1: Resolve @devmaxxapp user ID
    const userIdEnv = (process.env.TWITTER_USER_ID || '').trim();
    let userId = userIdEnv;

    if (!userId) {
      const lookupUrl = 'https://api.twitter.com/2/users/by/username/devmaxxapp';
      const lookupAuth = buildAuthorizationHeader('GET', lookupUrl, {}, apiKey, apiSecret, accessToken, accessSecret);
      const lookupRes = await fetch(lookupUrl, {
        headers: { Authorization: lookupAuth },
      });
      if (!lookupRes.ok) {
        const body = await lookupRes.text();
        return NextResponse.json({ error: `User lookup failed: ${lookupRes.status} ${body}` }, { status: 502 });
      }
      const lookupData = (await lookupRes.json()) as { data?: { id: string } };
      userId = lookupData.data?.id ?? '';
      if (!userId) {
        return NextResponse.json({ error: 'Could not resolve @devmaxxapp user ID' }, { status: 502 });
      }
    }

    // Step 2: Fetch mentions
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

    const auth = buildAuthorizationHeader('GET', baseUrl, params, apiKey, apiSecret, accessToken, accessSecret);

    console.log(`[twitter/mentions] Fetching mentions for user ${userId}`);

    const res = await fetch(`${baseUrl}?${queryString}`, {
      headers: { Authorization: auth },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[twitter/mentions] Twitter API ${res.status}:`, body);
      return NextResponse.json({ error: `Twitter API ${res.status}: ${body}` }, { status: 502 });
    }

    const data = (await res.json()) as {
      data?: Array<{ id: string; text: string; author_id: string; created_at: string }>;
      includes?: { users?: Array<{ id: string; username: string; public_metrics?: { followers_count: number } }> };
      meta?: { result_count: number };
    };

    console.log(`[twitter/mentions] Returned ${data.meta?.result_count ?? 0} mentions`);

    return NextResponse.json({
      userId,
      mentions: data.data ?? [],
      users: data.includes?.users ?? [],
    });
  } catch (err) {
    console.error('[twitter/mentions] Error:', err);
    return NextResponse.json({ error: `Failed: ${String(err)}` }, { status: 502 });
  }
}
