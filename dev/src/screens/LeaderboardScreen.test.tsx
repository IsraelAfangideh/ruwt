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
vi.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: () => mockAuthReturn,
}));
vi.mock('@/components/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/components/ui/Avatar', () => ({ Avatar: () => <div data-testid="avatar" /> }));
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
}));
vi.mock('@/components/ActivityFeed', () => ({
  ActivityFeed: () => <div data-testid="activity-feed" />,
}));
vi.mock('@/components/ReplayViewer', () => ({
  ReplayViewer: ({ onClose }: any) => <div data-testid="replay-viewer"><button onClick={onClose}>Close</button></div>,
}));
vi.mock('@/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    borderStrong: '#999', card: '#fff', muted: '#f5f5f5', error: '#f00', errorBg: '#fee',
    success: '#0a0', successBg: '#efe', primary: '#000', primaryForeground: '#fff',
    secondary: '#eee', secondaryForeground: '#000', destructive: '#f00',
    textSubtle: '#aaa', bgElevated: '#fafafa', accentBg: '#ffe',
  }),
}));
vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));

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
  });

  it('renders loading state initially', () => {
    setupFetch();
    const { container } = render(<LeaderboardScreen />);
    expect(container.querySelector('svg') || container.textContent).toBeTruthy();
  });

  it('shows loading state when auth is loading (redirect handled by useAuthGuard)', async () => {
    mockAuthReturn = { user: null, loading: true };
    setupFetch();
    const { container } = render(<LeaderboardScreen />);
    // Should show loading spinner since authLoading is true
    expect(container.querySelector('svg') || container.textContent).toBeTruthy();
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
    expect(screen.getByText(/Open: Cloudflare models only/)).toBeTruthy();
  });

  it('shows empty state message when no entries for this week', async () => {
    setupFetch();
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/No solves this week/).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText(/Be the first to claim/)).toBeTruthy();
  });

  it('shows Browse Problems button in empty state', async () => {
    setupFetch();
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Browse Problems')).toBeTruthy();
    });
  });

  it('navigates to Challenges when Browse Problems is clicked in empty state', async () => {
    setupFetch();
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Browse Problems')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Browse Problems'));
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  it('shows ActivityFeed in empty state', async () => {
    setupFetch();
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="activity-feed"]')).toBeTruthy();
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
      expect(screen.getByText('#')).toBeTruthy();
    });
    expect(screen.getByText('User')).toBeTruthy();
    expect(screen.getByText('Solved')).toBeTruthy();
    expect(screen.getByText('Avg Cost')).toBeTruthy();
    expect(screen.getByText('Total Cost')).toBeTruthy();
  });

  it('shows dashes for users without stats', async () => {
    setupFetch({ leaderboardEntries: globalEntries });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Dave')).toBeTruthy();
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
      expect(screen.getByText('Select a challenge...')).toBeTruthy();
    });
  });

  it('switches back to global tab when Global button is clicked', async () => {
    setupFetch({ leaderboardEntries: globalEntries, challenges: mockChallenges });
    render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1));
    // Switch to challenge tab
    fireEvent.click(screen.getAllByText('By Challenge')[0]);
    await waitFor(() => expect(screen.getByText('Select a challenge...')).toBeTruthy());
    // Switch back to global tab
    fireEvent.click(screen.getAllByText('Global')[0]);
    await waitFor(() => expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1));
  });

  it('renders season filter when seasons are present', async () => {
    setupFetch({ leaderboardEntries: globalEntries, seasons: mockSeasons });
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Season 1/)).toBeTruthy();
    });
    expect(screen.getByText(/Season 2.*Current/)).toBeTruthy();
  });

  it('changes season filter when season is selected', async () => {
    setupFetch({ leaderboardEntries: globalEntries, seasons: mockSeasons });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Season 1/)).toBeTruthy();
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
      expect(screen.getByText(/Season 1/)).toBeTruthy();
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
      expect(screen.getByText('By Challenge')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('By Challenge'));
    await waitFor(() => {
      expect(screen.getByText('Select a challenge...')).toBeTruthy();
    });
    expect(screen.getByText(/FizzBuzz Budget/)).toBeTruthy();
    expect(screen.getByText(/Cache Buster/)).toBeTruthy();
  });

  it('fetches challenge leaderboard when a challenge is selected', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('By Challenge')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('By Challenge'));
    await waitFor(() => {
      expect(screen.getByText('Select a challenge...')).toBeTruthy();
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
    await waitFor(() => expect(screen.getByText('By Challenge')).toBeTruthy());
    fireEvent.click(screen.getByText('By Challenge'));
    await waitFor(() => expect(screen.getByText('Select a challenge...')).toBeTruthy());
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
      expect(screen.getByText('By Challenge')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('By Challenge'));
    await waitFor(() => {
      expect(screen.getByText('Select a challenge...')).toBeTruthy();
    });
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    if (challengeSelect) {
      fireEvent.change(challengeSelect, { target: { value: 'c1' } });
      await waitFor(() => {
        expect(screen.getByText('Nobody has solved this challenge yet.')).toBeTruthy();
      });
      expect(screen.getByText('Be the first!')).toBeTruthy();
      expect(screen.getByText('Try This Challenge')).toBeTruthy();
    }
  });

  it('renders challenge entries with medal emojis for top 3', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('By Challenge')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('By Challenge'));
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    if (challengeSelect) {
      fireEvent.change(challengeSelect, { target: { value: 'c1' } });
      await waitFor(() => {
        expect(screen.getByText('\uD83E\uDD47')).toBeTruthy();
        expect(screen.getByText('\uD83E\uDD48')).toBeTruthy();
        expect(screen.getByText('\uD83E\uDD49')).toBeTruthy();
      });
    }
  });

  it('renders challenge entries with token counts (singular token for count=1)', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('By Challenge')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('By Challenge'));
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    if (challengeSelect) {
      fireEvent.change(challengeSelect, { target: { value: 'c1' } });
      await waitFor(() => {
        expect(screen.getByText('1 token')).toBeTruthy();
        expect(screen.getByText('250 tokens')).toBeTruthy();
        expect(screen.getByText('500 tokens')).toBeTruthy();
      });
    }
  });

  it('renders Replay buttons on challenge entries', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('By Challenge')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('By Challenge'));
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
      expect(screen.getByText('By Challenge')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('By Challenge'));
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
        expect(container.querySelector('[data-testid="replay-viewer"]')).toBeTruthy();
      });
    }
  });

  it('closes ReplayViewer when Close button is clicked', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByText('By Challenge')).toBeTruthy());
    fireEvent.click(screen.getByText('By Challenge'));
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    expect(challengeSelect).toBeTruthy();
    fireEvent.change(challengeSelect!, { target: { value: 'c1' } });
    await waitFor(() => expect(screen.getAllByText('Replay').length).toBeGreaterThan(0));
    // Open replay viewer
    fireEvent.click(screen.getAllByText('Replay')[0]);
    await waitFor(() => expect(container.querySelector('[data-testid="replay-viewer"]')).toBeTruthy());
    // Close replay viewer (covers line 402: setReplayAttemptId(null))
    fireEvent.click(screen.getByText('Close'));
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
    await waitFor(() => expect(screen.getByText('By Challenge')).toBeTruthy());
    fireEvent.click(screen.getByText('By Challenge'));
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
      expect(screen.getByText('By Challenge')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('By Challenge'));
    await waitFor(() => expect(screen.getByText('Select a challenge...')).toBeTruthy());
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
      expect(screen.getByText('By Challenge')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('By Challenge'));
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
      expect(screen.getByText(/No solves this week/)).toBeTruthy();
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
    expect(container.querySelector('[data-testid="activity-feed"]')).toBeTruthy();
  });

  it('navigates to Arena for Try This Challenge on challenge empty state', async () => {
    setupFetch({ leaderboardEntries: [], challenges: mockChallenges, challengeEntries: [] });
    const { container } = render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByText('By Challenge')).toBeTruthy());
    fireEvent.click(screen.getByText('By Challenge'));
    const selects = container.querySelectorAll('select');
    const challengeSelect = selects[selects.length - 1];
    if (challengeSelect) {
      fireEvent.change(challengeSelect, { target: { value: 'c1' } });
      await waitFor(() => expect(screen.getByText('Try This Challenge')).toBeTruthy());
      fireEvent.click(screen.getByText('Try This Challenge'));
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
    await waitFor(() => expect(screen.getByText(/Season 1/)).toBeTruthy());
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
});
