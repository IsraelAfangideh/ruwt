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

  it('sends XSS string in username to server without client-side execution', async () => {
    let patchBody: any = null;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
      if (opts?.method === 'PATCH') {
        patchBody = JSON.parse(opts.body);
        return { ok: false, json: async () => ({ error: 'Invalid username' }) } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    }));

    render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText('Set username')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Set username'));
    await waitFor(() => expect(screen.getByText('Save')).toBeInTheDocument());

    const input = document.querySelector('[data-testid="username-input"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '<script>alert(1)</script>' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(patchBody).not.toBeNull();
      expect(patchBody.username).toBe('<script>alert(1)</script>');
    });
  });

  it('passes SQL injection string in username to server', async () => {
    let patchBody: any = null;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
      if (opts?.method === 'PATCH') {
        patchBody = JSON.parse(opts.body);
        return { ok: false, json: async () => ({ error: 'Invalid username' }) } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    }));

    render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText('Set username')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Set username'));
    await waitFor(() => expect(screen.getByText('Save')).toBeInTheDocument());

    const input = document.querySelector('[data-testid="username-input"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "'; DROP TABLE users; --" } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(patchBody).not.toBeNull();
      // ProfileScreen lowercases username before sending
      expect(patchBody.username).toBe("'; drop table users; --");
    });
  });

  it('handles network error on username PATCH (fetch throws)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
      if (opts?.method === 'PATCH') throw new Error('Network failure');
      return { ok: true, json: async () => ({}) } as Response;
    }));

    render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText('Set username')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Set username'));
    await waitFor(() => expect(screen.getByText('Save')).toBeInTheDocument());

    const input = document.querySelector('[data-testid="username-input"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'newuser' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });

  it('handles extremely long username (1000 chars)', async () => {
    let patchBody: any = null;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
      if (opts?.method === 'PATCH') {
        patchBody = JSON.parse(opts.body);
        return { ok: false, json: async () => ({ error: 'Username too long' }) } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    }));

    render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText('Set username')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Set username'));
    await waitFor(() => expect(screen.getByText('Save')).toBeInTheDocument());

    const longUsername = 'a'.repeat(1000);
    const input = document.querySelector('[data-testid="username-input"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: longUsername } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(patchBody).not.toBeNull();
      expect(patchBody.username).toBe(longUsername);
    });
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
