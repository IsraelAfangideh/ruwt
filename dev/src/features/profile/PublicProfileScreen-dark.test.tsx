// @vitest-environment jsdom
/**
 * Dark-mode variant of PublicProfileScreen tests.
 * Exercises isDark branches for styling ternaries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { username: 'testuser' } }),
}));
vi.mock('@/shared/ui/Avatar', () => ({ Avatar: () => <div data-testid="avatar" /> }));
vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
}));
vi.mock('@/features/profile/RadarChart', () => ({
  RadarChart: () => <div data-testid="radar-chart" />,
}));
vi.mock('@/features/profile/FollowButton', () => ({
  FollowButton: () => <div data-testid="follow-button" />,
}));
vi.mock('@/shared/social/SocialShareButtons', () => ({
  SocialShareButtons: () => <div data-testid="social-share" />,
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockDarkTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const mockProfileData = {
  user: { name: 'TestUser', avatarUrl: null, username: 'testuser', bio: 'A test bio', createdAt: '2026-01-01' },
  stats: { solved: 10, avgCost: 5000, globalRank: 5, followers: 3, following: 2 },
  isFollowing: false,
  badges: [{ badgeType: 'speed_demon', title: 'Speed Demon', icon: '\u26A1' }],
  similarSolvers: [{ username: 'alice', name: 'Alice', solved: 8 }],
  radar: { modelSelection: 80, promptEfficiency: 70, debugging: 60, multiModel: 50, realWorld: 90 },
  recentReplays: [{ attemptId: 'att1', challengeTitle: 'FizzBuzz', status: 'passed', cost: 500, submittedAt: '2026-01-01T00:00:00Z' }],
};

const { PublicProfileScreen } = await import('./PublicProfileScreen');

describe('PublicProfileScreen (dark mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockProfileData) }));
  });

  it('renders profile in dark mode', async () => {
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/TestUser/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders stats in dark mode', async () => {
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/10/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders badges in dark mode', async () => {
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Speed Demon/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders bio in dark mode', async () => {
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('A test bio')).toBeInTheDocument();
    });
  });

  it('renders recent replays in dark mode', async () => {
    render(<PublicProfileScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/FizzBuzz/).length).toBeGreaterThanOrEqual(1);
    });
  });
});
