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

  const { plan } = (await req.json()) as { plan: string };

  if (!plan || !(plan in PLANS) || plan === 'free') {
    return NextResponse.json({ error: `Invalid plan: ${plan}` }, { status: 400 });
  }

  const planConfig = PLANS[plan as keyof typeof PLANS];
  const priceId = planConfig.stripePriceId;

  console.log(`[stripe/checkout] Plan: ${plan}, Price ID: ${priceId || 'MISSING'}`);

  if (!priceId) {
    console.error(`[stripe/checkout] STRIPE_PRICE_${plan.toUpperCase()} env var is not set`);
    return NextResponse.json(
      { error: `Stripe price not configured for ${plan} plan. Set STRIPE_PRICE_${plan.toUpperCase()} env var.` },
      { status: 503 }
    );
  }

  try {
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

    console.log(`[stripe/checkout] Creating session for customer ${customerId}, price ${priceId}`);

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.nextUrl.origin}/dashboard?upgraded=true`,
      cancel_url: `${req.nextUrl.origin}/pricing`,
      metadata: { creatorId: creator.id, plan },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[stripe/checkout] Error:', err);
    return NextResponse.json(
      { error: `Stripe checkout failed: ${String(err)}` },
      { status: 500 }
    );
  }
}
