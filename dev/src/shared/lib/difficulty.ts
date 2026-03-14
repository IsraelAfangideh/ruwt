/**
 * Shared difficulty tier utilities for the 5-tier system:
 * sprint | easy | medium | hard | impossible
 */

export type Difficulty = 'sprint' | 'easy' | 'medium' | 'hard' | 'impossible';

export const DIFFICULTIES: { key: Difficulty | 'all'; label: string }[] = [
  { key: 'all', label: 'All Levels' },
  { key: 'sprint', label: 'Sprint' },
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
  { key: 'impossible', label: 'Impossible' },
];

const DIFFICULTY_STYLES: Record<Difficulty, { light: string; dark: string; bg: string }> = {
  sprint:     { light: '#15803d', dark: '#4ade80', bg: 'rgba(34,197,94,0.12)' },
  easy:       { light: '#0f766e', dark: '#2dd4bf', bg: 'rgba(20,184,166,0.12)' },
  medium:     { light: '#0369a1', dark: '#7dd3fc', bg: 'rgba(56,189,248,0.12)' },
  hard:       { light: '#7e22ce', dark: '#c084fc', bg: 'rgba(168,85,247,0.12)' },
  impossible: { light: '#b91c1c', dark: '#fca5a5', bg: 'rgba(239,68,68,0.12)' },
};

export function getDifficultyStyle(difficulty: string, isDark = false): { color: string; bg: string; label: string } {
  const tier = difficulty as Difficulty;
  const style = DIFFICULTY_STYLES[tier] || DIFFICULTY_STYLES.medium;
  const label = tier.charAt(0).toUpperCase() + tier.slice(1);
  return { color: isDark ? style.dark : style.light, bg: style.bg, label };
}
