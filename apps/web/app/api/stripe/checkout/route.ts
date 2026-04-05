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

    const sessionParams = {
      mode: 'subscription' as const,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.nextUrl.origin}/dashboard?upgraded=true`,
      cancel_url: `${req.nextUrl.origin}/pricing`,
      metadata: { creatorId: creator.id, plan },
    };

    let checkoutSession;

    if (creator.stripeId) {
      // Try with existing customer ID
      try {
        console.log(`[stripe/checkout] Using existing customer: ${creator.stripeId}`);
        checkoutSession = await stripe.checkout.sessions.create({
          customer: creator.stripeId,
          ...sessionParams,
        });
      } catch (err: any) {
        // If customer doesn't exist (wrong mode or deleted), fall back to email
        if (err?.code === 'resource_missing' || err?.statusCode === 404 || String(err).includes('No such customer')) {
          console.log(`[stripe/checkout] Customer ${creator.stripeId} not found, clearing and using email`);
          await db.creator.update({
            where: { id: creator.id },
            data: { stripeId: null },
          });
          checkoutSession = await stripe.checkout.sessions.create({
            customer_email: session.user.email,
            ...sessionParams,
          });
        } else {
          throw err;
        }
      }
    } else {
      // No customer ID, use email
      console.log(`[stripe/checkout] No customer ID, using email: ${session.user.email}`);
      checkoutSession = await stripe.checkout.sessions.create({
        customer_email: session.user.email,
        ...sessionParams,
      });
    }

    // Save new customer ID from checkout session if created
    if (checkoutSession.customer && !creator.stripeId) {
      const customerId = typeof checkoutSession.customer === 'string'
        ? checkoutSession.customer
        : checkoutSession.customer.id;
      await db.creator.update({
        where: { id: creator.id },
        data: { stripeId: customerId },
      });
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[stripe/checkout] Error:', err);
    return NextResponse.json(
      { error: `Stripe checkout failed: ${String(err)}` },
      { status: 500 }
    );
  }
}
