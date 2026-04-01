// ─── Instagram Graph API — Business Account Posting ──────────

export interface InstagramResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export async function createInstagramPost(text: string): Promise<InstagramResult> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const imageUrl = process.env.DEVMAXX_DEFAULT_IMAGE_URL;

  if (!accessToken || !accountId) {
    return {
      success: false,
      error: 'Missing Instagram credentials. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID.',
    };
  }

  if (!imageUrl) {
    return {
      success: false,
      error: 'Missing DEVMAXX_DEFAULT_IMAGE_URL. Instagram requires an image for every post.',
    };
  }

  // Step 1: Create media container
  const createUrl = new URL(`https://graph.facebook.com/v18.0/${accountId}/media`);
  createUrl.searchParams.set('caption', text);
  createUrl.searchParams.set('image_url', imageUrl);
  createUrl.searchParams.set('access_token', accessToken);

  const createRes = await fetch(createUrl.toString(), { method: 'POST' });

  if (!createRes.ok) {
    const errorBody = await createRes.text();
    console.error(`Instagram create media error (${createRes.status}):`, errorBody);
    return {
      success: false,
      error: `Instagram create media ${createRes.status}: ${errorBody}`,
    };
  }

  const createData = (await createRes.json()) as { id?: string; error?: { message: string } };

  if (!createData.id) {
    return {
      success: false,
      error: `Instagram container creation failed: ${createData.error?.message ?? 'No container ID returned'}`,
    };
  }

  const containerId = createData.id;

  // Step 2: Publish container
  const publishUrl = new URL(`https://graph.facebook.com/v18.0/${accountId}/media_publish`);
  publishUrl.searchParams.set('creation_id', containerId);
  publishUrl.searchParams.set('access_token', accessToken);

  const publishRes = await fetch(publishUrl.toString(), { method: 'POST' });

  if (!publishRes.ok) {
    const errorBody = await publishRes.text();
    console.error(`Instagram publish error (${publishRes.status}):`, errorBody);
    return {
      success: false,
      error: `Instagram publish ${publishRes.status}: ${errorBody}`,
    };
  }

  const publishData = (await publishRes.json()) as { id?: string };
  const postId = publishData.id ?? containerId;

  return {
    success: true,
    postId,
    postUrl: `https://www.instagram.com/devmaxx.app/`,
  };
}
