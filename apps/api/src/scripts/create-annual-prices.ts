/**
 * One-time script: Create annual Stripe prices for existing products.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/create-annual-prices.ts
 *
 * Prerequisites:
 *   - STRIPE_SECRET_KEY env var set
 *   - STRIPE_PRICE_CREATOR, STRIPE_PRICE_PRO, STRIPE_PRICE_STUDIO env vars set
 *     (to look up existing products)
 *
 * After running, copy the printed price IDs into your env vars:
 *   STRIPE_PRICE_CREATOR_ANNUAL=price_xxxxx
 *   STRIPE_PRICE_PRO_ANNUAL=price_xxxxx
 *   STRIPE_PRICE_STUDIO_ANNUAL=price_xxxxx
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

const ANNUAL_PLANS = [
  {
    name: 'Creator Annual',
    envKey: 'STRIPE_PRICE_CREATOR',
    annualAmountCents: 49000, // $490/year
  },
  {
    name: 'Pro Annual',
    envKey: 'STRIPE_PRICE_PRO',
    annualAmountCents: 99000, // $990/year
  },
  {
    name: 'Studio Annual',
    envKey: 'STRIPE_PRICE_STUDIO',
    annualAmountCents: 249000, // $2,490/year
  },
];

async function main() {
  console.log('Creating annual Stripe prices...\n');

  for (const plan of ANNUAL_PLANS) {
    const monthlyPriceId = process.env[plan.envKey];
    if (!monthlyPriceId) {
      console.error(`  SKIP ${plan.name}: ${plan.envKey} not set`);
      continue;
    }

    // Look up the monthly price to get its product ID
    const monthlyPrice = await stripe.prices.retrieve(monthlyPriceId);
    const productId =
      typeof monthlyPrice.product === 'string'
        ? monthlyPrice.product
        : monthlyPrice.product.id;

    console.log(`  ${plan.name}: product=${productId}`);

    // Create annual price on the same product
    const annualPrice = await stripe.prices.create({
      product: productId,
      unit_amount: plan.annualAmountCents,
      currency: 'usd',
      recurring: { interval: 'year' },
      metadata: { plan: plan.name },
    });

    console.log(`  -> ${plan.envKey}_ANNUAL=${annualPrice.id}\n`);
  }

  console.log('Done. Add the _ANNUAL price IDs to Railway and Vercel env vars.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
