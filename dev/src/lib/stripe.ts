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
  { id: 'credits-500', credits: 500, priceInCents: 500, label: '500 Credits' },
  { id: 'credits-2000', credits: 2000, priceInCents: 1500, label: '2,000 Credits', badge: 'Popular' },
  { id: 'credits-5000', credits: 5000, priceInCents: 3000, label: '5,000 Credits', badge: 'Best Value' },
];

export function getPackageById(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}
