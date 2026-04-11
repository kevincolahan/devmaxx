import { createHmac, randomBytes } from 'crypto';

// ─── Twitter API v2 — OAuth 1.0a Signed Requests ────────────
//
// This implementation matches the working Vercel route at
// apps/web/app/api/social/post-tweet/route.ts exactly.

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

// ─── Credential helpers ─────────────────────────────────────

function getCredentials() {
  const apiKey = (process.env.TWITTER_API_KEY || '').trim();
  const apiSecret = (process.env.TWITTER_API_SECRET || '').trim();
  const accessToken = (process.env.TWITTER_ACCESS_TOKEN || '').trim();
  const accessSecret = (process.env.TWITTER_ACCESS_SECRET || '').trim();

  return { apiKey, apiSecret, accessToken, accessSecret };
}

// ─── Public API ──────────────────────────────────────────────

export interface TwitterTestResult {
  credentialsConfigured: boolean;
  missing: string[];
  apiReachable?: boolean;
  userId?: string;
  username?: string;
  error?: string;
  httpStatus?: number;
  rawResponse?: string;
  keyLengths?: Record<string, number>;
}

export async function testTwitterCredentials(): Promise<TwitterTestResult> {
  const credCheck = checkTwitterCredentials();
  if (!credCheck.configured) {
    return { credentialsConfigured: false, missing: credCheck.missing };
  }

  const { apiKey, apiSecret, accessToken, accessSecret } = getCredentials();

  const keyLengths = {
    apiKey: apiKey.length,
    apiSecret: apiSecret.length,
    accessToken: accessToken.length,
    accessSecret: accessSecret.length,
  };
  console.log('[Twitter Test] Key lengths:', keyLengths);

  // Use GET /2/users/me to verify OAuth
  // Note: This endpoint requires Basic tier ($100/mo).
  // On Free tier, this will return 401/403 even with valid credentials.
  // The only Free tier endpoint is POST /2/tweets.
  const url = 'https://api.twitter.com/2/users/me';
  const authorization = buildAuthorizationHeader('GET', url, apiKey, apiSecret, accessToken, accessSecret);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: authorization },
    });

    const body = await response.text();

    if (!response.ok) {
      return {
        credentialsConfigured: true,
        missing: [],
        apiReachable: true,
        httpStatus: response.status,
        error: `Twitter API ${response.status}: ${body}`,
        rawResponse: body,
        keyLengths,
      };
    }

    const data = JSON.parse(body) as { data?: { id: string; username: string } };

    return {
      credentialsConfigured: true,
      missing: [],
      apiReachable: true,
      httpStatus: 200,
      userId: data.data?.id,
      username: data.data?.username,
      keyLengths,
    };
  } catch (err) {
    return {
      credentialsConfigured: true,
      missing: [],
      apiReachable: false,
      error: `Network error: ${String(err)}`,
      keyLengths,
    };
  }
}

export interface TweetResult {
  success: boolean;
  tweetId?: string;
  tweetUrl?: string;
  error?: string;
}

export function checkTwitterCredentials(): { configured: boolean; missing: string[] } {
  const { apiKey, apiSecret, accessToken, accessSecret } = getCredentials();

  const missing = [
    !apiKey && 'TWITTER_API_KEY',
    !apiSecret && 'TWITTER_API_SECRET',
    !accessToken && 'TWITTER_ACCESS_TOKEN',
    !accessSecret && 'TWITTER_ACCESS_SECRET',
  ].filter(Boolean) as string[];

  return { configured: missing.length === 0, missing };
}

export async function postTweet(text: string): Promise<TweetResult> {
  const { apiKey, apiSecret, accessToken, accessSecret } = getCredentials();

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    const missing = [
      !apiKey && 'TWITTER_API_KEY',
      !apiSecret && 'TWITTER_API_SECRET',
      !accessToken && 'TWITTER_ACCESS_TOKEN',
      !accessSecret && 'TWITTER_ACCESS_SECRET',
    ].filter(Boolean);
    return { success: false, error: `Missing Twitter credentials: ${missing.join(', ')}` };
  }

  const url = 'https://api.twitter.com/2/tweets';
  const authorization = buildAuthorizationHeader('POST', url, apiKey, apiSecret, accessToken, accessSecret);

  console.log(`[Twitter] Posting tweet (${text.length} chars)`);
  console.log(`[Twitter] Key lengths — apiKey: ${apiKey.length}, apiSecret: ${apiSecret.length}, accessToken: ${accessToken.length}, accessSecret: ${accessSecret.length}`);

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
