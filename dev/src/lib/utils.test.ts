import { describe, it, expect } from 'vitest';
import { flattenStyle } from './utils';

describe('utils', () => {
  // ---------------------------------------------------------------------------
  // flattenStyle
  // ---------------------------------------------------------------------------
  describe('flattenStyle', () => {
    it('returns undefined for null input', () => {
      expect(flattenStyle(null)).toBeUndefined();
    });

    it('returns undefined for undefined input', () => {
      expect(flattenStyle(undefined)).toBeUndefined();
    });

    it('returns the style object as-is when given a single object (not array)', () => {
      const style = { flex: 1, backgroundColor: 'red' };
      expect(flattenStyle(style)).toBe(style);
    });

    it('merges an array of style objects into one', () => {
      const result = flattenStyle([
        { flex: 1, padding: 10 },
        { backgroundColor: 'blue', padding: 20 },
      ]);
      expect(result).toEqual({ flex: 1, padding: 20, backgroundColor: 'blue' });
    });

    it('later array entries override earlier ones for the same property', () => {
      const result = flattenStyle([
        { color: 'red', fontSize: 14 },
        { color: 'green' },
        { color: 'blue' },
      ]);
      expect(result).toEqual({ color: 'blue', fontSize: 14 });
    });

    it('filters out falsy values in the array (null, undefined, false)', () => {
      const result = flattenStyle([
        { flex: 1 },
        null,
        undefined,
        false,
        { padding: 5 },
      ] as any);
      expect(result).toEqual({ flex: 1, padding: 5 });
    });

    it('handles an empty array by returning an empty object', () => {
      const result = flattenStyle([]);
      expect(result).toEqual({});
    });

    it('handles a single-element array', () => {
      const style = { margin: 10 };
      const result = flattenStyle([style]);
      expect(result).toEqual({ margin: 10 });
    });

    it('handles an array of all falsy values', () => {
      const result = flattenStyle([null, undefined, false] as any);
      expect(result).toEqual({});
    });

    it('preserves numeric zero values in styles', () => {
      const result = flattenStyle([{ padding: 10 }, { padding: 0 }]);
      expect(result).toEqual({ padding: 0 });
    });
  });
});
