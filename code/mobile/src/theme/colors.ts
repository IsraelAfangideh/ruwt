/**
 * Ruwt Color System
 * Matches the website aesthetic - warm earth tones with burnished gold
 */

export const colors = {
  light: {
    // Backgrounds
    bg: '#f5f3f0',
    bgWarm: '#ebe8e4',
    bgElevated: '#ffffff',
    
    // Text
    text: '#1a1816',
    textMuted: '#5c564e',
    textSubtle: '#8a847a',
    
    // Accent (gold)
    accent: '#9a7b3c',
    accentMuted: '#7d6430',
    
    // Borders
    border: 'rgba(26, 24, 22, 0.08)',
    borderStrong: 'rgba(26, 24, 22, 0.15)',
    
    // Message bubbles
    userBubble: '#9a7b3c',
    userBubbleText: '#ffffff',
    runnerBubble: '#ebe8e4',
    runnerBubbleText: '#1a1816',
    
    // Action buttons
    sendButton: '#1a1816',
    sendButtonText: '#ffffff',
    kindButton: '#9a7b3c',
    kindButtonText: '#9a7b3c',
    kindButtonBorder: '#9a7b3c',
    copyButton: 'transparent',
    copyButtonText: '#5c564e',
    copyButtonBorder: 'rgba(26, 24, 22, 0.15)',
    
    // Status
    error: '#b06060',
    errorBg: 'rgba(176, 96, 96, 0.1)',
    success: '#5a8a5a',
    successBg: 'rgba(90, 138, 90, 0.1)',
    blocked: '#b06060',
    blockedBg: '#fdf2f2',
  },
  
  dark: {
    // Backgrounds
    bg: '#0f0e0d',
    bgWarm: '#1a1816',
    bgElevated: '#252220',
    
    // Text
    text: '#e8e4df',
    textMuted: '#9a938a',
    textSubtle: '#6b645c',
    
    // Accent (gold)
    accent: '#c9a962',
    accentMuted: '#a08745',
    
    // Borders
    border: 'rgba(232, 228, 223, 0.08)',
    borderStrong: 'rgba(232, 228, 223, 0.15)',
    
    // Message bubbles
    userBubble: '#c9a962',
    userBubbleText: '#0f0e0d',
    runnerBubble: '#1a1816',
    runnerBubbleText: '#e8e4df',
    
    // Action buttons
    sendButton: '#c9a962',
    sendButtonText: '#0f0e0d',
    kindButton: 'transparent',
    kindButtonText: '#c9a962',
    kindButtonBorder: '#c9a962',
    copyButton: 'transparent',
    copyButtonText: '#9a938a',
    copyButtonBorder: 'rgba(232, 228, 223, 0.15)',
    
    // Status
    error: '#c87878',
    errorBg: 'rgba(200, 100, 100, 0.1)',
    success: '#7ab87a',
    successBg: 'rgba(122, 184, 122, 0.1)',
    blocked: '#c87878',
    blockedBg: 'rgba(200, 100, 100, 0.15)',
  },
};

export type ColorScheme = typeof colors.light;
export type ThemeMode = 'light' | 'dark';

