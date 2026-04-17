export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

// ─── Route Handler ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth: CRON_SECRET bearer token only
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bearerToken = (process.env.TWITTER_BEARER_TOKEN || '').trim();
  if (!bearerToken) {
    return NextResponse.json({ error: 'TWITTER_BEARER_TOKEN not set' }, { status: 503 });
  }

  const query = req.nextUrl.searchParams.get('query');
  const maxResults = req.nextUrl.searchParams.get('max_results') || '10';

  if (!query) {
    return NextResponse.json({ error: 'query parameter is required' }, { status: 400 });
  }

  try {
    const baseUrl = 'https://api.twitter.com/2/tweets/search/recent';
    const params: Record<string, string> = {
      query,
      max_results: maxResults,
      'tweet.fields': 'author_id,created_at,public_metrics',
      'user.fields': 'username,public_metrics',
      expansions: 'author_id',
    };

    const queryString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    console.log(`[twitter/search] Searching: ${query.slice(0, 80)}...`);

    const res = await fetch(`${baseUrl}?${queryString}`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[twitter/search] Twitter API ${res.status}:`, body);
      return NextResponse.json({ error: `Twitter API ${res.status}: ${body}` }, { status: 502 });
    }

    const data = (await res.json()) as {
      data?: Array<{
        id: string;
        text: string;
        author_id: string;
        created_at: string;
        public_metrics?: {
          like_count: number;
          retweet_count: number;
          reply_count: number;
          impression_count: number;
        };
      }>;
      includes?: {
        users?: Array<{
          id: string;
          username: string;
          public_metrics?: {
            followers_count: number;
            following_count: number;
            tweet_count: number;
          };
        }>;
      };
      meta?: { result_count: number };
    };

    console.log(`[twitter/search] Returned ${data.meta?.result_count ?? 0} tweets`);

    return NextResponse.json({
      tweets: data.data ?? [],
      users: data.includes?.users ?? [],
      meta: data.meta,
    });
  } catch (err) {
    console.error('[twitter/search] Error:', err);
    return NextResponse.json({ error: `Failed: ${String(err)}` }, { status: 502 });
  }
}
