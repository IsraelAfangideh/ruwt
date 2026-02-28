// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn() }),
  useRoute: () => ({ params: { username: 'testuser' } }),
}));
vi.mock('@/components/ui/Avatar', () => ({ Avatar: () => <div data-testid="avatar" /> }));
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
}));
vi.mock('@/components/RadarChart', () => ({
  RadarChart: () => <div data-testid="radar-chart" />,
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

const mockProfileData = {
  user: { name: 'TestUser', avatarUrl: null, username: 'testuser', createdAt: '2026-01-01' },
  stats: { solved: 10, avgCost: 5000, globalRank: 5 },
  radar: { modelSelection: 80, promptEfficiency: 70, debugging: 60, multiModel: 50, realWorld: 90 },
  recentReplays: [],
};

describe('PublicProfileScreen', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders loading state initially', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const { PublicProfileScreen } = await import('./PublicProfileScreen');
    const { container } = render(<PublicProfileScreen />);
    expect(container.querySelector('svg') || container.textContent).toBeTruthy();
  });

  it('renders profile data after loading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProfileData),
    }));
    const { PublicProfileScreen } = await import('./PublicProfileScreen');
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/TestUser/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders error state when user not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'User not found' }),
    }));
    const { PublicProfileScreen } = await import('./PublicProfileScreen');
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('User not found').length).toBeGreaterThanOrEqual(1);
    });
  });
});
