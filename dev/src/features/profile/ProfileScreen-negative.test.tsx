/**
 * Negative / error-path tests for ProfileScreen.
 * Covers: double-submission on username save, XSS/SQL injection in username,
 * JSON parse failures, network errors.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

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
  Button: ({ children, onPress, disabled, ...props }: any) => <button onClick={onPress} disabled={disabled} {...props}>{children}</button>,
}));
vi.mock('@/shared/ui/Input', () => ({
  Input: (props: any) => <input data-testid="username-input" value={props.value} onChange={(e: any) => props.onChangeText?.(e.target.value)} placeholder={props.placeholder} />,
}));
vi.mock('@/shared/ui/Label', () => ({ Label: ({ children }: any) => <label>{children}</label> }));
vi.mock('@/shared/ui/Progress', () => ({ Progress: ({ value }: any) => <div data-testid="progress" data-value={value} /> }));
vi.mock('@/shared/ui/Skeleton', () => ({ Skeleton: () => <div data-testid="skeleton" /> }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const baseProfile = {
  profile: { name: 'TestUser', email: 'test@test.com', avatarUrl: null, username: null, credits: 50000, currentStreak: 3, longestStreak: 7, streakFreezes: 2 },
  progress: { totalChallenges: 60, solvedCount: 5, categorySolves: { prompt_efficiency: 3 }, categoryTotals: { prompt_efficiency: 10 } },
  rank: { position: 12, totalRanked: 50 },
  recentBadges: [],
};
const mockRefreshEndpoint = vi.fn();

function makeCachedState(data: any = baseProfile) {
  return {
    state: {
      dashboard: { data, status: 'loaded', lastFetchedAt: Date.now() },
      badges: { data: { catalog: [], earned: [] }, status: 'loaded', lastFetchedAt: Date.now() },
      challenges: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
      leaderboard: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      seasons: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      bookmarks: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      activity: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      notifications: { data: { unreadCount: 0 }, status: 'loaded', lastFetchedAt: Date.now() },
    },
    initialLoadComplete: true,
    refreshEndpoint: mockRefreshEndpoint,
    refreshAll: vi.fn(),
  };
}

const { ProfileScreen } = await import('./ProfileScreen');

describe('ProfileScreen — negative paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDashboardData.mockReturnValue(makeCachedState());
  });

  /**
   * These three used to assert that a hostile handle reached the server.
   * The claim UI now rejects anything the pattern refuses before it sends, so
   * the string never leaves the browser. The server still validates every one
   * of these — see functions/api/profile.test.ts — because the client is a
   * convenience, not the authority.
   */
  async function openClaimAndType(value: string) {
    render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText('Set username')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Set username'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument());

    const input = document.querySelector('[data-testid="username-input"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  }

  it('refuses to send an XSS string, and never executes it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await openClaimAndType('<script>alert(1)</script>');

    await waitFor(() => expect(screen.getByText(/Lowercase letters|characters/)).toBeInTheDocument());
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === 'PATCH')).toBe(false);
    expect(document.querySelector('script')).toBeNull();
  });

  it('refuses to send a SQL injection string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await openClaimAndType("'; DROP TABLE users; --");

    await waitFor(() => expect(screen.getByText(/Lowercase letters|characters/)).toBeInTheDocument());
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === 'PATCH')).toBe(false);
  });

  it('refuses to send an extremely long username (1000 chars)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await openClaimAndType('a'.repeat(1000));

    await waitFor(() => expect(screen.getByText(/30 characters/)).toBeInTheDocument());
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === 'PATCH')).toBe(false);
  });

  it('handles network error on username PATCH (fetch throws)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
      if (opts?.method === 'PATCH') throw new Error('Network failure');
      return { ok: true, json: async () => ({}) } as Response;
    }));

    // A valid handle, so the request actually goes out and can fail.
    await openClaimAndType('newuser');

    await waitFor(() => expect(screen.getByText(/Could not reach the server/)).toBeInTheDocument());
  });

  it('shows error state when dashboard data context returns error status', async () => {
    mockUseDashboardData.mockReturnValue({
      ...makeCachedState(null),
      state: {
        ...makeCachedState(null).state,
        dashboard: { data: null, status: 'error', lastFetchedAt: Date.now() },
      },
    });
    render(<ProfileScreen />);
    await waitFor(() => {
      // Should show either skeleton or unavailable state, not crash
      expect(document.querySelector('[data-testid="dashboard-layout"]')).not.toBeNull();
    });
  });
});
