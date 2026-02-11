/**
 * Ruwt Color System (from social)
 * Warm cream/dark palette with gold accent
 */

export const colors = {
  light: {
    bg: '#f5f3f0',
    bgWarm: '#ebe8e4',
    bgElevated: '#ffffff',
    text: '#1a1816',
    textMuted: '#5c564e',
    textSubtle: '#8a847a',
    accent: '#9a7b3c',
    accentMuted: '#7d6430',
    border: 'rgba(26, 24, 22, 0.08)',
    borderStrong: 'rgba(26, 24, 22, 0.15)',
    error: '#b06060',
    errorBg: 'rgba(176, 96, 96, 0.1)',
    success: '#5a8a5a',
    successBg: 'rgba(90, 138, 90, 0.1)',
    primary: '#1a1816',
    primaryForeground: '#f5f3f0',
    secondary: '#ebe8e4',
    secondaryForeground: '#1a1816',
    muted: '#ebe8e4',
    mutedForeground: '#5c564e',
    card: '#ffffff',
    cardForeground: '#1a1816',
    destructive: '#b06060',
    profit: '#16a34a',
    loss: '#dc2626',
  },
  dark: {
    bg: '#0f0e0d',
    bgWarm: '#1a1816',
    bgElevated: '#252220',
    text: '#e8e4df',
    textMuted: '#9a938a',
    textSubtle: '#6b645c',
    accent: '#c9a962',
    accentMuted: '#a08745',
    border: 'rgba(232, 228, 223, 0.08)',
    borderStrong: 'rgba(232, 228, 223, 0.15)',
    error: '#c87878',
    errorBg: 'rgba(200, 100, 100, 0.1)',
    success: '#7ab87a',
    successBg: 'rgba(122, 184, 122, 0.1)',
    primary: '#e8e4df',
    primaryForeground: '#0f0e0d',
    secondary: '#252220',
    secondaryForeground: '#e8e4df',
    muted: '#252220',
    mutedForeground: '#9a938a',
    card: '#252220',
    cardForeground: '#e8e4df',
    destructive: '#c87878',
    profit: '#00f0aa',
    loss: '#ff3366',
  },
};

export type ColorScheme = typeof colors.light;
export type ThemeMode = 'light' | 'dark';
