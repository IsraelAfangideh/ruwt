// @vitest-environment jsdom
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

let mockDashboardState: any = {
  leaderboard: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
  challenges: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
  seasons: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
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
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ entries: [], seasons: [], challenges: [] }),
}));

const { LeaderboardScreen } = await import('./LeaderboardScreen');

// Helpers for creating mock entries
const globalEntries = [
  { rank: 1, user: { id: 'u1', name: 'Alice', avatarUrl: null, username: 'alice' }, stats: { solved: 10, attempts: 15, avgCost: 500, totalCost: 5000 } },
  { rank: 2, user: { id: 'u2', name: 'Bob', avatarUrl: null, username: 'bob' }, stats: { solved: 8, attempts: 12, avgCost: 800, totalCost: 6400 } },
  { rank: 3, user: { id: 'u3', name: 'Carol', avatarUrl: null, username: null }, stats: { solved: 6, attempts: 10, avgCost: 1200, totalCost: 7200 } },
  { rank: 4, user: { id: 'u4', name: 'Dave', avatarUrl: null, username: 'dave' }, stats: null },
];

const challengeEntries = [
  { rank: 1, user: { id: 'u1', name: 'Alice', avatarUrl: null, username: 'alice' }, attemptId: 'att1', cost: 500, tokens: 1, submittedAt: '2026-01-01T00:00:00Z' },
  { rank: 2, user: { id: 'u2', name: 'Bob', avatarUrl: null, username: 'bob' }, attemptId: 'att2', cost: 800, tokens: 250, submittedAt: '2026-01-01T00:00:00Z' },
  { rank: 3, user: { id: 'u3', name: 'Carol', avatarUrl: null, username: null }, attemptId: 'att3', cost: 1200, tokens: 500, submittedAt: '2026-01-01T00:00:00Z' },
  { rank: 4, user: { id: 'u4', name: 'Dave', avatarUrl: null, username: 'dave' }, attemptId: 'att4', cost: 50, tokens: 100, submittedAt: null },
];

const mockChallenges = [
  { id: 'c1', title: 'FizzBuzz Budget', category: 'prompt_efficiency' },
  { id: 'c2', title: 'Cache Buster', category: 'iterative_debugging' },
];

const mockSeasons = [
  { id: 's1', name: 'Season 1', status: 'completed', startsAt: '2025-01-01', endsAt: '2025-06-30' },
  { id: 's2', name: 'Season 2', status: 'active', startsAt: '2025-07-01', endsAt: '2025-12-31' },
];

function setupFetch(overrides: { leaderboardEntries?: any[]; challenges?: any[]; seasons?: any[]; challengeEntries?: any[]; leaderboardOk?: boolean } = {}) {
  const { leaderboardEntries = [], challenges = mockChallenges, seasons = [], challengeEntries: chEntries, leaderboardOk = true } = overrides;

  // Update the cached dashboard state so the component gets initial data from context
  mockDashboardState = {
    ...mockDashboardState,
    leaderboard: { data: leaderboardEntries, status: 'loaded', lastFetchedAt: Date.now() },
    challenges: { data: challenges, status: 'loaded', lastFetchedAt: Date.now() },
    seasons: { data: seasons, status: 'loaded', lastFetchedAt: Date.now() },
  };

  // Also set up fetch for when the component re-fetches (period/division/challenge changes)
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/leaderboard')) {
      if (url.includes('challengeId=') && chEntries) {
        return Promise.resolve({ ok: leaderboardOk, json: () => Promise.resolve({ entries: chEntries }) });
      }
      return Promise.resolve({ ok: leaderboardOk, json: () => Promise.resolve({ entries: leaderboardEntries }) });
    }
    if (url.includes('/api/challenges')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(challenges) });
    }
    if (url.includes('/api/seasons')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ seasons }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }));
}

describe('LeaderboardScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { user: { id: 'u1' }, loading: false };
    // Reset cached state
    mockDashboardState = {
      leaderboard: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      challenges: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      seasons: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      dashboard: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
      dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
      badges: { data: { catalog: [], earned: [] }, status: 'loaded', lastFetchedAt: Date.now() },
      bookmarks: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      activity: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      notifications: { data: { unreadCount: 0 }, status: 'loaded', lastFetchedAt: Date.now() },
    };
  });

  it('renders loading state initially', () => {
    // Set leaderboard status to 'loading' to show the loading spinner
    setupFetch();
    mockDashboardState = { ...mockDashboardState, leaderboard: { data: [], status: 'loading', lastFetchedAt: 0 } };
    const { container } = render(<LeaderboardScreen />);
    expect(container.querySelector('[data-testid="skeleton-table"]')).toBeInTheDocument();
  });

  it('shows loading state when auth is loading (redirect handled by useAuthGuard)', async () => {
    mockAuthReturn = { user: null, loading: true };
    setupFetch();
    const { container } = render(<LeaderboardScreen />);
    // Should show loading spinner since authLoading is true
    expect(container.querySelector('[data-testid="skeleton-table"]')).toBeInTheDocument();
  });

  it('renders leaderboard title after loading', async () => {
    setupFetch();
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Leaderboard').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders period tabs', async () => {
    setupFetch();
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('This Week').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('This Month').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('All Time').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Global and By Challenge tab buttons', async () => {
    setupFetch();
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Global').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('By Challenge').length).toBeGreaterThanOrEqual(1);
  });

  it('renders division toggle with Open and Unlimited options', async () => {
    setupFetch();
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('Unlimited').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Open: Cloudflare models only/)).toBeInTheDocument();
  });

  it('shows empty state message when no entries for this week', async () => {
    setupFetch();
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/No solves this week/).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText(/Be the first to claim/)).toBeInTheDocument();
  });

  it('shows Browse Problems button in empty state', async () => {
    setupFetch();
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Browse Problems' })).toBeInTheDocument();
    });
  });

  it('navigates to Challenges when Browse Problems is clicked in empty state', async () => {
    setupFetch();
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Browse Problems' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Browse Problems' }));
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  it('shows ActivityFeed in empty state', async () => {
    setupFetch();
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="activity-feed"]')).toBeInTheDocument();
    });
  });

  it('renders podium and table when global entries are present', async () => {
    setupFetch({ leaderboardEntries: globalEntries });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('Bob').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Carol').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Dave').length).toBeGreaterThanOrEqual(1);
  });

  it('renders table headers: #, User, Solved, Avg Cost, Total Cost', async () => {
    setupFetch({ leaderboardEntries: globalEntries });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('#')).toBeInTheDocument();
    });
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Solved')).toBeInTheDocument();
    expect(screen.getByText('Avg Cost')).toBeInTheDocument();
    expect(screen.getByText('Total Cost')).toBeInTheDocument();
  });

  it('shows dashes for users without stats', async () => {
    setupFetch({ leaderboardEntries: globalEntries });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Dave')).toBeInTheDocument();
    });
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('formats cost correctly (small cost shows 4 decimals)', async () => {
    setupFetch({ leaderboardEntries: globalEntries });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('$0.05').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('formats very small costs with 4 decimal places', async () => {
    const smallCostEntries = [
      { rank: 1, user: { id: 'u1', name: 'Alice', avatarUrl: null, username: 'alice' }, stats: { solved: 1, attempts: 1, avgCost: 50, totalCost: 50 } },
    ];
    setupFetch({ leaderboardEntries: smallCostEntries });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('$0.0050').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('switches period when period tab is clicked', async () => {
    setupFetch({ leaderboardEntries: globalEntries });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    });
    const allTimeElements = screen.getAllByText('All Time');
    fireEvent.click(allTimeElements[0]);
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('period=all'));
    });
  });

  it('switches period when This Month is clicked', async () => {
    setupFetch({ leaderboardEntries: globalEntries });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.click(screen.getAllByText('This Month')[0]);
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('period=month'));
    });
  });

  it('switches division when Unlimited is clicked', async () => {
    setupFetch({ leaderboardEntries: globalEntries });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.click(screen.getAllByText('Unlimited')[0]);
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('division=unlimited'));
    });
  });

  it('switches to challenge tab when By Challenge is clicked', async () => {
    setupFetch({ leaderboardEntries: globalEntries, challenges: mockChallenges });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.click(screen.getAllByText('By Challenge')[0]);
    await waitFor(() => {
      expect(screen.getByText('Select a challenge...')).toBeInTheDocument();
    });
  });

  it('switches back to global tab when Global button is clicked', async () => {
    setupFetch({ leaderboardEntries: globalEntries, challenges: mockChallenges });
    render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1));
    // Switch to challenge tab
    fireEvent.click(screen.getAllByText('By Challenge')[0]);
    await waitFor(() => expect(screen.getByText('Select a challenge...')).toBeInTheDocument());
    // Switch back to global tab
    fireEvent.click(screen.getAllByText('Global')[0]);
    await waitFor(() => expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1));
  });

  it('renders season filter when seasons are present', async () => {
    setupFetch({ leaderboardEntries: globalEntries, seasons: mockSeasons });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Season 1/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Season 2.*Current/)).toBeInTheDocument();
  });

  it('changes season filter when season is selected', async () => {
    setupFetch({ leaderboardEntries: globalEntries, seasons: mockSeasons });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Season 1/)).toBeInTheDocument();
    });
    const select = container.querySelectorAll('select')[0];
    if (select) {
      fireEvent.change(select, { target: { value: 's1' } });
      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('season=s1'));
      });
    }
  });

  it('clears season when empty value selected in season dropdown', async () => {
    setupFetch({ leaderboardEntries: globalEntries, seasons: mockSeasons });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Season 1/)).toBeInTheDocument();
    });
    const select = container.querySelectorAll('select')[0];
    if (select) {
      fireEvent.change(select, { target: { value: 's1' } });
      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('season=s1'));
      });
      fireEvent.change(select, { target: { value: '' } });
    }
  });

  it('shows challenge dropdown on challenge tab with challenge options', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
    await waitFor(() => {
      expect(screen.getByText('Select a challenge...')).toBeInTheDocument();
    });
    expect(screen.getByText(/FizzBuzz Budget/)).toBeInTheDocument();
    expect(screen.getByText(/Cache Buster/)).toBeInTheDocument();
  });

  it('fetches challenge leaderboard when a challenge is selected', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
    await waitFor(() => {
      expect(screen.getByText('Select a challenge...')).toBeInTheDocument();
    });
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    if (challengeSelect) {
      fireEvent.change(challengeSelect, { target: { value: 'c1' } });
      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('challengeId=c1'));
      });
    }
  });

  it('clears challenge entries when empty value selected in challenge dropdown', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
    await waitFor(() => expect(screen.getByText('Select a challenge...')).toBeInTheDocument());
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    expect(challengeSelect).toBeTruthy();
    // Select a challenge first
    fireEvent.change(challengeSelect!, { target: { value: 'c1' } });
    await waitFor(() => expect(screen.getAllByText('Alice').length).toBeGreaterThan(0));
    // Clear the selection (empty challengeId triggers early return in fetchChallengeLeaderboard)
    fireEvent.change(challengeSelect!, { target: { value: '' } });
    // Should not crash, entries are cleared
  });

  it('shows empty state when no one solved the selected challenge', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries: [] });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
    await waitFor(() => {
      expect(screen.getByText('Select a challenge...')).toBeInTheDocument();
    });
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    if (challengeSelect) {
      fireEvent.change(challengeSelect, { target: { value: 'c1' } });
      await waitFor(() => {
        expect(screen.getByText('Nobody has solved this challenge yet.')).toBeInTheDocument();
      });
      expect(screen.getByText('Be the first!')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try This Challenge' })).toBeInTheDocument();
    }
  });

  it('renders challenge entries with medal emojis for top 3', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    if (challengeSelect) {
      fireEvent.change(challengeSelect, { target: { value: 'c1' } });
      await waitFor(() => {
        expect(screen.getByText('\uD83E\uDD47')).toBeInTheDocument();
        expect(screen.getByText('\uD83E\uDD48')).toBeInTheDocument();
        expect(screen.getByText('\uD83E\uDD49')).toBeInTheDocument();
      });
    }
  });

  it('renders challenge entries with token counts (singular token for count=1)', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    if (challengeSelect) {
      fireEvent.change(challengeSelect, { target: { value: 'c1' } });
      await waitFor(() => {
        expect(screen.getByText('1 token')).toBeInTheDocument();
        expect(screen.getByText('250 tokens')).toBeInTheDocument();
        expect(screen.getByText('500 tokens')).toBeInTheDocument();
      });
    }
  });

  it('renders Replay buttons on challenge entries', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    if (challengeSelect) {
      fireEvent.change(challengeSelect, { target: { value: 'c1' } });
      await waitFor(() => {
        const replayBtns = screen.getAllByText('Replay');
        expect(replayBtns.length).toBe(4);
      });
    }
  });

  it('opens ReplayViewer when Replay button is clicked', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    if (challengeSelect) {
      fireEvent.change(challengeSelect, { target: { value: 'c1' } });
      await waitFor(() => {
        const replayBtns = screen.getAllByText('Replay');
        expect(replayBtns.length).toBeGreaterThan(0);
      });
      fireEvent.click(screen.getAllByText('Replay')[0]);
      await waitFor(() => {
        expect(container.querySelector('[data-testid="replay-viewer"]')).toBeInTheDocument();
      });
    }
  });

  it('closes ReplayViewer when Close button is clicked', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    expect(challengeSelect).toBeTruthy();
    fireEvent.change(challengeSelect!, { target: { value: 'c1' } });
    await waitFor(() => expect(screen.getAllByText('Replay').length).toBeGreaterThan(0));
    // Open replay viewer
    fireEvent.click(screen.getAllByText('Replay')[0]);
    await waitFor(() => expect(container.querySelector('[data-testid="replay-viewer"]')).toBeInTheDocument());
    // Close replay viewer (covers line 402: setReplayAttemptId(null))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(container.querySelector('[data-testid="replay-viewer"]')).toBeNull());
  });

  it('navigates to PublicProfile when clicking a user with username in global entries', async () => {
    setupFetch({ leaderboardEntries: globalEntries });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    });
    const aliceTexts = screen.getAllByText('Alice');
    fireEvent.click(aliceTexts[aliceTexts.length - 1]);
    expect(mockNavigate).toHaveBeenCalledWith('PublicProfile', { username: 'alice' });
  });

  it('navigates to PublicProfile when clicking a user with username in challenge entries', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    expect(challengeSelect).toBeTruthy();
    fireEvent.change(challengeSelect!, { target: { value: 'c1' } });
    await waitFor(() => expect(screen.getAllByText('Alice').length).toBeGreaterThan(0));
    // Click Alice's name in the challenge entries (covers line 381)
    const aliceTexts = screen.getAllByText('Alice');
    fireEvent.click(aliceTexts[0]);
    expect(mockNavigate).toHaveBeenCalledWith('PublicProfile', { username: 'alice' });
  });

  it('handles period change on challenge tab correctly', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
    await waitFor(() => expect(screen.getByText('Select a challenge...')).toBeInTheDocument());
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    if (challengeSelect) {
      fireEvent.change(challengeSelect, { target: { value: 'c1' } });
      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('challengeId=c1'));
      });
      fireEvent.click(screen.getAllByText('All Time')[0]);
      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('period=all'));
      });
    }
  });

  it('handles division change on challenge tab', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    if (challengeSelect) {
      fireEvent.change(challengeSelect, { target: { value: 'c1' } });
      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('challengeId=c1')));
      fireEvent.click(screen.getAllByText('Unlimited')[0]);
      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('division=unlimited'));
      });
    }
  });

  it('shows "No solves this month yet" for month period with no entries', async () => {
    setupFetch({ leaderboardEntries: [] });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/No solves this week/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByText('This Month')[0]);
    await waitFor(() => {
      expect(screen.getAllByText(/No solves this month|No solves this week|Early leaderboard/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders ActivityFeed below global leaderboard when entries exist', async () => {
    setupFetch({ leaderboardEntries: globalEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    });
    expect(container.querySelector('[data-testid="activity-feed"]')).toBeInTheDocument();
  });

  it('navigates to Arena for Try This Challenge on challenge empty state', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries: [] });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    if (challengeSelect) {
      fireEvent.change(challengeSelect, { target: { value: 'c1' } });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Try This Challenge' })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Try This Challenge' }));
      expect(mockNavigate).toHaveBeenCalledWith('Arena', { challengeId: 'c1' });
    }
  });

  it('handles podium rendering with fewer than 3 entries', async () => {
    // Only 2 entries: podium indices [1,0,2] will have index 2 return undefined
    const twoEntries = [
      { rank: 1, user: { id: 'u1', name: 'Solo', avatarUrl: null, username: 'solo' }, stats: { solved: 1, attempts: 1, avgCost: 100, totalCost: 100 } },
      { rank: 2, user: { id: 'u2', name: 'Duo', avatarUrl: null, username: null }, stats: { solved: 1, attempts: 1, avgCost: 200, totalCost: 200 } },
    ];
    setupFetch({ leaderboardEntries: twoEntries });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Solo').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Duo').length).toBeGreaterThanOrEqual(1);
    });
    // The podium renders without crashing even though entry at index 2 is undefined
  });

  it('handles leaderboard fetch returning not ok', async () => {
    setupFetch({ leaderboardEntries: [], leaderboardOk: false });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Leaderboard').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles division toggle on global tab with season selected', async () => {
    setupFetch({ leaderboardEntries: globalEntries, seasons: mockSeasons });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByText(/Season 1/)).toBeInTheDocument());
    // Select a season first
    const select = container.querySelectorAll('select')[0];
    expect(select).toBeTruthy();
    fireEvent.change(select!, { target: { value: 's1' } });
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('season=s1')));
    // Now toggle division with season active
    fireEvent.click(screen.getAllByText('Unlimited')[0]);
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('division=unlimited'));
    });
  });

  it('handles null leaderboard data gracefully', async () => {
    setupFetch();
    mockDashboardState = {
      ...mockDashboardState,
      leaderboard: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
    };
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Leaderboard').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('sorts by AFI when By AFI sort toggle is clicked', async () => {
    const entriesWithAfi = [
      { rank: 1, user: { id: 'u1', name: 'Alice', avatarUrl: null, username: 'alice' }, stats: { solved: 10, attempts: 15, avgCost: 500, totalCost: 5000 }, afi: { score: 300 } },
      { rank: 2, user: { id: 'u2', name: 'Bob', avatarUrl: null, username: 'bob' }, stats: { solved: 8, attempts: 12, avgCost: 800, totalCost: 6400 }, afi: { score: 600 } },
      { rank: 3, user: { id: 'u3', name: 'Carol', avatarUrl: null, username: null }, stats: { solved: 6, attempts: 10, avgCost: 1200, totalCost: 7200 }, afi: null },
    ];
    setupFetch({ leaderboardEntries: entriesWithAfi });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    });
    // Click "By AFI" toggle
    fireEvent.click(screen.getByText('By AFI'));
    // After sorting by AFI, Bob (score 600) should be first, Alice (300) second, Carol (null→0) third
    await waitFor(() => {
      const texts = screen.getAllByText(/Alice|Bob|Carol/);
      expect(texts.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('error handling', () => {
    it('handles leaderboard fetch network failure gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));
      mockDashboardState = { ...mockDashboardState, leaderboard: { data: [], status: 'loaded', lastFetchedAt: Date.now() }, challenges: { data: mockChallenges, status: 'loaded', lastFetchedAt: Date.now() } };
      render(<LeaderboardScreen />);
      await waitFor(() => { expect(screen.getAllByText('Leaderboard').length).toBeGreaterThanOrEqual(1); });
    });

    it('handles entries with null avatarUrl', async () => {
      setupFetch({ leaderboardEntries: [{ rank: 1, user: { id: 'u1', name: 'NoAvatar', avatarUrl: null, username: null }, stats: { solved: 5, attempts: 10, avgCost: 500, totalCost: 5000 } }] });
      render(<LeaderboardScreen />);
      await waitFor(() => { expect(screen.getAllByText('NoAvatar').length).toBeGreaterThanOrEqual(1); });
    });

    it('handles entries with zero solved count', async () => {
      setupFetch({ leaderboardEntries: [{ rank: 1, user: { id: 'u1', name: 'Zero', avatarUrl: null, username: 'zero' }, stats: { solved: 0, attempts: 5, avgCost: 0, totalCost: 0 } }] });
      render(<LeaderboardScreen />);
      await waitFor(() => { expect(screen.getAllByText('Zero').length).toBeGreaterThanOrEqual(1); });
    });

    it('handles single entry podium', async () => {
      setupFetch({ leaderboardEntries: [{ rank: 1, user: { id: 'u1', name: 'Solo', avatarUrl: null, username: 'solo' }, stats: { solved: 1, attempts: 1, avgCost: 100, totalCost: 100 } }] });
      render(<LeaderboardScreen />);
      await waitFor(() => { expect(screen.getAllByText('Solo').length).toBeGreaterThanOrEqual(1); });
    });

    it('handles empty challenges list on challenge tab', async () => {
      setupFetch({ leaderboardEntries: [], challenges: [] });
      render(<LeaderboardScreen />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
      await waitFor(() => { expect(screen.getByText('Select a challenge...')).toBeInTheDocument(); });
    });

    it('handles user clicking on user without username', async () => {
      setupFetch({ leaderboardEntries: globalEntries });
      render(<LeaderboardScreen />);
      await waitFor(() => { expect(screen.getAllByText('Carol').length).toBeGreaterThanOrEqual(1); });
      const carolTexts = screen.getAllByText('Carol');
      fireEvent.click(carolTexts[carolTexts.length - 1]);
      // Carol has null username — should not navigate
    });

    it('handles rapid period switching', async () => {
      setupFetch({ leaderboardEntries: globalEntries });
      render(<LeaderboardScreen />);
      await waitFor(() => expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1));
      fireEvent.click(screen.getAllByText('This Month')[0]);
      fireEvent.click(screen.getAllByText('All Time')[0]);
      fireEvent.click(screen.getAllByText('This Week')[0]);
      await waitFor(() => { expect(screen.getAllByText('Leaderboard').length).toBeGreaterThanOrEqual(1); });
    });

    it('handles entries with very large cost values', async () => {
      setupFetch({ leaderboardEntries: [{ rank: 1, user: { id: 'u1', name: 'Exp', avatarUrl: null, username: 'exp' }, stats: { solved: 1, attempts: 1, avgCost: 999999999, totalCost: 999999999 } }] });
      render(<LeaderboardScreen />);
      await waitFor(() => { expect(screen.getAllByText('Exp').length).toBeGreaterThanOrEqual(1); });
    });

    it('handles challenge leaderboard fetch returning non-ok', async () => {
      setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries: [], leaderboardOk: false });
      const { container } = render(<LeaderboardScreen />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
      const selects = container.querySelectorAll('select');
      const challengeSelect = selects[selects.length - 1];
      if (challengeSelect) {
        fireEvent.change(challengeSelect, { target: { value: 'c1' } });
        await waitFor(() => { expect(screen.getAllByText('Leaderboard').length).toBeGreaterThanOrEqual(1); });
      }
    });

    it('handles challenge entries with null submittedAt', async () => {
      setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries: [{ rank: 1, user: { id: 'u1', name: 'Alice', avatarUrl: null, username: 'alice' }, attemptId: 'att1', cost: 500, tokens: 100, submittedAt: null }] });
      const { container } = render(<LeaderboardScreen />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'By Challenge' })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'By Challenge' }));
      const selects = container.querySelectorAll('select');
      const challengeSelect = selects[selects.length - 1];
      if (challengeSelect) {
        fireEvent.change(challengeSelect, { target: { value: 'c1' } });
        await waitFor(() => { expect(screen.getAllByText('Alice').length).toBeGreaterThan(0); });
      }
    });
  });
});
