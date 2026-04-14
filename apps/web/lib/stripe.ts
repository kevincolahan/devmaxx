import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    games: 1,
    stripePriceId: null,
    stripeAnnualPriceId: null,
  },
  creator: {
    name: 'Creator',
    price: 49,
    annualPrice: 490,
    games: 2,
    stripePriceId: process.env.STRIPE_PRICE_CREATOR!,
    stripeAnnualPriceId: process.env.STRIPE_PRICE_CREATOR_ANNUAL || null,
  },
  pro: {
    name: 'Pro',
    price: 99,
    annualPrice: 990,
    games: 5,
    stripePriceId: process.env.STRIPE_PRICE_PRO!,
    stripeAnnualPriceId: process.env.STRIPE_PRICE_PRO_ANNUAL || null,
  },
  studio: {
    name: 'Studio',
    price: 249,
    annualPrice: 2490,
    games: Infinity,
    stripePriceId: process.env.STRIPE_PRICE_STUDIO!,
    stripeAnnualPriceId: process.env.STRIPE_PRICE_STUDIO_ANNUAL || null,
  },
} as const;
