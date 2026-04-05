export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const API_BASE = process.env.API_BASE_URL || 'https://devmaxx-production.up.railway.app';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint, ...data } = body as { endpoint: string; [key: string]: unknown };

  if (!endpoint || !['parse', 'execute'].includes(endpoint)) {
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
  }

  // If no creatorId provided, look it up from session
  if (!data.creatorId) {
    const creator = await db.creator.findUnique({ where: { email: session.user.email } });
    if (creator) {
      data.creatorId = creator.id;
    }
  }

  console.log(`[commands proxy] ${endpoint} → ${API_BASE}/api/commands/${endpoint}`);

  try {
    const response = await fetch(`${API_BASE}/api/commands/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!response.ok) {
      return NextResponse.json(result, { status: response.status });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[commands proxy] Failed:`, err);
    return NextResponse.json({ error: `Failed to reach API: ${String(err)}` }, { status: 502 });
  }
}
