// ─── LinkedIn Member Posting via REST API ────────────────────

let cachedPersonId: string | null = null;

async function getPersonId(accessToken: string): Promise<string> {
  // Check env var first
  const envId = (process.env.LINKEDIN_PERSON_ID || '').trim();
  if (envId) return envId;

  // Return cached value
  if (cachedPersonId) return cachedPersonId;

  // Fetch from LinkedIn userinfo endpoint
  console.log('[LinkedIn] Fetching person ID from /v2/userinfo');
  const res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LinkedIn userinfo failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { sub?: string };
  if (!data.sub) {
    throw new Error('LinkedIn userinfo returned no sub field');
  }

  // sub is already in format "urn:li:person:XXXXXXXX" or just the ID
  const personId = data.sub.startsWith('urn:') ? data.sub : data.sub;
  cachedPersonId = personId;
  console.log(`[LinkedIn] Resolved person ID: ${personId}`);

  return personId;
}

export interface LinkedInResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export async function postToLinkedIn(text: string): Promise<LinkedInResult> {
  const accessToken = (process.env.LINKEDIN_ACCESS_TOKEN || '').trim();

  if (!accessToken) {
    return {
      success: false,
      error: 'Missing LINKEDIN_ACCESS_TOKEN.',
    };
  }

  let personId: string;
  try {
    personId = await getPersonId(accessToken);
  } catch (err) {
    console.error('[LinkedIn] Failed to get person ID:', err);
    return { success: false, error: String(err) };
  }

  // Build the author URN
  const authorUrn = personId.startsWith('urn:') ? personId : `urn:li:person:${personId}`;

  const url = 'https://api.linkedin.com/rest/posts';

  const body = {
    author: authorUrn,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };

  console.log(`[LinkedIn] Posting as ${authorUrn} (${text.length} chars)`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202306',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('[LinkedIn] Network error:', err);
    return { success: false, error: `LinkedIn network error: ${String(err)}` };
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[LinkedIn] API error (${response.status}):`, errorBody);
    return {
      success: false,
      error: `LinkedIn API ${response.status}: ${errorBody}`,
    };
  }

  const postUrn = response.headers.get('x-restli-id') ?? '';
  const activityId = postUrn.replace('urn:li:share:', '').replace('urn:li:ugcPost:', '');

  console.log(`[LinkedIn] Success — post URN: ${postUrn}`);

  return {
    success: true,
    postId: postUrn,
    postUrl: activityId
      ? `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}`
      : 'https://www.linkedin.com/in/me/recent-activity/',
  };
}
