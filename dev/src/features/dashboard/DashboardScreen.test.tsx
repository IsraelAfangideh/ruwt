// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

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
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

interface DashboardData {
  profile: {
    name: string; email: string; avatarUrl: string | null; username: string;
    credits: number; currentStreak: number; longestStreak: number; lastStreakDate: string;
    streakFreezes: number; onboardingCompleted: number;
  };
  progress: {
    totalChallenges: number; solvedCount: number;
    categorySolves: Record<string, number>;
    categoryTotals: Record<string, number>;
  };
  rank: { position: number | null; totalRanked: number };
  dailyChallenge: { challengeId: string; title: string; difficulty: string; category: string | null; solvedToday: boolean } | null;
  recentBadges: Array<{ badgeType: string; title: string; icon: string; earnedAt: string }>;
  recentActivity: Array<{ user: string; avatarUrl: string | null; challenge: string; cost: number; timestamp: string }>;
  unreadNotifications: number;
  heatmap: Record<string, number>;
}

const baseDashboardData: DashboardData = {
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
  recentActivity: [],
  unreadNotifications: 0,
  heatmap: {},
};

const defaultUser = { id: 'u1', user_metadata: { name: 'Test User' }, email: 'test@test.com' };

const mockRefreshEndpoint = vi.fn();
const mockRefreshAll = vi.fn();

function makeCachedState(data: DashboardData | null, status: 'idle' | 'loading' | 'loaded' | 'error' = 'loaded') {
  return {
    state: {
      dashboard: { data, status, lastFetchedAt: Date.now() },
      challenges: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
      leaderboard: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      seasons: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      badges: { data: { catalog: [], earned: [] }, status: 'loaded', lastFetchedAt: Date.now() },
      bookmarks: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      activity: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      notifications: { data: { unreadCount: 0 }, status: 'loaded', lastFetchedAt: Date.now() },
    },
    initialLoadComplete: status === 'loaded' || status === 'error',
    refreshEndpoint: mockRefreshEndpoint,
    refreshAll: mockRefreshAll,
  };
}

const { DashboardScreen } = await import('./DashboardScreen');

/** Helper to set up mocks for a standard successful dashboard render */
function setupHappyPath(dashboardOverrides?: Partial<typeof baseDashboardData>) {
  const data = dashboardOverrides
    ? { ...baseDashboardData, ...dashboardOverrides }
    : baseDashboardData;
  mockUseAuthGuard.mockReturnValue({ user: defaultUser, loading: false });
  mockUseDashboardData.mockReturnValue(makeCachedState(data));
}

describe('DashboardScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupHappyPath();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('renders skeleton when auth is loading', () => {
    mockUseAuthGuard.mockReturnValue({ user: null, loading: true });
    mockUseDashboardData.mockReturnValue(makeCachedState(null, 'idle'));
    const { container } = render(<DashboardScreen />);
    // DashboardSkeleton renders styled div elements (not ActivityIndicator)
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
  });

  it('renders skeleton when user is null', () => {
    mockUseAuthGuard.mockReturnValue({ user: null, loading: false });
    mockUseDashboardData.mockReturnValue(makeCachedState(null, 'idle'));
    const { container } = render(<DashboardScreen />);
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
  });

  it('renders greeting and username after loading', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/TestUser/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders dashboard layout wrapper', async () => {
    setupHappyPath();
    vi.useRealTimers();
    const { container } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="dashboard-layout"]')).not.toBeNull();
    });
  });

  it('renders daily challenge section when present', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Daily FizzBuzz/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders "Start Today\'s Challenge" button when daily challenge is not solved', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: "Start Today's Challenge" })).toBeInTheDocument();
    });
  });

  it('shows "Completed!" when daily challenge is solved', async () => {
    setupHappyPath({
      dailyChallenge: { ...baseDashboardData.dailyChallenge!, solvedToday: true },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Completed!')).toBeInTheDocument();
    });
  });

  it('shows "No daily challenge available" when daily challenge is null', async () => {
    setupHappyPath({ dailyChallenge: null });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/No daily challenge available/)).toBeInTheDocument();
    });
  });

  it('renders stats row with Solved, Global Rank, Streak, Best Streak', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Solved')).toBeInTheDocument();
    });
    expect(screen.getByText('Global Rank')).toBeInTheDocument();
    expect(screen.getByText('Streak')).toBeInTheDocument();
    expect(screen.getByText('Best Streak')).toBeInTheDocument();
  });

  it('renders rank as #12 when position is set', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('#12')).toBeInTheDocument();
    });
  });

  it('renders rank as "--" when position is null', async () => {
    setupHappyPath({ rank: { position: null, totalRanked: 50 } });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('--')).toBeInTheDocument();
    });
  });

  it('renders progress section with percentage and category breakdown', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Your Progress')).toBeInTheDocument();
    });
    expect(screen.getByText(/8% of challenges completed/)).toBeInTheDocument();
    // Category pills (Prompt Efficiency may appear in both category pills and daily challenge badge)
    expect(screen.getAllByText(/Prompt Efficiency/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Iterative Debugging/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Model Selection/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders activity heatmap section', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Activity')).toBeInTheDocument();
    });
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('renders streak badge with count when streak > 0', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('day streak')).toBeInTheDocument();
    });
  });

  it('shows "Start your streak!" when streak is 0', async () => {
    setupHappyPath({
      profile: { ...baseDashboardData.profile, currentStreak: 0 },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Ready to start building your AFI/)).toBeInTheDocument();
    });
    expect(screen.getByText('Start your streak!')).toBeInTheDocument();
  });

  it('shows streak freezes when > 0', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('2 freezes')).toBeInTheDocument();
    });
  });

  it('shows singular "freeze" for streakFreezes=1', async () => {
    setupHappyPath({
      profile: { ...baseDashboardData.profile, streakFreezes: 1 },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('1 freeze')).toBeInTheDocument();
    });
  });

  it('shows Achievements section with ghost badges when no badges earned', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Achievements')).toBeInTheDocument();
    });
    expect(screen.getByText('View All')).toBeInTheDocument();
    expect(screen.getByText(/Solve challenges and build streaks/)).toBeInTheDocument();
    expect(screen.getByText('First Solve')).toBeInTheDocument();
  });

  it('shows earned badges when present', async () => {
    setupHappyPath({
      recentBadges: [
        { badgeType: 'first_solve', title: 'First Solve', icon: '\uD83C\uDFC6', earnedAt: '2026-01-01' },
      ],
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('First Solve')).toBeInTheDocument();
    });
  });

  it('shows community feed with "Be among the first" when fewer than 3 unique users', async () => {
    setupHappyPath(); // recentActivity is empty
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Community')).toBeInTheDocument();
    });
    expect(screen.getByText(/Be among the first/)).toBeInTheDocument();
  });

  it('shows recent activity feed when >= 3 unique users', async () => {
    const now = new Date().toISOString();
    setupHappyPath({
      recentActivity: [
        { user: 'alice', avatarUrl: null, challenge: 'FizzBuzz', cost: 500, timestamp: now },
        { user: 'bob', avatarUrl: null, challenge: 'Cache', cost: 300, timestamp: now },
        { user: 'carol', avatarUrl: null, challenge: 'Sort', cost: 800, timestamp: now },
      ],
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('carol')).toBeInTheDocument();
  });

  it('shows GetStartedBanner when user has 0 solved challenges', async () => {
    setupHappyPath({
      progress: { ...baseDashboardData.progress, solvedCount: 0 },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Start Your First Challenge')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Try FizzBuzz Budget' })).toBeInTheDocument();
    expect(screen.getByText('Browse all challenges')).toBeInTheDocument();
  });

  it('navigates to Arena with fizzbuzz-budget when Try FizzBuzz Budget is clicked', async () => {
    setupHappyPath({
      progress: { ...baseDashboardData.progress, solvedCount: 0 },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try FizzBuzz Budget' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try FizzBuzz Budget' }));
    expect(mockNavigate).toHaveBeenCalledWith('Arena', { challengeId: 'fizzbuzz-budget' });
  });

  it('navigates to Challenges when Browse all challenges is clicked', async () => {
    setupHappyPath({
      progress: { ...baseDashboardData.progress, solvedCount: 0 },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Browse all challenges')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Browse all challenges'));
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  it('shows fallback UI when dashboard data is null but status is loaded', async () => {
    mockUseAuthGuard.mockReturnValue({ user: defaultUser, loading: false });
    // status is 'loaded' but data is null (API returned empty)
    mockUseDashboardData.mockReturnValue(makeCachedState(null, 'loaded'));
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Dashboard data is loading/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('shows skeleton when dashboard status is loading', async () => {
    mockUseAuthGuard.mockReturnValue({ user: defaultUser, loading: false });
    mockUseDashboardData.mockReturnValue(makeCachedState(null, 'loading'));
    vi.useRealTimers();
    const { container } = render(<DashboardScreen />);
    // Should show DashboardLayout with DashboardSkeleton
    expect(container.querySelector('[data-testid="dashboard-layout"]')).not.toBeNull();
  });

  it('redirects to Onboarding when onboardingCompleted is 0', async () => {
    setupHappyPath({
      profile: { ...baseDashboardData.profile, onboardingCompleted: 0 },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    });
  });

  it('navigates to Profile when View All on badges is clicked', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('View All')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('View All'));
    expect(mockNavigate).toHaveBeenCalledWith('Profile');
  });

  it('navigates to Arena when Start Today\'s Challenge is clicked', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: "Start Today's Challenge" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: "Start Today's Challenge" }));
    expect(mockNavigate).toHaveBeenCalledWith('Arena', { challengeId: 'dc1' });
  });

  it('renders Today\'s Challenge badge', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText("Today's Challenge")).toBeInTheDocument();
    });
  });

  it('renders countdown timer with "Next in" label', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Next in')).toBeInTheDocument();
    });
  });

  it('shows 5 / 60 in solved stat', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('5 / 60')).toBeInTheDocument();
    });
  });

  it('shows best streak stat', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Best Streak')).toBeInTheDocument();
    });
    expect(screen.getByText('7')).toBeInTheDocument(); // longestStreak from mock data
  });

  it('renders category difficulty badge for daily challenge', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Medium').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('Prompt Efficiency').length).toBeGreaterThanOrEqual(1);
  });

  it('renders dashboard with all sections when data is loaded', async () => {
    setupHappyPath();
    vi.useRealTimers();
    render(<DashboardScreen />);
    // Verify the dashboard loads (this path goes through all the early returns)
    await waitFor(() => {
      expect(screen.getAllByText(/TestUser/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows daily challenge without category badge when category is null', async () => {
    setupHappyPath({
      dailyChallenge: { ...baseDashboardData.dailyChallenge!, category: null },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Daily FizzBuzz')).toBeInTheDocument();
    });
  });

  it('shows best streak value from profile', async () => {
    setupHappyPath({
      profile: { ...baseDashboardData.profile, longestStreak: 15 },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
    });
  });

  it('does not show streak freezes when count is 0', async () => {
    setupHappyPath({
      profile: { ...baseDashboardData.profile, streakFreezes: 0 },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('day streak')).toBeInTheDocument();
    });
    expect(screen.queryByText(/freeze/)).toBeNull();
  });

  it('renders progress section with 0% when totalChallenges is 0', async () => {
    setupHappyPath({
      progress: { totalChallenges: 0, solvedCount: 0, categorySolves: {}, categoryTotals: {} },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/0% of challenges completed/)).toBeInTheDocument();
    });
  });

  it('renders progress section with no category row when categoryTotals is empty', async () => {
    setupHappyPath({
      progress: { totalChallenges: 10, solvedCount: 5, categorySolves: {}, categoryTotals: {} },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/50% of challenges completed/)).toBeInTheDocument();
    });
  });

  /* -- Countdown ticker interval reaching 0 -- */
  it('decrements countdown via interval and clears when reaching 0', async () => {
    // Use fake timers with shouldAdvanceTime so promises resolve
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Set system time to 23:59:57 UTC so countdown starts at 3 seconds
    vi.setSystemTime(new Date('2026-02-28T23:59:57.000Z'));
    setupHappyPath();

    render(<DashboardScreen />);

    // Wait for dashboard to load
    await waitFor(() => {
      expect(screen.getByRole('button', { name: "Start Today's Challenge" })).toBeInTheDocument();
    });

    // Tick 1: prev=3 -> return prev-1=2
    await act(async () => { vi.advanceTimersByTime(1000); });
    // Tick 2: prev=2 -> return prev-1=1
    await act(async () => { vi.advanceTimersByTime(1000); });
    // Tick 3: prev=1, prev<=1 -> clearInterval + return 0
    await act(async () => { vi.advanceTimersByTime(1000); });

    // After countdown reaches 0, should display 00:00:00
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
  });

  /* -- Fallback Refresh button calls window.location.reload -- */
  it('calls window.location.reload when fallback Refresh button is clicked', async () => {
    mockUseAuthGuard.mockReturnValue({ user: defaultUser, loading: false });
    mockUseDashboardData.mockReturnValue(makeCachedState(null, 'loaded'));
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
      configurable: true,
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(reloadMock).toHaveBeenCalled();
  });

  /* -- Activity feed with < 3 unique users but non-empty -- */
  it('shows community fallback when activity has entries but fewer than 3 unique users', async () => {
    const now = new Date().toISOString();
    setupHappyPath({
      recentActivity: [
        { user: 'alice', avatarUrl: null, challenge: 'FizzBuzz', cost: 500, timestamp: now },
        { user: 'alice', avatarUrl: null, challenge: 'Cache', cost: 300, timestamp: now },
      ],
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Community')).toBeInTheDocument();
    });
    expect(screen.getByText(/Be among the first/)).toBeInTheDocument();
  });

  /* -- Heatmap with actual data for intensity color branches -- */
  it('renders heatmap cells with varying intensity when heatmap data is present', async () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().split('T')[0];
    setupHappyPath({
      heatmap: {
        [today]: 10,       // high intensity
        [yesterday]: 3,    // medium intensity
        [twoDaysAgo]: 1,   // low intensity
      },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Activity')).toBeInTheDocument();
    });
    // The accessible summary should reflect the activity data
    expect(screen.getByText(/14 activities across 3 active days/)).toBeInTheDocument();
  });

  /* -- relativeTime helper covers various time ranges -- */
  it('shows relative timestamps in activity feed (minutes, hours, days, months)', async () => {
    const now = Date.now();
    setupHappyPath({
      recentActivity: [
        { user: 'alice', avatarUrl: null, challenge: 'A', cost: 100, timestamp: new Date(now - 30 * 1000).toISOString() },       // ~30s ago = "just now"
        { user: 'bob', avatarUrl: null, challenge: 'B', cost: 200, timestamp: new Date(now - 5 * 60 * 1000).toISOString() },     // 5 min ago
        { user: 'carol', avatarUrl: null, challenge: 'C', cost: 300, timestamp: new Date(now - 3 * 3600 * 1000).toISOString() }, // 3 hours ago
        { user: 'dave', avatarUrl: null, challenge: 'D', cost: 400, timestamp: new Date(now - 86400000).toISOString() },          // 1 day ago
        { user: 'eve', avatarUrl: null, challenge: 'E', cost: 500, timestamp: new Date(now - 5 * 86400000).toISOString() },      // 5 days ago
        { user: 'frank', avatarUrl: null, challenge: 'F', cost: 600, timestamp: new Date(now - 45 * 86400000).toISOString() },   // ~45 days ago
      ],
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });
    expect(screen.getByText('just now')).toBeInTheDocument();
    expect(screen.getByText('5m ago')).toBeInTheDocument();
    expect(screen.getByText('3h ago')).toBeInTheDocument();
    expect(screen.getByText('yesterday')).toBeInTheDocument();
    expect(screen.getByText('5d ago')).toBeInTheDocument();
    expect(screen.getByText('1mo ago')).toBeInTheDocument();
  });

  it('shows zero best streak', async () => {
    setupHappyPath({
      profile: { ...baseDashboardData.profile, longestStreak: 0 },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Best Streak')).toBeInTheDocument();
    });
  });

  it('shows preliminary AFI card when solvedCount is between 1 and AFI_MIN_SOLVES', async () => {
    setupHappyPath({
      progress: { ...baseDashboardData.progress, solvedCount: 2, totalChallenges: 60 },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      // AFI card shows "X more solves to stabilize" when isPreliminary
      expect(screen.getByText(/more solve.*to stabilize/)).toBeInTheDocument();
    });
    expect(screen.getByText('AI Fluency Index')).toBeInTheDocument();
  });

  it('shows singular "solve" when exactly 1 more solve needed to stabilize AFI', async () => {
    setupHappyPath({
      progress: { ...baseDashboardData.progress, solvedCount: 4, totalChallenges: 60 },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('1 more solve to stabilize')).toBeInTheDocument();
    });
  });

  it('shows "out of 850" on AFI card when solvedCount >= AFI_MIN_SOLVES', async () => {
    setupHappyPath({
      progress: { ...baseDashboardData.progress, solvedCount: 10, totalChallenges: 60 },
    });
    vi.useRealTimers();
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('out of 850')).toBeInTheDocument();
    });
  });

  /* ── Error handling / negative tests ─────────────────────────────── */

  describe('error handling', () => {
    it('renders loading skeleton when dashboard status is error and data is null', async () => {
      mockUseAuthGuard.mockReturnValue({ user: defaultUser, loading: false });
      mockUseDashboardData.mockReturnValue(makeCachedState(null, 'error'));
      vi.useRealTimers();
      const { container } = render(<DashboardScreen />);
      // Status 'error' means loading=true (status !== 'loaded'), so skeleton shows
      expect(container.querySelector('[data-testid="dashboard-layout"]')).not.toBeNull();
    });

    it('handles profile with empty username gracefully', async () => {
      setupHappyPath({ profile: { ...baseDashboardData.profile, username: '' } });
      vi.useRealTimers();
      render(<DashboardScreen />);
      await waitFor(() => { expect(screen.getByText('Your Progress')).toBeInTheDocument(); });
    });

    it('handles extremely large credit values without crashing', async () => {
      setupHappyPath({ profile: { ...baseDashboardData.profile, credits: 999999999 } });
      vi.useRealTimers();
      render(<DashboardScreen />);
      await waitFor(() => { expect(screen.getByText('Your Progress')).toBeInTheDocument(); });
    });

    it('handles negative streak values gracefully', async () => {
      setupHappyPath({ profile: { ...baseDashboardData.profile, currentStreak: -1, longestStreak: -5 } });
      vi.useRealTimers();
      render(<DashboardScreen />);
      await waitFor(() => { expect(screen.getByText('Streak')).toBeInTheDocument(); });
    });

    it('handles zero totalChallenges with non-zero solvedCount', async () => {
      setupHappyPath({ progress: { totalChallenges: 0, solvedCount: 5, categorySolves: {}, categoryTotals: {} } });
      vi.useRealTimers();
      render(<DashboardScreen />);
      await waitFor(() => { expect(screen.getByText('Your Progress')).toBeInTheDocument(); });
    });

    it('handles dailyChallenge with empty title', async () => {
      setupHappyPath({ dailyChallenge: { challengeId: 'dc1', title: '', difficulty: 'easy', category: 'prompt_efficiency', solvedToday: false } });
      vi.useRealTimers();
      render(<DashboardScreen />);
      await waitFor(() => { expect(screen.getByText("Today's Challenge")).toBeInTheDocument(); });
    });

    it('handles profile with zero credits', async () => {
      setupHappyPath({ profile: { ...baseDashboardData.profile, credits: 0 } });
      vi.useRealTimers();
      render(<DashboardScreen />);
      await waitFor(() => { expect(screen.getByText('Your Progress')).toBeInTheDocument(); });
    });

    it('handles heatmap with negative values gracefully', async () => {
      setupHappyPath({ heatmap: { [new Date().toISOString().split('T')[0]]: -1 } });
      vi.useRealTimers();
      render(<DashboardScreen />);
      await waitFor(() => { expect(screen.getByText('Activity')).toBeInTheDocument(); });
    });

    it('handles multiple recent badges', async () => {
      setupHappyPath({
        recentBadges: [
          { badgeType: 'first_solve', title: 'First Solve', icon: '\uD83C\uDFC6', earnedAt: '2026-01-01' },
          { badgeType: 'speed_demon', title: 'Speed Demon', icon: '\u26A1', earnedAt: '2026-01-02' },
        ],
      });
      vi.useRealTimers();
      render(<DashboardScreen />);
      await waitFor(() => { expect(screen.getByText('First Solve')).toBeInTheDocument(); });
    });

    it('handles activity with duplicate timestamps', async () => {
      const now = new Date().toISOString();
      setupHappyPath({
        recentActivity: [
          { user: 'alice', avatarUrl: null, challenge: 'A', cost: 100, timestamp: now },
          { user: 'bob', avatarUrl: null, challenge: 'B', cost: 200, timestamp: now },
          { user: 'carol', avatarUrl: null, challenge: 'C', cost: 300, timestamp: now },
        ],
      });
      vi.useRealTimers();
      render(<DashboardScreen />);
      await waitFor(() => { expect(screen.getByText('Recent Activity')).toBeInTheDocument(); });
    });

    it('handles rank with zero totalRanked', async () => {
      setupHappyPath({ rank: { position: 1, totalRanked: 0 } });
      vi.useRealTimers();
      render(<DashboardScreen />);
      await waitFor(() => { expect(screen.getByText('#1')).toBeInTheDocument(); });
    });

    it('handles categorySolves exceeding categoryTotals', async () => {
      setupHappyPath({ progress: { totalChallenges: 10, solvedCount: 15, categorySolves: { prompt_efficiency: 20 }, categoryTotals: { prompt_efficiency: 10 } } });
      vi.useRealTimers();
      render(<DashboardScreen />);
      await waitFor(() => { expect(screen.getByText('Your Progress')).toBeInTheDocument(); });
    });

    it('handles many categories in progress section', async () => {
      setupHappyPath({ progress: { totalChallenges: 100, solvedCount: 50, categorySolves: { a: 10, b: 15, c: 5, d: 20 }, categoryTotals: { a: 20, b: 25, c: 15, d: 30 } } });
      vi.useRealTimers();
      render(<DashboardScreen />);
      await waitFor(() => { expect(screen.getByText(/50% of challenges completed/)).toBeInTheDocument(); });
    });

    it('handles activity with zero cost', async () => {
      const now = new Date().toISOString();
      setupHappyPath({
        recentActivity: [
          { user: 'alice', avatarUrl: null, challenge: 'A', cost: 0, timestamp: now },
          { user: 'bob', avatarUrl: null, challenge: 'B', cost: 0, timestamp: now },
          { user: 'carol', avatarUrl: null, challenge: 'C', cost: 0, timestamp: now },
        ],
      });
      vi.useRealTimers();
      render(<DashboardScreen />);
      await waitFor(() => { expect(screen.getByText('Recent Activity')).toBeInTheDocument(); });
    });

    it('handles profile name with special characters', async () => {
      setupHappyPath({ profile: { ...baseDashboardData.profile, name: 'User&Co' } });
      vi.useRealTimers();
      const { container } = render(<DashboardScreen />);
      await waitFor(() => { expect(container.textContent).toContain('User&Co'); });
    });

    it('renders skeleton inside layout when status is error', async () => {
      mockUseAuthGuard.mockReturnValue({ user: defaultUser, loading: false });
      mockUseDashboardData.mockReturnValue(makeCachedState(null, 'error'));
      vi.useRealTimers();
      const { container } = render(<DashboardScreen />);
      // error status -> loading=true -> DashboardLayout with DashboardSkeleton
      expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
    });
  });
});
