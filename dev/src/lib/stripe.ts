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
 * B2B assessment packs — credit-based pricing for hiring teams.
 */
export interface AssessmentPack {
  id: string;
  assessments: number | null; // null = enterprise/custom
  priceInCents: number; // 0 = contact us
  label: string;
  badge?: string;
  features: string[];
}

export const ASSESSMENT_PACKS: AssessmentPack[] = [
  {
    id: 'pack-10',
    assessments: 10,
    priceInCents: 9900,
    label: '10 Assessments',
    features: ['Create custom assessments', 'Results dashboard', 'CSV export', 'All 60+ challenges'],
  },
  {
    id: 'pack-50',
    assessments: 50,
    priceInCents: 39900,
    label: '50 Assessments',
    badge: 'Popular',
    features: ['Everything in 10-pack', 'AI profile analytics', 'Candidate comparison', 'Priority support'],
  },
  {
    id: 'pack-200',
    assessments: 200,
    priceInCents: 99900,
    label: '200 Assessments',
    badge: 'Best Value',
    features: ['Everything in 50-pack', 'SSO integration', 'API access', 'Custom challenges'],
  },
  {
    id: 'pack-enterprise',
    assessments: null,
    priceInCents: 0,
    label: 'Enterprise',
    features: ['Unlimited assessments', 'Dedicated support', 'Custom SLA', 'On-premise option'],
  },
];

export function getAssessmentPackById(id: string): AssessmentPack | undefined {
  return ASSESSMENT_PACKS.find((p) => p.id === id);
}
