// @vitest-environment jsdom
/**
 * Dark-mode variant of ProfileScreen tests.
 * Exercises isDark branches for styling ternaries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();

const { mockUseDashboardData } = vi.hoisted(() => ({
  mockUseDashboardData: vi.fn(),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
vi.mock('@/shared/hooks/useAuthGuard', () => ({
  useAuthGuard: () => ({ user: { id: 'u1', email: 'test@test.com', user_metadata: { name: 'Test User', avatar_url: null } }, loading: false }),
}));
vi.mock('@/shared/lib/DashboardDataContext', () => ({
  useDashboardData: (...args: any[]) => mockUseDashboardData(...args),
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
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
vi.mock('@/shared/ui/Avatar', () => ({ Avatar: () => <div data-testid="avatar" /> }));
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
}));
vi.mock('@/shared/ui/Input', () => ({
  Input: (props: any) => <input data-testid="username-input" value={props.value} onChange={(e: any) => props.onChangeText?.(e.target.value)} placeholder={props.placeholder} />,
}));
vi.mock('@/shared/ui/Label', () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));
vi.mock('@/shared/ui/Progress', () => ({
  Progress: ({ value }: any) => <div data-testid="progress" data-value={value} />,
}));
vi.mock('@/shared/ui/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockDarkTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const mockProfileData = {
  profile: {
    name: 'TestUser', email: 'test@test.com', avatarUrl: null, username: 'testuser',
    credits: 50000, currentStreak: 3, longestStreak: 7, streakFreezes: 2,
  },
  progress: {
    totalChallenges: 60, solvedCount: 5,
    categorySolves: { prompt_efficiency: 3, iterative_debugging: 2 },
    categoryTotals: { prompt_efficiency: 10, iterative_debugging: 8 },
  },
  rank: { position: 12, totalRanked: 50 },
  recentBadges: [],
};

const mockBadgeData = {
  catalog: [
    { type: 'speed_demon', title: 'Speed Demon', description: 'Solve in under 2 min', icon: '\u26A1' },
  ],
  earned: [{ badgeType: 'speed_demon' }],
};

const dashboardState = {
  dashboard: { data: mockProfileData, status: 'loaded', lastFetchedAt: Date.now() },
  badges: { data: mockBadgeData, status: 'loaded', lastFetchedAt: Date.now() },
  challenges: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
  leaderboard: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
  seasons: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
  dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
  bookmarks: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
  activity: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
  notifications: { data: { unreadCount: 0 }, status: 'loaded', lastFetchedAt: Date.now() },
};

const { ProfileScreen } = await import('./ProfileScreen');

describe('ProfileScreen (dark mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDashboardData.mockReturnValue({
      state: dashboardState,
      initialLoadComplete: true,
      refreshEndpoint: vi.fn(),
      refreshAll: vi.fn(),
    });
  });

  it('renders profile in dark mode', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/TestUser/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders credits and streak in dark mode', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText(/50,000/)).toBeInTheDocument();
    });
  });

  it('renders progress section in dark mode', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/solved/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders badge section in dark mode', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Speed Demon/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders with null rank in dark mode', async () => {
    mockUseDashboardData.mockReturnValue({
      state: {
        ...dashboardState,
        dashboard: { data: { ...mockProfileData, rank: { position: null, totalRanked: 0 } }, status: 'loaded', lastFetchedAt: Date.now() },
      },
      initialLoadComplete: true,
      refreshEndpoint: vi.fn(),
      refreshAll: vi.fn(),
    });
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/TestUser/).length).toBeGreaterThanOrEqual(1);
    });
  });
});
