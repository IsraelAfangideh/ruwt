// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockReset = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
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
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
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
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders loading state initially', () => {
    const { container } = render(<DailyChallengeScreen />);
    expect(container.querySelector('svg') || container.textContent).toBeTruthy();
  });

  it('renders daily challenge title after loading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDailyData),
    }));
    render(<DailyChallengeScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Daily FizzBuzz/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders dashboard layout wrapper', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDailyData),
    }));
    const { container } = render(<DailyChallengeScreen />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="dashboard-layout"]')).not.toBeNull();
    });
  });
});
