export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint, ...data } = body as { endpoint: string; [key: string]: unknown };

  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
  }

  const allowedEndpoints = ['apply-price', 'apply-recommendation', 'apply-brief-action'];
  if (!allowedEndpoints.includes(endpoint)) {
    return NextResponse.json({ error: `Invalid endpoint: ${endpoint}` }, { status: 400 });
  }

  try {
    const response = await fetch(`${API_BASE}/api/actions/${endpoint}`, {
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
    console.error(`[actions proxy] Failed to reach Railway API:`, err);
    return NextResponse.json(
      { error: `Failed to reach API: ${String(err)}` },
      { status: 502 }
    );
  }
}
