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

  const [logs, weeklyLogs] = await Promise.all([
    db.youTubeOutreachLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    db.youTubeOutreachLog.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
  ]);

  const commentsThisWeek = weeklyLogs.filter((l) => l.commentPosted).length;
  const totalScanned = weeklyLogs.length;

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      videoId: l.videoId,
      channelId: l.channelId,
      videoTitle: l.videoTitle,
      commentDrafted: l.commentDrafted,
      commentPosted: l.commentPosted,
      qualityScore: l.qualityScore,
      postedAt: l.postedAt?.toISOString() ?? null,
      commentUrl: l.commentUrl,
      createdAt: l.createdAt.toISOString(),
    })),
    stats: {
      commentsThisWeek,
      totalScanned,
    },
  });
}
