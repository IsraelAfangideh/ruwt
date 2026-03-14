import { describe, it, expect } from 'vitest';
import * as themeIndex from './index';

describe('theme/index re-exports', () => {
  it('re-exports colors', () => {
    expect(themeIndex.colors).toBeDefined();
    expect(themeIndex.colors.light).toBeDefined();
    expect(themeIndex.colors.dark).toBeDefined();
  });

  it('re-exports ThemeProvider', () => {
    expect(typeof themeIndex.ThemeProvider).toBe('function');
  });

  it('re-exports useTheme', () => {
    expect(typeof themeIndex.useTheme).toBe('function');
  });

  it('re-exports useColors', () => {
    expect(typeof themeIndex.useColors).toBe('function');
  });

  it('re-exports spacing', () => {
    expect(themeIndex.spacing).toBeDefined();
    expect(typeof themeIndex.spacing.md).toBe('number');
  });

  it('re-exports fontSizes', () => {
    expect(themeIndex.fontSizes).toBeDefined();
    expect(typeof themeIndex.fontSizes.md).toBe('number');
  });

  it('re-exports radii', () => {
    expect(themeIndex.radii).toBeDefined();
    expect(typeof themeIndex.radii.md).toBe('number');
  });

  it('re-exports fontFamily', () => {
    expect(themeIndex.fontFamily).toBeDefined();
    expect(typeof themeIndex.fontFamily.body).toBe('string');
  });
});
