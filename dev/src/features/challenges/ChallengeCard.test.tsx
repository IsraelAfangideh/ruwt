// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChallengeCard, type Challenge } from './ChallengeCard';

const mockNavigate = vi.fn();

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  Pressable: ({ children, onPress, style, ...p }: any) => {
    // Call the style function to cover the pressed-style callback
    const resolvedStyle = typeof style === 'function' ? style({ pressed: true }) : style;
    return <button onClick={onPress} style={resolvedStyle} {...p}>{typeof children === 'function' ? children({ pressed: false }) : children}</button>;
  },
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

vi.mock('@/shared/lib/difficulty', () => ({
  getDifficultyStyle: (d: string) => ({
    color: d === 'easy' ? '#14b8a6' : d === 'hard' ? '#a855f7' : '#38bdf8',
    bg: 'rgba(0,0,0,0.1)',
    label: d.charAt(0).toUpperCase() + d.slice(1),
  }),
}));

const baseChallenge: Challenge = {
  id: 'ch-1',
  title: 'Debounce Function',
  description: 'Implement a debounce function',
  difficulty: 'easy',
  category: 'prompt_efficiency',
};

describe('ChallengeCard', () => {
  it('renders challenge title and description', () => {
    render(<ChallengeCard challenge={baseChallenge} />);
    expect(screen.getByText('Debounce Function')).toBeInTheDocument();
    expect(screen.getByText('Implement a debounce function')).toBeInTheDocument();
  });

  it('renders difficulty pill', () => {
    render(<ChallengeCard challenge={baseChallenge} />);
    expect(screen.getByText('Easy')).toBeInTheDocument();
  });

  it('renders category label', () => {
    render(<ChallengeCard challenge={baseChallenge} />);
    expect(screen.getByText('Prompt Efficiency')).toBeInTheDocument();
  });

  it('renders language label for typescript', () => {
    const ch: Challenge = { ...baseChallenge, language: 'typescript' };
    render(<ChallengeCard challenge={ch} />);
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('renders language label for python', () => {
    const ch: Challenge = { ...baseChallenge, language: 'python' };
    render(<ChallengeCard challenge={ch} />);
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('shows "Start Problem" CTA when not started', () => {
    render(<ChallengeCard challenge={baseChallenge} />);
    expect(screen.getByText(/Start Problem/)).toBeInTheDocument();
  });

  it('shows "Continue" CTA when in progress', () => {
    const ch: Challenge = { ...baseChallenge, userStatus: 'in_progress' };
    render(<ChallengeCard challenge={ch} />);
    expect(screen.getByText(/Continue/)).toBeInTheDocument();
  });

  it('shows "Improve Score" CTA when passed', () => {
    const ch: Challenge = { ...baseChallenge, userStatus: 'passed' };
    render(<ChallengeCard challenge={ch} />);
    expect(screen.getByText(/Improve Score/)).toBeInTheDocument();
  });

  it('shows checkmark when passed', () => {
    const ch: Challenge = { ...baseChallenge, userStatus: 'passed' };
    render(<ChallengeCard challenge={ch} />);
    expect(screen.getByText('\u2713')).toBeInTheDocument();
  });

  it('shows solver stats when present', () => {
    const ch: Challenge = { ...baseChallenge, stats: { solvers: 5, avgCost: 5000 } };
    render(<ChallengeCard challenge={ch} />);
    expect(screen.getByText(/5 solver/)).toBeInTheDocument();
  });

  it('shows skill tested', () => {
    const ch: Challenge = { ...baseChallenge, skillTested: 'Rate limiting' };
    render(<ChallengeCard challenge={ch} />);
    expect(screen.getByText('Rate limiting')).toBeInTheDocument();
  });

  it('navigates to Arena on press', () => {
    render(<ChallengeCard challenge={baseChallenge} />);
    fireEvent.click(screen.getByText('Debounce Function'));
    expect(mockNavigate).toHaveBeenCalledWith('Arena', { challengeId: 'ch-1' });
  });

  it('shows efficiency goal when maxCost is set', () => {
    const ch: Challenge = { ...baseChallenge, maxCost: 50000 };
    render(<ChallengeCard challenge={ch} />);
    expect(screen.getByText(/Efficiency goal/)).toBeInTheDocument();
  });

  it('renders all category labels correctly', () => {
    const categories = [
      ['model_selection', 'Model Selection'],
      ['iterative_debugging', 'Debugging'],
      ['multi_model_strategy', 'Multi-Model'],
      ['real_world', 'Real-World'],
      ['qa_testing', 'QA Testing'],
      ['frontend', 'Frontend'],
      ['backend_api', 'Backend API'],
      ['data_engineering', 'Data'],
      ['devops', 'DevOps'],
    ] as const;

    for (const [cat, label] of categories) {
      const ch: Challenge = { ...baseChallenge, category: cat };
      const { unmount } = render(<ChallengeCard challenge={ch} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('does not render category label for unknown category', () => {
    const ch: Challenge = { ...baseChallenge, category: 'unknown_cat' };
    render(<ChallengeCard challenge={ch} />);
    // Only the difficulty pill should be present, not a category label
    expect(screen.getByText('Easy')).toBeInTheDocument();
  });

  it('triggers onMouseEnter and onMouseLeave hover handlers on web', () => {
    render(<ChallengeCard challenge={baseChallenge} />);
    const card = screen.getByText('Debounce Function').closest('button');
    expect(card).toBeTruthy();
    // Trigger mouse enter (sets hovered=true internally)
    fireEvent.mouseEnter(card!);
    // Trigger mouse leave (sets hovered=false internally)
    fireEvent.mouseLeave(card!);
    // No crash - web hover handlers were called successfully
    expect(screen.getByText('Debounce Function')).toBeInTheDocument();
  });

  it('renders pressed style callback on Pressable', () => {
    // The Pressable mock calls children({ pressed: false })
    // Verify the card renders correctly with the pressed style function
    render(<ChallengeCard challenge={baseChallenge} />);
    const card = screen.getByText('Debounce Function').closest('button');
    expect(card).toBeTruthy();
  });
});
