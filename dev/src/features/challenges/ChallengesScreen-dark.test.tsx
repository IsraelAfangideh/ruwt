// @vitest-environment jsdom
/**
 * Dark-mode + mobile variant of ChallengesScreen tests.
 * Exercises isDark=true branch for activePillText and isMobile=true for gridStyle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), reset: vi.fn() }),
}));
vi.mock('@/shared/lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
}));
vi.mock('@/shared/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/challenges/ChallengeCard', () => ({
  ChallengeCard: ({ challenge }: any) => <div data-testid="challenge-card">{challenge.title}</div>,
}));
vi.mock('@/shared/lib/useIsMobile', () => ({ useIsMobile: () => true }));
vi.mock('@/shared/lib/difficulty', () => ({
  DIFFICULTIES: [
    { key: 'all', label: 'All Levels' },
    { key: 'sprint', label: 'Sprint' },
    { key: 'easy', label: 'Easy' },
    { key: 'medium', label: 'Medium' },
    { key: 'hard', label: 'Hard' },
    { key: 'impossible', label: 'Impossible' },
  ],
  getDifficultyStyle: () => ({ color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', label: 'Medium' }),
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockDarkTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const mockChallenges = [
  { id: 'c1', title: 'FizzBuzz Budget', description: 'Budget aware fizzbuzz', difficulty: 'easy', category: 'prompt_efficiency', tier: 'onboarding', sortOrder: 1, language: 'javascript', userStatus: null, skillTested: 'prompt writing', stats: { solvers: 5 }, maxCost: 100 },
  { id: 'c2', title: 'Cache Buster', description: 'Fix the cache', difficulty: 'hard', category: 'iterative_debugging', tier: 'core', sortOrder: 2, language: 'javascript', userStatus: 'passed', skillTested: null, stats: { solvers: 2 }, maxCost: 500 },
];

let mockDashboardState: any = {
  challenges: { data: mockChallenges, status: 'loaded', lastFetchedAt: Date.now() },
  dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
};

vi.mock('@/shared/lib/DashboardDataContext', () => ({
  useDashboardData: () => ({
    state: mockDashboardState,
    initialLoadComplete: true,
    refreshEndpoint: vi.fn(),
    refreshAll: vi.fn(),
  }),
}));

const { ChallengesScreen } = await import('./ChallengesScreen');

describe('ChallengesScreen (dark mode + mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', window.location.pathname);
    mockDashboardState = {
      challenges: { data: mockChallenges, status: 'loaded', lastFetchedAt: Date.now() },
      dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
    };
  });

  it('renders with isDark=true activePillText and mobile grid layout', () => {
    render(<ChallengesScreen />);
    expect(screen.getAllByText('Engineering Challenges').length).toBeGreaterThanOrEqual(1);
  });

  it('renders challenge cards in mobile layout', () => {
    const { container } = render(<ChallengesScreen />);
    const cards = container.querySelectorAll('[data-testid="challenge-card"]');
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });

  it('renders progress stats in dark mode', () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.textContent).toContain('solved');
  });

  it('renders with daily challenge in dark mode', () => {
    mockDashboardState = {
      challenges: { data: mockChallenges, status: 'loaded', lastFetchedAt: Date.now() },
      dailyChallenge: {
        data: { challengeId: 'dc1', title: 'Daily Test', difficulty: 'easy', category: 'prompt_efficiency', solvedToday: false },
        status: 'loaded',
        lastFetchedAt: Date.now(),
      },
    };
    const { container } = render(<ChallengesScreen />);
    expect(container.textContent).toContain('Daily Challenge');
  });

  it('renders solved daily challenge in dark mode', () => {
    mockDashboardState = {
      challenges: { data: mockChallenges, status: 'loaded', lastFetchedAt: Date.now() },
      dailyChallenge: {
        data: { challengeId: 'dc1', title: 'Daily Test', difficulty: 'easy', category: 'prompt_efficiency', solvedToday: true },
        status: 'loaded',
        lastFetchedAt: Date.now(),
      },
    };
    const { container } = render(<ChallengesScreen />);
    expect(container.textContent).toContain('Completed');
  });
});
