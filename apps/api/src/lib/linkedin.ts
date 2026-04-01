// ─── LinkedIn Organization Page Posting via API v2 ───────────

export interface LinkedInResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export async function postToLinkedIn(text: string): Promise<LinkedInResult> {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const orgId = process.env.LINKEDIN_ORG_ID;

  if (!accessToken || !orgId) {
    return {
      success: false,
      error: 'Missing LinkedIn credentials. Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_ORG_ID.',
    };
  }

  const url = 'https://api.linkedin.com/v2/ugcPosts';

  const body = {
    author: `urn:li:organization:${orgId}`,
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

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`LinkedIn API error (${response.status}):`, errorBody);
    return {
      success: false,
      error: `LinkedIn API ${response.status}: ${errorBody}`,
    };
  }

  const postId = response.headers.get('x-restli-id') ?? '';
  const activityId = postId.replace('urn:li:share:', '');

  return {
    success: true,
    postId,
    postUrl: activityId
      ? `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}`
      : `https://www.linkedin.com/company/devmax`,
  };
}
