// @vitest-environment jsdom
/**
 * Dark-mode variant of LeaderboardScreen tests.
 * Exercises isDark branches for styling ternaries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { mockNavigate, mockReset } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockReset: vi.fn(),
}));

let mockAuthReturn: any = { user: { id: 'u1' }, loading: false };
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
}));
vi.mock('@/shared/hooks/useAuthGuard', () => ({
  useAuthGuard: () => mockAuthReturn,
}));
vi.mock('@/shared/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/shared/ui/Avatar', () => ({ Avatar: () => <div data-testid="avatar" /> }));
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
}));
vi.mock('@/shared/social/ActivityFeed', () => ({
  ActivityFeed: () => <div data-testid="activity-feed" />,
}));
vi.mock('@/features/replay/ReplayViewer', () => ({
  ReplayViewer: ({ onClose }: any) => <div data-testid="replay-viewer"><button onClick={onClose}>Close</button></div>,
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));

const globalEntries = [
  { rank: 1, user: { id: 'u1', name: 'Alice', avatarUrl: null, username: 'alice' }, stats: { solved: 10, attempts: 15, avgCost: 500, totalCost: 5000 } },
  { rank: 2, user: { id: 'u2', name: 'Bob', avatarUrl: null, username: 'bob' }, stats: { solved: 8, attempts: 12, avgCost: 800, totalCost: 6400 } },
  { rank: 3, user: { id: 'u3', name: 'Carol', avatarUrl: null, username: null }, stats: { solved: 6, attempts: 10, avgCost: 1200, totalCost: 7200 } },
  { rank: 4, user: { id: 'u4', name: 'Dave', avatarUrl: null, username: 'dave' }, stats: null },
];

let mockDashboardState: any = {
  leaderboard: { data: globalEntries, status: 'loaded', lastFetchedAt: Date.now() },
  challenges: { data: [{ id: 'c1', title: 'FizzBuzz Budget', category: 'prompt_efficiency' }], status: 'loaded', lastFetchedAt: Date.now() },
  seasons: { data: [{ id: 's1', name: 'Season 1', startDate: '2026-01-01', endDate: '2026-03-31', status: 'active' }], status: 'loaded', lastFetchedAt: Date.now() },
  dashboard: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
  dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
  badges: { data: { catalog: [], earned: [] }, status: 'loaded', lastFetchedAt: Date.now() },
  bookmarks: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
  activity: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
  notifications: { data: { unreadCount: 0 }, status: 'loaded', lastFetchedAt: Date.now() },
};

vi.mock('@/shared/lib/DashboardDataContext', () => ({
  useDashboardData: () => ({
    state: mockDashboardState,
    initialLoadComplete: true,
    refreshEndpoint: vi.fn(),
    refreshAll: vi.fn(),
  }),
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockDarkTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ entries: globalEntries, seasons: [], challenges: [] }),
}));

const { LeaderboardScreen } = await import('./LeaderboardScreen');

describe('LeaderboardScreen (dark mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { user: { id: 'u1' }, loading: false };
  });

  it('renders leaderboard in dark mode', () => {
    render(<LeaderboardScreen />);
    expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
  });

  it('renders entries with ranks in dark mode', () => {
    render(<LeaderboardScreen />);
    expect(screen.getAllByText(/Alice/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders entries with null stats in dark mode', () => {
    render(<LeaderboardScreen />);
    expect(screen.getAllByText(/Dave/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders user without username in dark mode', () => {
    render(<LeaderboardScreen />);
    expect(screen.getAllByText(/Carol/).length).toBeGreaterThanOrEqual(1);
  });
});
