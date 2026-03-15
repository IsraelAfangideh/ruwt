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
vi.mock('@/shared/ui/Avatar', () => ({ Avatar: () => <div data-testid="avatar" /> }));
vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
}));
vi.mock('@/features/profile/RadarChart', () => ({
  RadarChart: () => <div data-testid="radar-chart" />,
}));
let capturedFollowOnToggle: ((following: boolean) => void) | null = null;
vi.mock('@/features/profile/FollowButton', () => ({
  FollowButton: ({ onToggle }: any) => {
    capturedFollowOnToggle = onToggle;
    return <div data-testid="follow-button" />;
  },
}));
vi.mock('@/shared/social/SocialShareButtons', () => ({
  SocialShareButtons: () => <div data-testid="social-share" />,
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const mockProfileData = {
  user: { name: 'TestUser', avatarUrl: null, username: 'testuser', bio: null, createdAt: '2026-01-01' },
  stats: { solved: 10, avgCost: 5000, globalRank: 5, followers: 3, following: 2 },
  isFollowing: false,
  badges: [],
  similarSolvers: [],
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
    expect(container.querySelector('[data-testid="skeleton-profile"]')).not.toBeNull();
  });

  it('shows "No username provided" when route has no username param', async () => {
    mockRouteParams = {};
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('No username provided')).toBeInTheDocument();
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
      expect(screen.getByText('Failed to load profile')).toBeInTheDocument();
    });
  });

  it('renders Back to Leaderboard link and navigates on click', async () => {
    setupFetch({ ok: false, json: () => Promise.resolve({ error: 'Not found' }) });
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('Back to Leaderboard')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Back to Leaderboard'));
    expect(mockNavigate).toHaveBeenCalledWith('Leaderboard');
  });

  it('renders full profile with stats, radar chart, and empty replays section', async () => {
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('TestUser')).toBeInTheDocument();
    });
    expect(screen.getByText(/Back/)).toBeInTheDocument();
    expect(screen.getByText('@testuser')).toBeInTheDocument();
    expect(screen.getByText(/Member since/)).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Challenges Solved')).toBeInTheDocument();
    expect(screen.getByText('Avg Cost')).toBeInTheDocument();
    expect(screen.getByText('#5')).toBeInTheDocument();
    expect(screen.getByText('Global Rank')).toBeInTheDocument();
    expect(screen.getByText('AI Fluency Breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
    expect(screen.getByText('Recent Replays')).toBeInTheDocument();
    expect(screen.getByText('No public replays yet.')).toBeInTheDocument();
  });

  it('renders recent replays with cost and token details', async () => {
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
      expect(screen.getByText('FizzBuzz Budget')).toBeInTheDocument();
    });
    expect(screen.getByText(/\$0\.05/)).toBeInTheDocument();
    expect(screen.getByText(/300 tokens/)).toBeInTheDocument();
  });

  it('shows "User not found" when fetch fails and JSON has no error field', async () => {
    setupFetch({ ok: false, json: () => Promise.reject(new Error('no json')) });
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument();
    });
  });

  it('navigates back when Back button is clicked', async () => {
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Back/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Back/));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('navigates to Replay when replay card is clicked', async () => {
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
      expect(screen.getByText('Cache Buster')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Cache Buster'));
    expect(mockNavigate).toHaveBeenCalledWith('Replay', { attemptId: 'att1' });
  });

  it('renders badges section when badges are present', async () => {
    setupFetch({
      ok: true,
      json: () => Promise.resolve({
        ...mockProfileData,
        badges: [
          { badgeType: 'speed_demon', title: 'Speed Demon', icon: '\u26A1' },
          { badgeType: 'budget_master', title: 'Budget Master', icon: '\uD83D\uDCB0' },
        ],
      }),
    });
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('Badges')).toBeInTheDocument();
    });
    expect(screen.getByText('Speed Demon')).toBeInTheDocument();
    expect(screen.getByText('Budget Master')).toBeInTheDocument();
  });

  it('FollowButton onToggle increments follower count', async () => {
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('TestUser')).toBeInTheDocument();
    });
    // Initial follower count
    expect(screen.getByText('3')).toBeInTheDocument(); // 3 followers
    // Toggle follow on
    if (capturedFollowOnToggle) {
      capturedFollowOnToggle(true);
    }
    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument(); // now 4
    });
  });

  it('FollowButton onToggle decrements follower count', async () => {
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('TestUser')).toBeInTheDocument();
    });
    // Toggle unfollow
    if (capturedFollowOnToggle) {
      capturedFollowOnToggle(false);
    }
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // 3 - 1
    });
  });

  it('renders bio when user has a bio', async () => {
    setupFetch({
      ok: true,
      json: () => Promise.resolve({
        ...mockProfileData,
        user: { ...mockProfileData.user, bio: 'I love coding!' },
      }),
    });
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('I love coding!')).toBeInTheDocument();
    });
  });

  it('renders similar solvers section', async () => {
    setupFetch({
      ok: true,
      json: () => Promise.resolve({
        ...mockProfileData,
        similarSolvers: [
          { username: 'alice', name: 'Alice', avatarUrl: null, solved: 5 },
        ],
      }),
    });
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('Similar Solvers')).toBeInTheDocument();
    });
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
