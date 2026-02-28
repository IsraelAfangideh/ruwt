// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
let mockRouteParams: any = { username: 'testuser' };
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
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

function setupFetch(response: any) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

const { PublicProfileScreen } = await import('./PublicProfileScreen');

describe('PublicProfileScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouteParams = { username: 'testuser' };
    setupFetch({ ok: true, json: () => Promise.resolve(mockProfileData) });
  });

  it('renders loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const { container } = render(<PublicProfileScreen />);
    expect(container.querySelector('svg') || container.textContent).toBeTruthy();
  });

  it('shows "No username provided" when route has no username (lines 70-72)', async () => {
    mockRouteParams = {};
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('No username provided')).toBeTruthy();
    });
  });

  it('renders profile data after loading', async () => {
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/TestUser/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders error state when user not found', async () => {
    setupFetch({ ok: false, json: () => Promise.resolve({ error: 'User not found' }) });
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('User not found').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders "Failed to load profile" when fetch throws (catch branch line 85)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load profile')).toBeTruthy();
    });
  });

  it('renders Back to Leaderboard link and navigates on click (line 104)', async () => {
    setupFetch({ ok: false, json: () => Promise.resolve({ error: 'Not found' }) });
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('Back to Leaderboard')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Back to Leaderboard'));
    expect(mockNavigate).toHaveBeenCalledWith('Leaderboard');
  });

  it('renders full profile with stats, radar, and empty replays (lines 117-165)', async () => {
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('TestUser')).toBeTruthy();
    });
    expect(screen.getByText(/Back/)).toBeTruthy();
    expect(screen.getByText('@testuser')).toBeTruthy();
    expect(screen.getByText(/Member since/)).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('Challenges Solved')).toBeTruthy();
    expect(screen.getByText('Avg Cost')).toBeTruthy();
    expect(screen.getByText('#5')).toBeTruthy();
    expect(screen.getByText('Global Rank')).toBeTruthy();
    expect(screen.getByText('Skill Profile')).toBeTruthy();
    expect(screen.getByTestId('radar-chart')).toBeTruthy();
    expect(screen.getByText('Recent Replays')).toBeTruthy();
    expect(screen.getByText('No public replays yet.')).toBeTruthy();
  });

  it('renders recent replays when present (lines 162-179)', async () => {
    setupFetch({
      ok: true,
      json: () => Promise.resolve({
        ...mockProfileData,
        recentReplays: [{
          attemptId: 'att1', challengeTitle: 'FizzBuzz Budget', challengeDifficulty: 'easy',
          challengeCategory: 'prompt_efficiency', totalCost: 500, inputTokens: 100, outputTokens: 200,
          submittedAt: '2026-01-01T00:00:00Z',
        }],
      }),
    });
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('FizzBuzz Budget')).toBeTruthy();
    });
    expect(screen.getByText(/\$0\.05/)).toBeTruthy();
    expect(screen.getByText(/300 tokens/)).toBeTruthy();
  });

  it('renders fallback "User not found" when fetch !ok and json has no error field (line 103)', async () => {
    setupFetch({ ok: false, json: () => Promise.reject(new Error('no json')) });
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeTruthy();
    });
  });

  it('navigates back when Back button is clicked (line 117)', async () => {
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Back/)).toBeTruthy();
    });
    fireEvent.click(screen.getByText(/Back/));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('navigates to Replay when replay card is clicked (line 165)', async () => {
    setupFetch({
      ok: true,
      json: () => Promise.resolve({
        ...mockProfileData,
        recentReplays: [{
          attemptId: 'att1', challengeTitle: 'Cache Buster', challengeDifficulty: 'medium',
          challengeCategory: 'debugging', totalCost: 1000, inputTokens: 500, outputTokens: 500,
          submittedAt: '2026-01-01',
        }],
      }),
    });
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('Cache Buster')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Cache Buster'));
    expect(mockNavigate).toHaveBeenCalledWith('Replay', { attemptId: 'att1' });
  });
});
