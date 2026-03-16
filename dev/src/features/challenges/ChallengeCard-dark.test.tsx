// @vitest-environment jsdom
/**
 * Dark-mode variant of ChallengeCard tests.
 * Exercises isDark=true branches in catColor and language pill color ternaries.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Challenge } from './ChallengeCard';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  Pressable: ({ children, onPress, style, ...p }: any) => {
    const resolvedStyle = typeof style === 'function' ? style({ pressed: false }) : style;
    return <button onClick={onPress} style={resolvedStyle} {...p}>{typeof children === 'function' ? children({ pressed: false }) : children}</button>;
  },
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn() }),
}));

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockDarkTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

vi.mock('@/shared/lib/difficulty', () => ({
  getDifficultyStyle: (d: string) => ({
    color: d === 'easy' ? '#14b8a6' : d === 'hard' ? '#a855f7' : '#38bdf8',
    bg: 'rgba(0,0,0,0.1)',
    label: d.charAt(0).toUpperCase() + d.slice(1),
  }),
}));

const { ChallengeCard } = await import('./ChallengeCard');

const baseChallenge: Challenge = {
  id: 'ch-1',
  title: 'Debounce Function',
  description: 'Implement a debounce function',
  difficulty: 'easy',
  category: 'prompt_efficiency',
};

describe('ChallengeCard (dark mode)', () => {
  it('renders with isDark=true catColor for all categories', () => {
    const categories = [
      'model_selection', 'prompt_efficiency', 'iterative_debugging',
      'multi_model_strategy', 'real_world', 'qa_testing',
      'frontend', 'backend_api', 'data_engineering', 'devops', 'unknown_cat',
    ];
    for (const cat of categories) {
      const { unmount } = render(<ChallengeCard challenge={{ ...baseChallenge, category: cat }} />);
      expect(screen.getByText('Debounce Function')).toBeInTheDocument();
      unmount();
    }
  });

  it('renders language pill with dark color for typescript and python', () => {
    const { unmount } = render(<ChallengeCard challenge={{ ...baseChallenge, language: 'typescript' }} />);
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    unmount();
    render(<ChallengeCard challenge={{ ...baseChallenge, language: 'python' }} />);
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('renders solved card with user best cost and singular solver in dark mode', () => {
    render(<ChallengeCard challenge={{ ...baseChallenge, userStatus: 'passed', userBestCost: 3000, stats: { solvers: 1, avgCost: 5000 } }} />);
    expect(screen.getByText(/Improve Score/)).toBeInTheDocument();
  });
});
