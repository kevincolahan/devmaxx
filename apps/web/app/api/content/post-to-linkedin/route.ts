export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const API_BASE = process.env.API_BASE_URL || 'https://devmaxx-production.up.railway.app';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { contentPieceId } = (await req.json()) as { contentPieceId: string };

  if (!contentPieceId) {
    return NextResponse.json({ error: 'contentPieceId is required' }, { status: 400 });
  }

  const response = await fetch(`${API_BASE}/api/content/post-to-linkedin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentPieceId }),
  });

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }

  return NextResponse.json(data);
}
