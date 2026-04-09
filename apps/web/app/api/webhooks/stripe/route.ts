export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import Stripe from 'stripe';

const API_BASE = process.env.API_BASE_URL || 'https://devmaxx-production.up.railway.app';

async function processReferralConversion(creatorId: string) {
  const creator = await db.creator.findUnique({ where: { id: creatorId } });
  if (!creator?.referredBy) return;

  // Find the referrer
  const referrer = await db.creator.findUnique({
    where: { referralCode: creator.referredBy },
  });
  if (!referrer) {
    console.log(`[Referral] Referrer not found for code: ${creator.referredBy}`);
    return;
  }

  // Check if already credited for this referral
  const existingReferral = await db.referral.findFirst({
    where: { referredId: creatorId, status: 'credited' },
  });
  if (existingReferral) {
    console.log(`[Referral] Already credited for ${creator.email}`);
    return;
  }

  // Update or create Referral record
  const pendingReferral = await db.referral.findFirst({
    where: { referredId: creatorId, referrerId: referrer.id },
  });

  if (pendingReferral) {
    await db.referral.update({
      where: { id: pendingReferral.id },
      data: {
        status: 'credited',
        convertedAt: new Date(),
        creditedAt: new Date(),
      },
    });
  } else {
    await db.referral.create({
      data: {
        referrerCode: creator.referredBy,
        referrerId: referrer.id,
        referredId: creatorId,
        referredEmail: creator.email,
        status: 'credited',
        convertedAt: new Date(),
        creditedAt: new Date(),
      },
    });
  }

  // Give referrer 1 month free credit
  await db.creator.update({
    where: { id: referrer.id },
    data: { referralCredits: { increment: 1 } },
  });

  // Apply Stripe credit to referrer's account if they have a Stripe customer
  if (referrer.stripeId) {
    try {
      // Add $49 credit (1 month of Creator plan) to customer balance
      await stripe.customers.createBalanceTransaction(referrer.stripeId, {
        amount: -4900, // Negative = credit, in cents
        currency: 'usd',
        description: `Referral credit: ${creator.email} upgraded via your referral link`,
      });
      console.log(`[Referral] Applied $49 Stripe credit to ${referrer.email}`);
    } catch (err) {
      console.error(`[Referral] Failed to apply Stripe credit to ${referrer.email}:`, err);
    }
  }

  // Send referral credit email to referrer
  try {
    await fetch(`${API_BASE}/api/onboarding/referral-credit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referrerEmail: referrer.email,
        referredEmail: creator.email,
      }),
    });
  } catch (err) {
    console.error(`[Referral] Failed to send credit email to ${referrer.email}:`, err);
  }

  console.log(
    `[Referral] Credited ${referrer.email} for referral of ${creator.email} (total credits: ${referrer.referralCredits + 1})`
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const creatorId = session.metadata?.creatorId;
      const plan = session.metadata?.plan;

      if (creatorId && plan) {
        await db.creator.update({
          where: { id: creatorId },
          data: { plan },
        });

        // Process referral conversion
        await processReferralConversion(creatorId);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;

      await db.creator.updateMany({
        where: { stripeId: customerId },
        data: { plan: 'free', autopilot: false },
      });
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.cancel_at_period_end) {
        // Subscription will cancel at period end — could notify creator
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
