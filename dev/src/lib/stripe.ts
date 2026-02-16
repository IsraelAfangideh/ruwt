/**
 * Credit packages for purchase. Prices in cents (USD).
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
