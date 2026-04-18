export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

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

  const username = req.nextUrl.searchParams.get('username');
  if (!username) {
    return NextResponse.json({ error: 'username parameter is required' }, { status: 400 });
  }

  // Strip @ if present
  const cleanUsername = username.replace(/^@/, '').trim();

  try {
    const url = `https://api.twitter.com/2/users/by/username/${encodeURIComponent(cleanUsername)}?user.fields=public_metrics,description`;

    console.log(`[twitter/user] Looking up @${cleanUsername}`);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[twitter/user] Twitter API ${res.status}:`, body);
      return NextResponse.json({ error: `Twitter API ${res.status}: ${body}` }, { status: 502 });
    }

    const data = (await res.json()) as {
      data?: {
        id: string;
        name: string;
        username: string;
        description?: string;
        public_metrics?: {
          followers_count: number;
          following_count: number;
          tweet_count: number;
        };
      };
      errors?: Array<{ detail: string }>;
    };

    if (!data.data) {
      const errMsg = data.errors?.[0]?.detail ?? 'User not found';
      console.log(`[twitter/user] @${cleanUsername} not found: ${errMsg}`);
      return NextResponse.json({ error: errMsg, found: false }, { status: 404 });
    }

    console.log(`[twitter/user] @${cleanUsername} → ID: ${data.data.id}`);

    return NextResponse.json({
      found: true,
      id: data.data.id,
      name: data.data.name,
      username: data.data.username,
      description: data.data.description,
      public_metrics: data.data.public_metrics,
    });
  } catch (err) {
    console.error('[twitter/user] Error:', err);
    return NextResponse.json({ error: `Failed: ${String(err)}` }, { status: 502 });
  }
}
