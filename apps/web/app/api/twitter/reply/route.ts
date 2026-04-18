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

// ─── Route Handler ──────────────────────────────────────────
// Supports two modes:
//   1. Quote tweet: { text, quoteTweetId }
//   2. Reply:       { text, replyToTweetId }

export async function POST(req: NextRequest) {
  // Auth: CRON_SECRET bearer token only
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = (process.env.CRON_SECRET || '').trim();

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error(`[twitter/reply] AUTH FAILED`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { text?: string; replyToTweetId?: string; quoteTweetId?: string };
  try {
    body = await req.json();
  } catch (parseErr) {
    console.error(`[twitter/reply] Failed to parse request body:`, parseErr);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { text, replyToTweetId, quoteTweetId } = body;
  const mode = quoteTweetId ? 'quote' : 'reply';

  console.log(`[twitter/${mode}] Request — text: "${(text ?? '').slice(0, 60)}..." (${(text ?? '').length} chars), ${mode === 'quote' ? `quoteTweetId: ${quoteTweetId}` : `replyToTweetId: ${replyToTweetId}`}`);

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  if (!replyToTweetId && !quoteTweetId) {
    return NextResponse.json({ error: 'replyToTweetId or quoteTweetId is required' }, { status: 400 });
  }

  if (text.length > 280) {
    return NextResponse.json({ error: `Tweet exceeds 280 characters (${text.length})` }, { status: 400 });
  }

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
    console.error(`[twitter/${mode}] Missing credentials: ${missing.join(', ')}`);
    return NextResponse.json({ error: `Missing Twitter credentials: ${missing.join(', ')}` }, { status: 503 });
  }

  try {
    const twitterUrl = 'https://api.twitter.com/2/tweets';
    const authorization = buildAuthorizationHeader('POST', twitterUrl, apiKey, apiSecret, accessToken, accessSecret);

    // Build payload based on mode
    const twitterPayload: Record<string, unknown> = { text };

    if (quoteTweetId) {
      twitterPayload.quote_tweet_id = quoteTweetId;
    } else if (replyToTweetId) {
      twitterPayload.reply = { in_reply_to_tweet_id: replyToTweetId };
    }

    console.log(`[twitter/${mode}] Calling Twitter API — POST ${twitterUrl}`);
    console.log(`[twitter/${mode}] Payload: ${JSON.stringify(twitterPayload)}`);

    const response = await fetch(twitterUrl, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(twitterPayload),
    });

    const responseBody = await response.text();
    console.log(`[twitter/${mode}] Twitter API response: status=${response.status} body=${responseBody.slice(0, 500)}`);

    if (!response.ok) {
      return NextResponse.json({ error: `Twitter API ${response.status}: ${responseBody}` }, { status: 502 });
    }

    const data = JSON.parse(responseBody) as { data?: { id: string; text: string } };
    const tweetId = data.data?.id;

    if (!tweetId) {
      console.error(`[twitter/${mode}] No tweet ID in response: ${responseBody}`);
      return NextResponse.json({ error: `Unexpected response: ${responseBody}` }, { status: 502 });
    }

    const tweetUrl = `https://x.com/devmaxxapp/status/${tweetId}`;
    console.log(`[twitter/${mode}] SUCCESS — ${tweetUrl}`);

    return NextResponse.json({ success: true, tweetId, tweetUrl, mode });
  } catch (err) {
    console.error(`[twitter/${mode}] Exception:`, err);
    return NextResponse.json({ error: `Failed: ${String(err)}` }, { status: 502 });
  }
}
