import { describe, it, expect } from 'vitest';
import { DIFFICULTIES, getDifficultyStyle, type Difficulty } from './difficulty';

describe('difficulty', () => {
  // ---------------------------------------------------------------------------
  // DIFFICULTIES constant
  // ---------------------------------------------------------------------------
  describe('DIFFICULTIES', () => {
    it('has 6 entries: "all" plus the 5 difficulty tiers', () => {
      expect(DIFFICULTIES).toHaveLength(6);
    });

    it('starts with the "all" filter option', () => {
      expect(DIFFICULTIES[0]).toEqual({ key: 'all', label: 'All Levels' });
    });

    it('contains all 5 difficulty tiers in order', () => {
      const keys = DIFFICULTIES.map((d) => d.key);
      expect(keys).toEqual(['all', 'sprint', 'easy', 'medium', 'hard', 'impossible']);
    });

    it('every entry has a non-empty label', () => {
      for (const d of DIFFICULTIES) {
        expect(d.label.length).toBeGreaterThan(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // getDifficultyStyle
  // ---------------------------------------------------------------------------
  describe('getDifficultyStyle', () => {
    it('returns correct light color and bg for sprint', () => {
      const style = getDifficultyStyle('sprint');
      expect(style.color).toBe('#15803d');
      expect(style.bg).toBe('rgba(34,197,94,0.12)');
      expect(style.label).toBe('Sprint');
    });

    it('returns correct light color and bg for easy', () => {
      const style = getDifficultyStyle('easy');
      expect(style.color).toBe('#0f766e');
      expect(style.bg).toBe('rgba(20,184,166,0.12)');
      expect(style.label).toBe('Easy');
    });

    it('returns correct light color and bg for medium', () => {
      const style = getDifficultyStyle('medium');
      expect(style.color).toBe('#0369a1');
      expect(style.bg).toBe('rgba(56,189,248,0.12)');
      expect(style.label).toBe('Medium');
    });

    it('returns correct light color and bg for hard', () => {
      const style = getDifficultyStyle('hard');
      expect(style.color).toBe('#7e22ce');
      expect(style.bg).toBe('rgba(168,85,247,0.12)');
      expect(style.label).toBe('Hard');
    });

    it('returns correct light color and bg for impossible', () => {
      const style = getDifficultyStyle('impossible');
      expect(style.color).toBe('#b91c1c');
      expect(style.bg).toBe('rgba(239,68,68,0.12)');
      expect(style.label).toBe('Impossible');
    });

    it('returns dark colors when isDark=true', () => {
      expect(getDifficultyStyle('sprint', true).color).toBe('#4ade80');
      expect(getDifficultyStyle('easy', true).color).toBe('#2dd4bf');
      expect(getDifficultyStyle('medium', true).color).toBe('#7dd3fc');
      expect(getDifficultyStyle('hard', true).color).toBe('#c084fc');
      expect(getDifficultyStyle('impossible', true).color).toBe('#fca5a5');
    });

    it('capitalizes the first letter of the difficulty as the label', () => {
      const tiers: Difficulty[] = ['sprint', 'easy', 'medium', 'hard', 'impossible'];
      for (const tier of tiers) {
        const style = getDifficultyStyle(tier);
        expect(style.label).toBe(tier.charAt(0).toUpperCase() + tier.slice(1));
      }
    });

    it('falls back to medium styles for an unrecognized difficulty string', () => {
      const style = getDifficultyStyle('legendary');
      // Style should match medium's light color/bg
      expect(style.color).toBe('#0369a1');
      expect(style.bg).toBe('rgba(56,189,248,0.12)');
    });

    it('still produces a capitalized label even for unrecognized difficulty', () => {
      const style = getDifficultyStyle('legendary');
      expect(style.label).toBe('Legendary');
    });

    it('handles empty string by falling back to medium', () => {
      const style = getDifficultyStyle('');
      expect(style.color).toBe('#0369a1');
      // empty string capitalized is still empty
      expect(style.label).toBe('');
    });
  });
});
