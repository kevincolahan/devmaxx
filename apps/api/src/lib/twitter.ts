import { createHmac, randomBytes } from 'crypto';

// ─── Twitter API v2 — OAuth 1.0a Signed Requests ────────────

interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

function getConfig(): TwitterConfig {
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

function generateNonce(): string {
  // Twitter expects alphanumeric nonce — 32 hex chars
  return randomBytes(32).toString('hex').slice(0, 32);
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  config: TwitterConfig
): string {
  // Sort parameters alphabetically by key
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');

  // Build signature base string: METHOD&url&params (each percent-encoded)
  const signatureBase = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams),
  ].join('&');

  // Signing key: consumer_secret&token_secret (both percent-encoded)
  const signingKey = `${percentEncode(config.apiSecret)}&${percentEncode(config.accessSecret)}`;

  const signature = createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');

  console.log(`[Twitter OAuth] Method: ${method}`);
  console.log(`[Twitter OAuth] URL: ${url}`);
  console.log(`[Twitter OAuth] Signature base length: ${signatureBase.length}`);
  console.log(`[Twitter OAuth] Consumer key: ${config.apiKey.slice(0, 6)}...`);
  console.log(`[Twitter OAuth] Token: ${config.accessToken.slice(0, 6)}...`);

  return signature;
}

function buildAuthorizationHeader(
  method: string,
  url: string,
  config: TwitterConfig
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: config.accessToken,
    oauth_version: '1.0',
  };

  const signature = generateOAuthSignature(method, url, oauthParams, config);
  oauthParams.oauth_signature = signature;

  // Build header: sorted, percent-encoded key="value" pairs
  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
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

  let config: TwitterConfig;
  try {
    config = getConfig();
  } catch (err) {
    return { credentialsConfigured: false, missing: [], error: String(err) };
  }

  // Log key lengths to detect whitespace/corruption without exposing secrets
  const keyLengths = {
    apiKey: config.apiKey.length,
    apiSecret: config.apiSecret.length,
    accessToken: config.accessToken.length,
    accessSecret: config.accessSecret.length,
  };
  console.log('[Twitter Test] Key lengths:', keyLengths);

  // Use GET /2/users/me to verify OAuth
  // Note: This endpoint requires Basic tier ($100/mo).
  // On Free tier, this will return 401/403 even with valid credentials.
  // The only Free tier endpoint is POST /2/tweets.
  const url = 'https://api.twitter.com/2/users/me';
  const authorization = buildAuthorizationHeader('GET', url, config);

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
