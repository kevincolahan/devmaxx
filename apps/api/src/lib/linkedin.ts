// ─── LinkedIn Member Posting via v2 UGC Posts API ────────────

let cachedPersonId: string | null = null;

async function getPersonId(accessToken: string): Promise<string> {
  const envId = (process.env.LINKEDIN_PERSON_ID || '').trim();
  if (envId) return envId;

  if (cachedPersonId) return cachedPersonId;

  console.log('[LinkedIn] Fetching person ID from /v2/me');
  const res = await fetch('https://api.linkedin.com/v2/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LinkedIn /v2/me failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error('LinkedIn /v2/me returned no id field');

  cachedPersonId = data.id;
  console.log(`[LinkedIn] Resolved person ID: ${data.id}`);
  return data.id;
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

  const authorUrn = `urn:li:person:${personId}`;

  const body = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text,
        },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  console.log(`[LinkedIn] Posting as ${authorUrn} (${text.length} chars)`);

  let response: Response;
  try {
    response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
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
