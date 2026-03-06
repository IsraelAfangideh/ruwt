import { describe, it, expect } from 'vitest';
import { flattenStyle, timeAgo, formatCategory, generateHeatmapDays, formatTime } from './utils';

describe('utils', () => {
  // ---------------------------------------------------------------------------
  // flattenStyle
  // ---------------------------------------------------------------------------
  describe('flattenStyle', () => {
    it('returns undefined for null input', () => {
      expect(flattenStyle(null as any)).toBeUndefined();
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

  describe('timeAgo', () => {
    it('returns empty string for null', () => {
      expect(timeAgo(null)).toBe('');
    });

    it('returns "just now" for recent timestamps', () => {
      expect(timeAgo(new Date().toISOString())).toBe('just now');
    });

    it('returns minutes ago', () => {
      const ts = new Date(Date.now() - 5 * 60_000).toISOString();
      expect(timeAgo(ts)).toBe('5m ago');
    });

    it('returns hours ago', () => {
      const ts = new Date(Date.now() - 3 * 3600_000).toISOString();
      expect(timeAgo(ts)).toBe('3h ago');
    });

    it('returns "yesterday"', () => {
      const ts = new Date(Date.now() - 24 * 3600_000).toISOString();
      expect(timeAgo(ts)).toBe('yesterday');
    });

    it('returns days ago', () => {
      const ts = new Date(Date.now() - 5 * 24 * 3600_000).toISOString();
      expect(timeAgo(ts)).toBe('5d ago');
    });

    it('returns months ago', () => {
      const ts = new Date(Date.now() - 60 * 24 * 3600_000).toISOString();
      expect(timeAgo(ts)).toBe('2mo ago');
    });
  });

  describe('formatCategory', () => {
    it('converts snake_case to Title Case', () => {
      expect(formatCategory('model_selection')).toBe('Model Selection');
    });

    it('handles single word', () => {
      expect(formatCategory('debugging')).toBe('Debugging');
    });
  });

  describe('generateHeatmapDays', () => {
    it('returns 91 days', () => {
      expect(generateHeatmapDays()).toHaveLength(91);
    });

    it('ends with today', () => {
      const days = generateHeatmapDays();
      expect(days[90]).toBe(new Date().toISOString().split('T')[0]);
    });
  });

  describe('formatTime', () => {
    it('formats 0 seconds', () => {
      expect(formatTime(0)).toBe('0:00');
    });

    it('formats seconds with padding', () => {
      expect(formatTime(65)).toBe('1:05');
    });

    it('formats larger values', () => {
      expect(formatTime(3661)).toBe('61:01');
    });
  });
});
