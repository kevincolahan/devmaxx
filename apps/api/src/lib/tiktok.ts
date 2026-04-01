// ─── TikTok Content Posting API ──────────────────────────────

export interface TikTokResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export async function postToTikTok(text: string): Promise<TikTokResult> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;

  if (!accessToken) {
    console.log('[TikTok] TikTok posting pending API approval — TIKTOK_ACCESS_TOKEN not set');
    return {
      success: false,
      error: 'TikTok posting pending API approval. Set TIKTOK_ACCESS_TOKEN when approved.',
    };
  }

  const url = 'https://open.tiktokapis.com/v2/post/publish/text/init/';

  const body = {
    post_info: {
      title: text.slice(0, 150),
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
    },
    source_info: {
      source: 'PULL_FROM_URL',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`TikTok API error (${response.status}):`, errorBody);
    return {
      success: false,
      error: `TikTok API ${response.status}: ${errorBody}`,
    };
  }

  const data = (await response.json()) as {
    data?: { publish_id?: string };
    error?: { code?: string; message?: string };
  };

  if (data.error?.code) {
    return {
      success: false,
      error: `TikTok error: ${data.error.code} — ${data.error.message}`,
    };
  }

  return {
    success: true,
    postId: data.data?.publish_id ?? undefined,
  };
}
