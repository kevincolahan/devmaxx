export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [logs, weeklyStats] = await Promise.all([
    db.xOutreachLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.xOutreachLog.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
  ]);

  const repliedThisWeek = weeklyStats.filter((l) => l.replyPosted).length;
  const totalThisWeek = weeklyStats.length;

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      tweetId: l.tweetId,
      authorId: l.authorId,
      authorUsername: l.authorUsername,
      tweetContent: l.tweetContent,
      category: l.category,
      replyDrafted: l.replyDrafted,
      replyPosted: l.replyPosted,
      postedAt: l.postedAt?.toISOString() ?? null,
      tweetUrl: l.tweetUrl,
      replyUrl: l.replyUrl,
      createdAt: l.createdAt.toISOString(),
    })),
    stats: {
      repliedThisWeek,
      totalThisWeek,
      engagementRate: totalThisWeek > 0
        ? Math.round((repliedThisWeek / totalThisWeek) * 100)
        : 0,
    },
  });
}
