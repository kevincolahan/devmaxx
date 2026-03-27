import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
});

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    games: 1,
    stripePriceId: null,
  },
  creator: {
    name: 'Creator',
    price: 49,
    games: 2,
    stripePriceId: process.env.STRIPE_PRICE_CREATOR!,
  },
  pro: {
    name: 'Pro',
    price: 99,
    games: 5,
    stripePriceId: process.env.STRIPE_PRICE_PRO!,
  },
  studio: {
    name: 'Studio',
    price: 249,
    games: Infinity,
    stripePriceId: process.env.STRIPE_PRICE_STUDIO!,
  },
} as const;
