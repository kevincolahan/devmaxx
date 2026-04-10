// ─── Twitter API v2 — OAuth 2.0 User Context ───────────────
//
// Uses OAuth 2.0 user access token (with tweet.write scope) for posting.
// Falls back to OAuth 1.0a if TWITTER_OAUTH2_ACCESS_TOKEN is not set.
//
// To get an OAuth 2.0 user access token:
// 1. Go to developer.twitter.com → your app → User authentication settings
// 2. Enable OAuth 2.0 with Type: Web App, Confidential client
// 3. Set callback URL (e.g. https://devmaxx.app/api/auth/twitter/callback)
// 4. Use the OAuth 2.0 Authorization Code Flow with PKCE to get a user token
//    with scopes: tweet.read, tweet.write, users.read
// 5. Store the access token as TWITTER_OAUTH2_ACCESS_TOKEN in Railway

import { createHmac, randomBytes } from 'crypto';

// ─── OAuth 1.0a helpers (kept as fallback) ──────────────────

function encode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

function buildOAuth1Header(method: string, url: string): string {
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
    throw new Error(`Missing Twitter OAuth 1.0a credentials: ${missing.join(', ')}`);
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString('hex');

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const sortedParams = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encode(k)}=${encode(oauthParams[k])}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    encode(url),
    encode(sortedParams),
  ].join('&');

  const signingKey = `${encode(apiSecret)}&${encode(accessSecret)}`;

  const signature = createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  oauthParams.oauth_signature = signature;

  return (
    'OAuth ' +
    Object.keys(oauthParams)
      .sort()
      .map((k) => `${encode(k)}="${encode(oauthParams[k])}"`)
      .join(', ')
  );
}

// ─── Auth strategy selection ────────────────────────────────

function getAuthHeader(method: string, url: string): { header: string; strategy: string } {
  // Prefer OAuth 2.0 user access token if available
  const oauth2Token = (process.env.TWITTER_OAUTH2_ACCESS_TOKEN || '').trim();
  if (oauth2Token) {
    console.log(`[Twitter] Using OAuth 2.0 user access token (${oauth2Token.length} chars)`);
    return { header: `Bearer ${oauth2Token}`, strategy: 'oauth2_user' };
  }

  // Fall back to OAuth 1.0a
  console.log('[Twitter] Using OAuth 1.0a (no TWITTER_OAUTH2_ACCESS_TOKEN set)');
  return { header: buildOAuth1Header(method, url), strategy: 'oauth1' };
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
  strategy?: string;
}

export async function testTwitterCredentials(): Promise<TwitterTestResult> {
  const credCheck = checkTwitterCredentials();
  if (!credCheck.configured) {
    return { credentialsConfigured: false, missing: credCheck.missing };
  }

  const keyLengths = {
    apiKey: (process.env.TWITTER_API_KEY || '').trim().length,
    apiSecret: (process.env.TWITTER_API_SECRET || '').trim().length,
    accessToken: (process.env.TWITTER_ACCESS_TOKEN || '').trim().length,
    accessSecret: (process.env.TWITTER_ACCESS_SECRET || '').trim().length,
    oauth2AccessToken: (process.env.TWITTER_OAUTH2_ACCESS_TOKEN || '').trim().length,
  };
  console.log('[Twitter Test] Key lengths:', keyLengths);

  const url = 'https://api.twitter.com/2/users/me';
  const { header, strategy } = getAuthHeader('GET', url);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: header },
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
        strategy,
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
      strategy,
    };
  } catch (err) {
    return {
      credentialsConfigured: true,
      missing: [],
      apiReachable: false,
      error: `Network error: ${String(err)}`,
      keyLengths,
      strategy,
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
  // Configured if either OAuth 2.0 token OR OAuth 1.0a credentials are present
  const hasOAuth2 = !!(process.env.TWITTER_OAUTH2_ACCESS_TOKEN || '').trim();
  if (hasOAuth2) {
    return { configured: true, missing: [] };
  }

  const missing = [
    !process.env.TWITTER_API_KEY && 'TWITTER_API_KEY',
    !process.env.TWITTER_API_SECRET && 'TWITTER_API_SECRET',
    !process.env.TWITTER_ACCESS_TOKEN && 'TWITTER_ACCESS_TOKEN',
    !process.env.TWITTER_ACCESS_SECRET && 'TWITTER_ACCESS_SECRET',
  ].filter(Boolean) as string[];

  return { configured: missing.length === 0, missing };
}

export async function postTweet(text: string): Promise<TweetResult> {
  const url = 'https://api.twitter.com/2/tweets';
  const { header, strategy } = getAuthHeader('POST', url);

  console.log(`[Twitter] Posting tweet (${text.length} chars) via ${strategy}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: header,
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
    console.error(`[Twitter] API error (${response.status}) via ${strategy}:`, errorBody);
    console.error(`[Twitter] Response headers:`, Object.fromEntries(response.headers.entries()));
    return {
      success: false,
      error: `Twitter API ${response.status} (${strategy}): ${errorBody}`,
    };
  }

  const data = (await response.json()) as { data?: { id: string; text: string } };

  if (!data.data?.id) {
    console.error('[Twitter] Unexpected response shape:', JSON.stringify(data));
    return { success: false, error: `Twitter returned unexpected response: ${JSON.stringify(data)}` };
  }

  console.log(`[Twitter] Success via ${strategy} — tweet ID: ${data.data.id}`);

  return {
    success: true,
    tweetId: data.data.id,
    tweetUrl: `https://x.com/devmaxxapp/status/${data.data.id}`,
  };
}
