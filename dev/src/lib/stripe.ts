/**
 * Credit packages for assessment purchases. Prices in cents (USD).
 * Individual practice is free; credits are only used for B2B assessments.
 */

export interface CreditPackage {
  id: string;
  credits: number;
  priceInCents: number;
  label: string;
  badge?: string;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'credits-5000', credits: 5000, priceInCents: 499, label: '5,000 Credits' },
  { id: 'credits-25000', credits: 25000, priceInCents: 1499, label: '25,000 Credits', badge: 'Popular' },
  { id: 'credits-100000', credits: 100000, priceInCents: 3999, label: '100,000 Credits', badge: 'Best Value' },
];

export function getPackageById(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}

/**
 * B2B subscription tiers for hiring assessments.
 */
export interface SubscriptionTier {
  id: string;
  name: string;
  priceInCents: number; // monthly
  candidatesPerMonth: number | null; // null = unlimited
  features: string[];
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'tier-starter',
    name: 'Starter',
    priceInCents: 19900,
    candidatesPerMonth: 10,
    features: ['Create assessments', 'Results dashboard', 'CSV export', 'All challenges'],
  },
  {
    id: 'tier-pro',
    name: 'Pro',
    priceInCents: 49900,
    candidatesPerMonth: 50,
    features: ['All Starter features', 'AI profile analytics', 'Candidate comparison', 'Priority support'],
  },
  {
    id: 'tier-enterprise',
    name: 'Enterprise',
    priceInCents: 0, // custom pricing
    candidatesPerMonth: null,
    features: ['Unlimited candidates', 'SSO', 'API access', 'Custom challenges', 'Dedicated support'],
  },
];
