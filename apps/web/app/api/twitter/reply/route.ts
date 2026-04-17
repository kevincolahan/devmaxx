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

export async function POST(req: NextRequest) {
  // Auth: CRON_SECRET bearer token only
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  console.log(`[twitter/reply] Auth check — cronSecret set: ${cronSecret ? 'yes' : 'NO'} (${cronSecret.length} chars), authHeader: "${authHeader.slice(0, 20)}..." (${authHeader.length} chars)`);

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error(`[twitter/reply] AUTH FAILED — cronSecret empty: ${!cronSecret}, match: ${authHeader === `Bearer ${cronSecret}`}`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { text?: string; replyToTweetId?: string };
  try {
    body = await req.json();
  } catch (parseErr) {
    console.error(`[twitter/reply] Failed to parse request body:`, parseErr);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { text, replyToTweetId } = body;
  console.log(`[twitter/reply] Request — text: "${(text ?? '').slice(0, 60)}..." (${(text ?? '').length} chars), replyToTweetId: ${replyToTweetId}`);

  if (!text || !replyToTweetId) {
    return NextResponse.json({ error: 'text and replyToTweetId are required' }, { status: 400 });
  }

  if (text.length > 280) {
    return NextResponse.json({ error: `Reply exceeds 280 characters (${text.length})` }, { status: 400 });
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
    console.error(`[twitter/reply] Missing credentials: ${missing.join(', ')}`);
    return NextResponse.json({ error: `Missing Twitter credentials: ${missing.join(', ')}` }, { status: 503 });
  }

  console.log(`[twitter/reply] Credentials loaded — apiKey: ${apiKey.length}ch, apiSecret: ${apiSecret.length}ch, accessToken: ${accessToken.length}ch, accessSecret: ${accessSecret.length}ch`);

  try {
    const twitterUrl = 'https://api.twitter.com/2/tweets';
    const authorization = buildAuthorizationHeader('POST', twitterUrl, apiKey, apiSecret, accessToken, accessSecret);

    const twitterPayload = {
      text,
      reply: { in_reply_to_tweet_id: replyToTweetId },
    };

    console.log(`[twitter/reply] Calling Twitter API — POST ${twitterUrl}`);
    console.log(`[twitter/reply] Payload: ${JSON.stringify(twitterPayload)}`);

    const response = await fetch(twitterUrl, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(twitterPayload),
    });

    const responseBody = await response.text();
    console.log(`[twitter/reply] Twitter API response: status=${response.status} body=${responseBody.slice(0, 500)}`);

    if (!response.ok) {
      return NextResponse.json({ error: `Twitter API ${response.status}: ${responseBody}` }, { status: 502 });
    }

    const data = JSON.parse(responseBody) as { data?: { id: string; text: string } };
    const tweetId = data.data?.id;

    if (!tweetId) {
      console.error(`[twitter/reply] No tweet ID in response: ${responseBody}`);
      return NextResponse.json({ error: `Unexpected response: ${responseBody}` }, { status: 502 });
    }

    const replyUrl = `https://x.com/devmaxxapp/status/${tweetId}`;
    console.log(`[twitter/reply] SUCCESS — ${replyUrl}`);

    return NextResponse.json({ success: true, tweetId, replyUrl });
  } catch (err) {
    console.error('[twitter/reply] Exception:', err);
    return NextResponse.json({ error: `Failed: ${String(err)}` }, { status: 502 });
  }
}
