import Stripe from 'stripe';

// Lazy initialization to avoid errors during build
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });
  }
  return stripeClient;
}

// Export for backward compatibility (will throw if env not set)
export const stripe = {
  get webhooks() {
    return getStripe().webhooks;
  },
  get checkout() {
    return getStripe().checkout;
  },
};

// Credit packages available for purchase
export const CREDIT_PACKAGES = [
  {
    id: 'credits_500',
    name: '500 Credits',
    credits: 500,
    price: 500, // $5.00 in cents
    description: 'Good for getting started',
  },
  {
    id: 'credits_2000',
    name: '2,000 Credits',
    credits: 2000,
    price: 1500, // $15.00 in cents
    description: 'Most popular',
    popular: true,
  },
  {
    id: 'credits_5000',
    name: '5,000 Credits',
    credits: 5000,
    price: 3000, // $30.00 in cents
    description: 'Best value',
  },
] as const;

export type CreditPackage = (typeof CREDIT_PACKAGES)[number];

// Convert credits to dollars for display
export function creditsToDollars(credits: number): string {
  return (credits / 100).toFixed(2);
}

// Convert dollars to credits
export function dollarsToCredits(dollars: number): number {
  return Math.floor(dollars * 100);
}
