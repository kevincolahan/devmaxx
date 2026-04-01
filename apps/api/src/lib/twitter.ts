import { createHmac, randomBytes } from 'crypto';

// ─── Twitter API v2 — OAuth 1.0a Signed Requests ────────────

interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

function getConfig(): TwitterConfig {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    const missing = [
      !apiKey && 'TWITTER_API_KEY',
      !apiSecret && 'TWITTER_API_SECRET',
      !accessToken && 'TWITTER_ACCESS_TOKEN',
      !accessSecret && 'TWITTER_ACCESS_SECRET',
    ].filter(Boolean);
    throw new Error(`Missing Twitter credentials: ${missing.join(', ')}`);
  }

  return { apiKey, apiSecret, accessToken, accessSecret };
}

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
  config: TwitterConfig
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

  const signingKey = `${percentEncode(config.apiSecret)}&${percentEncode(config.accessSecret)}`;

  return createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');
}

function buildAuthorizationHeader(
  method: string,
  url: string,
  config: TwitterConfig
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: config.accessToken,
    oauth_version: '1.0',
  };

  const signature = generateOAuthSignature(method, url, oauthParams, config);
  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

// ─── Public API ──────────────────────────────────────────────

export interface TweetResult {
  success: boolean;
  tweetId?: string;
  tweetUrl?: string;
  error?: string;
}

export function checkTwitterCredentials(): { configured: boolean; missing: string[] } {
  const missing = [
    !process.env.TWITTER_API_KEY && 'TWITTER_API_KEY',
    !process.env.TWITTER_API_SECRET && 'TWITTER_API_SECRET',
    !process.env.TWITTER_ACCESS_TOKEN && 'TWITTER_ACCESS_TOKEN',
    !process.env.TWITTER_ACCESS_SECRET && 'TWITTER_ACCESS_SECRET',
  ].filter(Boolean) as string[];

  return { configured: missing.length === 0, missing };
}

export async function postTweet(text: string): Promise<TweetResult> {
  let config: TwitterConfig;
  try {
    config = getConfig();
  } catch (err) {
    console.error('[Twitter] Config error:', String(err));
    return { success: false, error: String(err) };
  }

  const url = 'https://api.twitter.com/2/tweets';
  const authorization = buildAuthorizationHeader('POST', url, config);

  console.log(`[Twitter] Posting tweet (${text.length} chars) to ${url}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
  } catch (fetchErr) {
    console.error('[Twitter] Network error:', fetchErr);
    return { success: false, error: `Twitter network error: ${String(fetchErr)}` };
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Twitter] API error (${response.status}):`, errorBody);
    console.error(`[Twitter] Response headers:`, Object.fromEntries(response.headers.entries()));
    return {
      success: false,
      error: `Twitter API ${response.status}: ${errorBody}`,
    };
  }

  const data = (await response.json()) as { data?: { id: string; text: string } };

  if (!data.data?.id) {
    console.error('[Twitter] Unexpected response shape:', JSON.stringify(data));
    return { success: false, error: `Twitter returned unexpected response: ${JSON.stringify(data)}` };
  }

  console.log(`[Twitter] Success — tweet ID: ${data.data.id}`);

  return {
    success: true,
    tweetId: data.data.id,
    tweetUrl: `https://x.com/devmaxxapp/status/${data.data.id}`,
  };
}
