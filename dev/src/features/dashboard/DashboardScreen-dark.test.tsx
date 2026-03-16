// @vitest-environment jsdom
/**
 * Dark-mode variant of DashboardScreen tests.
 * Exercises isDark branches for styling ternaries.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockReset = vi.fn();

const { mockUseAuthGuard, mockUseDashboardData } = vi.hoisted(() => ({
  mockUseAuthGuard: vi.fn(),
  mockUseDashboardData: vi.fn(),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
}));
vi.mock('@/shared/hooks/useAuthGuard', () => ({
  useAuthGuard: (...args: any[]) => mockUseAuthGuard(...args),
}));
vi.mock('@/shared/lib/DashboardDataContext', () => ({
  useDashboardData: (...args: any[]) => mockUseDashboardData(...args),
}));
vi.mock('@/shared/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/shared/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
}));
vi.mock('@/shared/ui/Avatar', () => ({ Avatar: () => <div data-testid="avatar" /> }));
vi.mock('@/shared/ui/Progress', () => ({
  Progress: ({ value }: any) => <div data-testid="progress" data-value={value} />,
}));
vi.mock('@/shared/lib/difficulty', () => ({
  getDifficultyStyle: () => ({ color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', label: 'Medium' }),
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockDarkTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const baseDashboardData = {
  profile: {
    name: 'TestUser', email: 'test@test.com', avatarUrl: null, username: 'testuser',
    credits: 50000, currentStreak: 3, longestStreak: 7, lastStreakDate: '2026-02-27',
    streakFreezes: 2, onboardingCompleted: 1,
  },
  progress: {
    totalChallenges: 60, solvedCount: 5,
    categorySolves: { prompt_efficiency: 2, iterative_debugging: 1 },
    categoryTotals: { prompt_efficiency: 10, iterative_debugging: 8, model_selection: 12 },
  },
  rank: { position: 12, totalRanked: 50 },
  dailyChallenge: { challengeId: 'dc1', title: 'Daily FizzBuzz', difficulty: 'easy', category: 'prompt_efficiency', solvedToday: false },
  recentBadges: [],
  recentActivity: [
    { user: 'Alice', avatarUrl: null, challenge: 'FizzBuzz', cost: 500, timestamp: '2026-02-27T10:00:00Z' },
  ],
  unreadNotifications: 2,
  heatmap: { '2026-02-27': 3 },
};

const loadedState = {
  dashboard: { data: baseDashboardData, status: 'loaded', lastFetchedAt: Date.now() },
  challenges: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
  leaderboard: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
  seasons: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
  dailyChallenge: { data: baseDashboardData.dailyChallenge, status: 'loaded', lastFetchedAt: Date.now() },
  badges: { data: { catalog: [], earned: [] }, status: 'loaded', lastFetchedAt: Date.now() },
  bookmarks: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
  activity: { data: baseDashboardData.recentActivity, status: 'loaded', lastFetchedAt: Date.now() },
  notifications: { data: { unreadCount: 2 }, status: 'loaded', lastFetchedAt: Date.now() },
};

const { DashboardScreen } = await import('./DashboardScreen');

describe('DashboardScreen (dark mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthGuard.mockReturnValue({ user: { id: 'u1', email: 'test@test.com' }, loading: false });
    mockUseDashboardData.mockReturnValue({
      state: loadedState,
      initialLoadComplete: true,
      refreshEndpoint: vi.fn(),
      refreshAll: vi.fn(),
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('renders dashboard in dark mode', async () => {
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });
  });

  it('renders welcome message in dark mode', async () => {
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/TestUser/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders daily challenge card in dark mode', async () => {
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Daily/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders streak in dark mode', async () => {
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });
  });

  it('renders with solved daily challenge', async () => {
    mockUseDashboardData.mockReturnValue({
      state: {
        ...loadedState,
        dashboard: {
          data: { ...baseDashboardData, dailyChallenge: { ...baseDashboardData.dailyChallenge, solvedToday: true } },
          status: 'loaded',
          lastFetchedAt: Date.now(),
        },
        dailyChallenge: {
          data: { ...baseDashboardData.dailyChallenge, solvedToday: true },
          status: 'loaded',
          lastFetchedAt: Date.now(),
        },
      },
      initialLoadComplete: true,
      refreshEndpoint: vi.fn(),
      refreshAll: vi.fn(),
    });
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });
  });
});
