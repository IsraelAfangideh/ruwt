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

const DIFFICULTY_STYLES: Record<Difficulty, { color: string; bg: string }> = {
  sprint: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  easy: { color: '#14b8a6', bg: 'rgba(20,184,166,0.12)' },
  medium: { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  hard: { color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  impossible: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

export function getDifficultyStyle(difficulty: string): { color: string; bg: string; label: string } {
  const tier = difficulty as Difficulty;
  const style = DIFFICULTY_STYLES[tier] || DIFFICULTY_STYLES.medium;
  const label = tier.charAt(0).toUpperCase() + tier.slice(1);
  return { ...style, label };
}
