// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockReset = vi.fn();
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } });

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));
vi.mock('@/components/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
}));
vi.mock('@/components/ui/Avatar', () => ({ Avatar: () => <div data-testid="avatar" /> }));
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

const mockDailyData = {
  date: '2026-02-28',
  challenge: { id: 'dc1', title: 'Daily FizzBuzz', description: 'Solve it efficiently', difficulty: 'easy', category: 'prompt_efficiency' },
  leaderboard: [
    { rank: 1, user: { id: 'u2', name: 'Alice', avatarUrl: null }, attemptId: 'a1', cost: 1000, tokens: 500, submittedAt: '2026-02-28T10:00:00Z' },
  ],
  secondsUntilNext: 3600,
};

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockDailyData),
}));

const { DailyChallengeScreen } = await import('./DailyChallengeScreen');

describe('DailyChallengeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDailyData),
    }));
  });

  it('renders loading state initially', () => {
    const { container } = render(<DailyChallengeScreen />);
    expect(container.querySelector('svg') || container.textContent).toBeTruthy();
  });

  it('renders daily challenge title after loading', async () => {
    render(<DailyChallengeScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Daily FizzBuzz/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders dashboard layout wrapper', async () => {
    const { container } = render(<DailyChallengeScreen />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="dashboard-layout"]')).not.toBeNull();
    });
  });

  it('redirects to Login when user is not authenticated (lines 52-53)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    render(<DailyChallengeScreen />);
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    });
  });

  it('renders countdown timer from secondsUntilNext and starts interval (line 73)', async () => {
    render(<DailyChallengeScreen />);
    await waitFor(() => {
      // The countdown should render from secondsUntilNext=3600 = 1h 0m 0s
      expect(screen.getByText(/1h 0m 0s/)).toBeTruthy();
    });
    // The countdown interval (line 73) is running, which calls setCountdown(prev => Math.max(0, prev - 1)).
    // After a real second passes, it will decrement. We verify the interval fires:
    await waitFor(() => {
      // After at least 1s, the countdown should have changed
      expect(screen.getByText(/0h 59m/)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('navigates to Arena when Start Today\'s Challenge is clicked (line 124)', async () => {
    render(<DailyChallengeScreen />);
    await waitFor(() => {
      expect(screen.getByText("Start Today's Challenge")).toBeTruthy();
    }, { timeout: 3000 });
    fireEvent.click(screen.getByText("Start Today's Challenge"));
    expect(mockNavigate).toHaveBeenCalledWith('Arena', { challengeId: 'dc1' });
  });
});
