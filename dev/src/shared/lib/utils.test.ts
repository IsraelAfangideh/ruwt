import { describe, it, expect } from 'vitest';
import { timeAgo, formatCategory, generateHeatmapDays, formatTime } from './utils';

describe('utils', () => {
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
