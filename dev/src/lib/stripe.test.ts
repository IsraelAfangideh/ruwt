import { describe, it, expect } from 'vitest';
import {
  CREDIT_PACKAGES,
  SUBSCRIPTION_PLANS,
  ENTERPRISE_TIER,
  getPackageById,
  getSubscriptionPlanById,
  type CreditPackage,
  type SubscriptionPlan,
} from './stripe';

describe('stripe', () => {
  // ---------------------------------------------------------------------------
  // CREDIT_PACKAGES constant
  // ---------------------------------------------------------------------------
  describe('CREDIT_PACKAGES', () => {
    it('has 3 credit packages', () => {
      expect(CREDIT_PACKAGES).toHaveLength(3);
    });

    it('packages are ordered from smallest to largest credits', () => {
      for (let i = 1; i < CREDIT_PACKAGES.length; i++) {
        expect(CREDIT_PACKAGES[i].credits).toBeGreaterThan(CREDIT_PACKAGES[i - 1].credits);
      }
    });

    it('each package has a unique id', () => {
      const ids = CREDIT_PACKAGES.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('each package has a positive price and credit amount', () => {
      for (const p of CREDIT_PACKAGES) {
        expect(p.credits).toBeGreaterThan(0);
        expect(p.priceInCents).toBeGreaterThan(0);
      }
    });

    it('larger packages have better per-credit pricing', () => {
      const perCredit = CREDIT_PACKAGES.map((p) => p.priceInCents / p.credits);
      for (let i = 1; i < perCredit.length; i++) {
        expect(perCredit[i]).toBeLessThan(perCredit[i - 1]);
      }
    });

    it('5000 credit package has no badge', () => {
      const small = CREDIT_PACKAGES.find((p) => p.credits === 5000)!;
      expect(small.badge).toBeUndefined();
    });

    it('25000 credit package is marked Popular', () => {
      const mid = CREDIT_PACKAGES.find((p) => p.credits === 25000)!;
      expect(mid.badge).toBe('Popular');
    });

    it('100000 credit package is marked Best Value', () => {
      const large = CREDIT_PACKAGES.find((p) => p.credits === 100000)!;
      expect(large.badge).toBe('Best Value');
    });
  });

  // ---------------------------------------------------------------------------
  // getPackageById
  // ---------------------------------------------------------------------------
  describe('getPackageById', () => {
    it('finds each package by its id', () => {
      for (const pkg of CREDIT_PACKAGES) {
        expect(getPackageById(pkg.id)).toEqual(pkg);
      }
    });

    it('returns undefined for an unknown id', () => {
      expect(getPackageById('credits-999999')).toBeUndefined();
    });

    it('returns undefined for an empty string', () => {
      expect(getPackageById('')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // SUBSCRIPTION_PLANS constant
  // ---------------------------------------------------------------------------
  describe('SUBSCRIPTION_PLANS', () => {
    it('has 2 subscription plans (monthly and annual)', () => {
      expect(SUBSCRIPTION_PLANS).toHaveLength(2);
    });

    it('monthly plan is $200/month', () => {
      const monthly = SUBSCRIPTION_PLANS.find((p) => p.interval === 'month')!;
      expect(monthly.priceInCents).toBe(20000);
      expect(monthly.monthlyEquivalent).toBe('$200');
    });

    it('annual plan is $1800/year with monthly equivalent of $150', () => {
      const annual = SUBSCRIPTION_PLANS.find((p) => p.interval === 'year')!;
      expect(annual.priceInCents).toBe(180000);
      expect(annual.monthlyEquivalent).toBe('$150');
    });

    it('annual plan is cheaper per month than monthly plan', () => {
      const monthly = SUBSCRIPTION_PLANS.find((p) => p.interval === 'month')!;
      const annual = SUBSCRIPTION_PLANS.find((p) => p.interval === 'year')!;
      const annualPerMonth = annual.priceInCents / 12;
      expect(annualPerMonth).toBeLessThan(monthly.priceInCents);
    });

    it('each plan has unique id', () => {
      const ids = SUBSCRIPTION_PLANS.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('each plan has non-empty features list', () => {
      for (const plan of SUBSCRIPTION_PLANS) {
        expect(plan.features.length).toBeGreaterThan(0);
      }
    });

    it('monthly plan has a badge', () => {
      const monthly = SUBSCRIPTION_PLANS.find((p) => p.id === 'plan-monthly')!;
      expect(monthly.badge).toBe('Most Popular');
    });

    it('annual plan has savings information', () => {
      const annual = SUBSCRIPTION_PLANS.find((p) => p.id === 'plan-annual')!;
      expect(annual.savings).toBeDefined();
      expect(annual.savings).toContain('25%');
    });
  });

  // ---------------------------------------------------------------------------
  // getSubscriptionPlanById
  // ---------------------------------------------------------------------------
  describe('getSubscriptionPlanById', () => {
    it('finds each subscription plan by its id', () => {
      for (const plan of SUBSCRIPTION_PLANS) {
        expect(getSubscriptionPlanById(plan.id)).toEqual(plan);
      }
    });

    it('returns undefined for an unknown id', () => {
      expect(getSubscriptionPlanById('plan-enterprise')).toBeUndefined();
    });

    it('returns undefined for an empty string', () => {
      expect(getSubscriptionPlanById('')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // ENTERPRISE_TIER constant
  // ---------------------------------------------------------------------------
  describe('ENTERPRISE_TIER', () => {
    it('has id "enterprise"', () => {
      expect(ENTERPRISE_TIER.id).toBe('enterprise');
    });

    it('has label "Enterprise"', () => {
      expect(ENTERPRISE_TIER.label).toBe('Enterprise');
    });

    it('includes SSO and API access in features', () => {
      expect(ENTERPRISE_TIER.features).toContain('SSO integration');
      expect(ENTERPRISE_TIER.features).toContain('API access');
    });

    it('has at least 5 features', () => {
      expect(ENTERPRISE_TIER.features.length).toBeGreaterThanOrEqual(5);
    });
  });
});
