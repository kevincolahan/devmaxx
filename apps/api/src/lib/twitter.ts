import { createHmac, randomBytes } from 'crypto';

// ─── OAuth 1.0a Percent Encoding ────────────────────────────

function encode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

// ─── OAuth 1.0a Authorization Header ────────────────────────

function buildOAuthHeader(method: string, url: string): string {
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

  // For POST with JSON body, no body params in signature
  const allParams = { ...oauthParams };

  // Sort params alphabetically
  const sortedParams = Object.keys(allParams)
    .sort()
    .map((k) => `${encode(k)}=${encode(allParams[k])}`)
    .join('&');

  // Build signature base string
  const baseString = [
    method.toUpperCase(),
    encode(url),
    encode(sortedParams),
  ].join('&');

  // Build signing key
  const signingKey = `${encode(apiSecret)}&${encode(accessSecret)}`;

  // Generate signature
  const signature = createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  oauthParams.oauth_signature = signature;

  // Build Authorization header
  const authHeader =
    'OAuth ' +
    Object.keys(oauthParams)
      .sort()
      .map((k) => `${encode(k)}="${encode(oauthParams[k])}"`)
      .join(', ');

  // Debug logging
  console.log(`[Twitter OAuth] Method: ${method}, URL: ${url}`);
  console.log(`[Twitter OAuth] Timestamp: ${timestamp}, Nonce: ${nonce}`);
  console.log(`[Twitter OAuth] Base string (first 200): ${baseString.slice(0, 200)}`);
  console.log(`[Twitter OAuth] Key lengths: apiKey=${apiKey.length}, apiSecret=${apiSecret.length}, accessToken=${accessToken.length}, accessSecret=${accessSecret.length}`);
  console.log(`[Twitter OAuth] Consumer key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);
  console.log(`[Twitter OAuth] Access token: ${accessToken.slice(0, 8)}...${accessToken.slice(-4)}`);

  return authHeader;
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

  const keyLengths = {
    apiKey: (process.env.TWITTER_API_KEY || '').trim().length,
    apiSecret: (process.env.TWITTER_API_SECRET || '').trim().length,
    accessToken: (process.env.TWITTER_ACCESS_TOKEN || '').trim().length,
    accessSecret: (process.env.TWITTER_ACCESS_SECRET || '').trim().length,
  };
  console.log('[Twitter Test] Key lengths:', keyLengths);

  // Use GET /2/users/me to verify OAuth
  // Note: This endpoint requires Basic tier ($100/mo).
  // On Free tier, this will return 401/403 even with valid credentials.
  // The only Free tier endpoint is POST /2/tweets.
  const url = 'https://api.twitter.com/2/users/me';

  let authorization: string;
  try {
    authorization = buildOAuthHeader('GET', url);
  } catch (err) {
    return { credentialsConfigured: false, missing: [], error: String(err) };
  }

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
  const url = 'https://api.twitter.com/2/tweets';

  let authorization: string;
  try {
    authorization = buildOAuthHeader('POST', url);
  } catch (err) {
    console.error('[Twitter] Config error:', String(err));
    return { success: false, error: String(err) };
  }

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
