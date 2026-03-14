import { describe, it, expect } from 'vitest';
import { colors, arena } from './colors';
import type { ColorScheme, ThemeMode } from './colors';

describe('colors', () => {
  // ---------------------------------------------------------------------------
  // Light theme
  // ---------------------------------------------------------------------------
  describe('light theme', () => {
    it('has all required color keys', () => {
      const requiredKeys: (keyof ColorScheme)[] = [
        'bg', 'bgWarm', 'bgElevated', 'text', 'textMuted', 'textSubtle',
        'accent', 'accentMuted', 'border', 'borderStrong',
        'error', 'errorBg', 'success', 'successBg', 'accentBg',
        'primary', 'primaryForeground', 'secondary', 'secondaryForeground',
        'muted', 'mutedForeground', 'card', 'cardForeground',
        'destructive', 'profit', 'loss',
      ];
      for (const key of requiredKeys) {
        expect(colors.light[key], `light.${key} should be defined`).toBeDefined();
        expect(typeof colors.light[key]).toBe('string');
      }
    });

    it('uses warm cream background (#f5f3f0)', () => {
      expect(colors.light.bg).toBe('#f5f3f0');
    });

    it('uses dark text (#1a1816)', () => {
      expect(colors.light.text).toBe('#1a1816');
    });

    it('uses gold accent (#846a30)', () => {
      expect(colors.light.accent).toBe('#846a30');
    });

    it('has white card background', () => {
      expect(colors.light.card).toBe('#ffffff');
    });
  });

  // ---------------------------------------------------------------------------
  // Dark theme
  // ---------------------------------------------------------------------------
  describe('dark theme', () => {
    it('has all required color keys', () => {
      const requiredKeys: (keyof ColorScheme)[] = [
        'bg', 'bgWarm', 'bgElevated', 'text', 'textMuted', 'textSubtle',
        'accent', 'accentMuted', 'border', 'borderStrong',
        'error', 'errorBg', 'success', 'successBg', 'accentBg',
        'primary', 'primaryForeground', 'secondary', 'secondaryForeground',
        'muted', 'mutedForeground', 'card', 'cardForeground',
        'destructive', 'profit', 'loss',
      ];
      for (const key of requiredKeys) {
        expect(colors.dark[key], `dark.${key} should be defined`).toBeDefined();
        expect(typeof colors.dark[key]).toBe('string');
      }
    });

    it('uses dark background (#0f0e0d)', () => {
      expect(colors.dark.bg).toBe('#0f0e0d');
    });

    it('uses light text (#e8e4df)', () => {
      expect(colors.dark.text).toBe('#e8e4df');
    });

    it('uses brighter gold accent (#c9a962)', () => {
      expect(colors.dark.accent).toBe('#c9a962');
    });

    it('has dark card background', () => {
      expect(colors.dark.card).toBe('#252220');
    });
  });

  // ---------------------------------------------------------------------------
  // Light/dark parity: same keys in both schemes
  // ---------------------------------------------------------------------------
  describe('light/dark parity', () => {
    it('both schemes have identical keys', () => {
      const lightKeys = Object.keys(colors.light).sort();
      const darkKeys = Object.keys(colors.dark).sort();
      expect(lightKeys).toEqual(darkKeys);
    });
  });

  // ---------------------------------------------------------------------------
  // Arena theme
  // ---------------------------------------------------------------------------
  describe('arena', () => {
    it('has all required arena color keys', () => {
      const requiredKeys: (keyof typeof arena)[] = [
        'bg', 'surface', 'surfaceHover', 'border', 'text',
        'textMuted', 'textSubtle', 'accent', 'accentBg',
        'success', 'error',
      ];
      for (const key of requiredKeys) {
        expect(arena[key], `arena.${key} should be defined`).toBeDefined();
        expect(typeof arena[key]).toBe('string');
      }
    });

    it('uses GitHub-dark-like background (#0d1117)', () => {
      expect(arena.bg).toBe('#0d1117');
    });

    it('shares gold accent with dark theme', () => {
      expect(arena.accent).toBe('#c9a962');
    });
  });

  // ---------------------------------------------------------------------------
  // Type exports (compile-time check, runtime assertion that they resolve)
  // ---------------------------------------------------------------------------
  describe('type exports', () => {
    it('ColorScheme type matches light theme shape', () => {
      const scheme: ColorScheme = colors.light;
      expect(scheme.bg).toBeDefined();
    });

    it('ThemeMode type accepts light and dark', () => {
      const modes: ThemeMode[] = ['light', 'dark'];
      expect(modes).toHaveLength(2);
    });
  });
});
