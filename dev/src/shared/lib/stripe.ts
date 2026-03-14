/**
 * Credit packages for individual AI usage. Prices in cents (USD).
 * Individual practice is free; credits are only used for AI chat in the arena.
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
 * B2B subscription plans — flat-rate monthly/annual pricing for hiring teams.
 * Unlimited assessments, cancel anytime, 30-day money-back guarantee.
 */
export interface SubscriptionPlan {
  id: string;
  priceInCents: number;
  interval: 'month' | 'year';
  label: string;
  monthlyEquivalent: string;
  badge?: string;
  savings?: string;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-monthly',
    priceInCents: 20000,
    interval: 'month',
    label: '$200/month',
    monthlyEquivalent: '$200',
    badge: 'Most Popular',
    features: [
      'Unlimited assessments',
      'Unlimited candidate invites',
      'AI Profile analytics & radar charts',
      'Full session replays',
      'Candidate comparison & CSV export',
      'Custom challenges',
      'Cancel anytime',
    ],
  },
  {
    id: 'plan-annual',
    priceInCents: 180000,
    interval: 'year',
    label: '$1,800/year',
    monthlyEquivalent: '$150',
    badge: 'Best Value',
    savings: 'Save 25% ($600/year)',
    features: [
      'Everything in monthly',
      '25% discount vs monthly',
      'Annual commitment, billed once',
    ],
  },
];

export const ENTERPRISE_TIER = {
  id: 'enterprise',
  label: 'Enterprise',
  features: [
    'Everything in subscription',
    'SSO integration',
    'API access',
    'Dedicated support',
    'Custom SLA',
    'On-premise option',
  ],
};

export function getSubscriptionPlanById(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}
