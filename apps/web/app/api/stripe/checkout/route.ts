export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe, PLANS } from '@/lib/stripe';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { plan } = (await req.json()) as { plan: 'creator' | 'pro' | 'studio' };

  const planConfig = PLANS[plan];
  if (!planConfig || !planConfig.stripePriceId) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  let creator = await db.creator.findUnique({
    where: { email: session.user.email },
  });

  if (!creator) {
    creator = await db.creator.create({
      data: { email: session.user.email },
    });
  }

  let customerId = creator.stripeId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      metadata: { creatorId: creator.id },
    });
    customerId = customer.id;
    await db.creator.update({
      where: { id: creator.id },
      data: { stripeId: customerId },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: planConfig.stripePriceId, quantity: 1 }],
    success_url: `${req.nextUrl.origin}/dashboard?upgraded=true`,
    cancel_url: `${req.nextUrl.origin}/pricing`,
    metadata: { creatorId: creator.id, plan },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
