import { describe, it, expect } from 'vitest';
import { spacing, fontSizes, radii, fontFamily } from './tokens';

describe('tokens', () => {
  // ---------------------------------------------------------------------------
  // Spacing
  // ---------------------------------------------------------------------------
  describe('spacing', () => {
    it('has all scale keys', () => {
      expect(spacing.xs).toBe(4);
      expect(spacing.sm).toBe(8);
      expect(spacing.md).toBe(16);
      expect(spacing.lg).toBe(24);
      expect(spacing.xl).toBe(32);
      expect(spacing['2xl']).toBe(48);
    });

    it('all values are positive numbers', () => {
      for (const [key, value] of Object.entries(spacing)) {
        expect(typeof value, `spacing.${key} should be a number`).toBe('number');
        expect(value, `spacing.${key} should be positive`).toBeGreaterThan(0);
      }
    });

    it('values increase monotonically from xs to 2xl', () => {
      const ordered = [spacing.xs, spacing.sm, spacing.md, spacing.lg, spacing.xl, spacing['2xl']];
      for (let i = 1; i < ordered.length; i++) {
        expect(ordered[i]).toBeGreaterThan(ordered[i - 1]);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Font sizes
  // ---------------------------------------------------------------------------
  describe('fontSizes', () => {
    it('has all scale keys', () => {
      expect(fontSizes.xs).toBe(12);
      expect(fontSizes.sm).toBe(14);
      expect(fontSizes.md).toBe(16);
      expect(fontSizes.lg).toBe(18);
      expect(fontSizes.xl).toBe(20);
      expect(fontSizes['2xl']).toBe(24);
      expect(fontSizes['3xl']).toBe(30);
      expect(fontSizes['4xl']).toBe(36);
    });

    it('all values are positive numbers', () => {
      for (const [key, value] of Object.entries(fontSizes)) {
        expect(typeof value, `fontSizes.${key} should be a number`).toBe('number');
        expect(value, `fontSizes.${key} should be positive`).toBeGreaterThan(0);
      }
    });

    it('values increase monotonically', () => {
      const ordered = [
        fontSizes.xs, fontSizes.sm, fontSizes.md, fontSizes.lg,
        fontSizes.xl, fontSizes['2xl'], fontSizes['3xl'], fontSizes['4xl'],
      ];
      for (let i = 1; i < ordered.length; i++) {
        expect(ordered[i]).toBeGreaterThan(ordered[i - 1]);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Radii
  // ---------------------------------------------------------------------------
  describe('radii', () => {
    it('has all scale keys', () => {
      expect(radii.sm).toBe(4);
      expect(radii.md).toBe(8);
      expect(radii.lg).toBe(12);
      expect(radii.xl).toBe(16);
      expect(radii.full).toBe(9999);
    });

    it('all values are non-negative numbers', () => {
      for (const [key, value] of Object.entries(radii)) {
        expect(typeof value, `radii.${key} should be a number`).toBe('number');
        expect(value, `radii.${key} should be non-negative`).toBeGreaterThanOrEqual(0);
      }
    });

    it('full radius is largest', () => {
      expect(radii.full).toBeGreaterThan(radii.xl);
    });
  });

  // ---------------------------------------------------------------------------
  // Font family
  // ---------------------------------------------------------------------------
  describe('fontFamily', () => {
    it('display uses Cormorant Garamond', () => {
      expect(fontFamily.display).toContain('Cormorant Garamond');
      expect(fontFamily.display).toContain('serif');
    });

    it('body uses Libre Franklin', () => {
      expect(fontFamily.body).toContain('Libre Franklin');
      expect(fontFamily.body).toContain('sans-serif');
    });
  });
});
