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
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { text, replyToTweetId } = (await req.json()) as {
    text?: string;
    replyToTweetId?: string;
  };

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
    return NextResponse.json({ error: 'Missing Twitter credentials' }, { status: 503 });
  }

  try {
    const twitterUrl = 'https://api.twitter.com/2/tweets';
    const authorization = buildAuthorizationHeader('POST', twitterUrl, apiKey, apiSecret, accessToken, accessSecret);

    console.log(`[twitter/reply] Replying to ${replyToTweetId} (${text.length} chars)`);

    const response = await fetch(twitterUrl, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        reply: { in_reply_to_tweet_id: replyToTweetId },
      }),
    });

    const body = await response.text();

    if (!response.ok) {
      console.error(`[twitter/reply] Twitter API ${response.status}:`, body);
      return NextResponse.json({ error: `Twitter API ${response.status}: ${body}` }, { status: 502 });
    }

    const data = JSON.parse(body) as { data?: { id: string; text: string } };
    const tweetId = data.data?.id;

    if (!tweetId) {
      return NextResponse.json({ error: `Unexpected response: ${body}` }, { status: 502 });
    }

    const replyUrl = `https://x.com/devmaxxapp/status/${tweetId}`;
    console.log(`[twitter/reply] Success — ${replyUrl}`);

    return NextResponse.json({ success: true, tweetId, replyUrl });
  } catch (err) {
    console.error('[twitter/reply] Error:', err);
    return NextResponse.json({ error: `Failed: ${String(err)}` }, { status: 502 });
  }
}
