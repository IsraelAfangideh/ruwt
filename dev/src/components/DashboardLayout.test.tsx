// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardLayout } from './DashboardLayout';

const mockNavigate = vi.fn();
const mockNavigateReset = vi.fn();

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockNavigateReset }),
  useRoute: () => ({ name: 'Dashboard' }),
}));

vi.mock('@/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962',
    border: '#ccc', borderStrong: '#aaa', primary: '#000',
    primaryForeground: '#fff', secondary: '#eee', secondaryForeground: '#333',
    muted: '#ddd', card: '#fff', error: '#f00', accentBg: '#fef8e8', textSubtle: '#aaa',
    mutedForeground: '#555', destructive: '#b06060',
  }),
  useTheme: () => ({
    mode: 'light',
    setMode: vi.fn(),
    colors: {
      bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962',
      border: '#ccc', borderStrong: '#aaa', primary: '#000',
      primaryForeground: '#fff', secondary: '#eee', secondaryForeground: '#333',
      muted: '#ddd', card: '#fff', error: '#f00', accentBg: '#fef8e8', textSubtle: '#aaa',
    },
    isDark: false,
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

// Default mock for AppModeContext — individual, practice mode
const mockSetMode = vi.fn();
let mockAppMode: any = {
  mode: 'practice',
  setMode: mockSetMode,
  profile: { accountType: 'individual', trial: null, subscriptionStatus: 'none' },
  profileLoading: false,
  orgInfo: null,
  isOrgMember: false,
  canAccessHiringMode: false,
  refreshProfile: vi.fn(),
};

vi.mock('@/lib/AppModeContext', () => ({
  useAppMode: () => mockAppMode,
}));

const createMockSlice = (data: any = null) => ({ data, status: 'loaded', lastFetchedAt: Date.now() });

let mockDashboardData: any = {
  initialLoadComplete: true,
  state: {
    challenges: createMockSlice([]),
    dailyChallenge: createMockSlice(null),
    leaderboard: createMockSlice([]),
    seasons: createMockSlice([]),
    dashboard: createMockSlice(null),
    badges: createMockSlice({ catalog: [], earned: [] }),
    bookmarks: createMockSlice([]),
    activity: createMockSlice([]),
    notifications: createMockSlice({ unreadCount: 0 }),
  },
  refreshEndpoint: vi.fn(),
  refreshAll: vi.fn(),
};

vi.mock('@/lib/DashboardDataContext', () => ({
  useDashboardData: () => mockDashboardData,
}));

const mockUser = {
  id: 'user-1',
  email: 'test@ruwt.dev',
  user_metadata: { name: 'Test User', avatar_url: null },
} as any;

describe('DashboardLayout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAppMode = {
      mode: 'practice',
      setMode: mockSetMode,
      profile: { accountType: 'individual', trial: null, subscriptionStatus: 'none' },
      profileLoading: false,
      orgInfo: null,
      isOrgMember: false,
      canAccessHiringMode: false,
      refreshProfile: vi.fn(),
    };
    mockDashboardData = {
      initialLoadComplete: true,
      state: {
        challenges: createMockSlice([]),
        dailyChallenge: createMockSlice(null),
        leaderboard: createMockSlice([]),
        seasons: createMockSlice([]),
        dashboard: createMockSlice(null),
        badges: createMockSlice({ catalog: [], earned: [] }),
        bookmarks: createMockSlice([]),
        activity: createMockSlice([]),
        notifications: createMockSlice({ unreadCount: 0 }),
      },
      refreshEndpoint: vi.fn(),
      refreshAll: vi.fn(),
    };
  });

  it('renders children content', () => {
    render(
      <DashboardLayout user={mockUser}>
        <span>Dashboard Content</span>
      </DashboardLayout>
    );
    expect(screen.getByText('Dashboard Content')).toBeTruthy();
  });

  it('renders the Ruwt.dev logo', () => {
    render(
      <DashboardLayout user={mockUser}>
        <span>Content</span>
      </DashboardLayout>
    );
    expect(screen.getByText('R')).toBeTruthy();
    expect(screen.getByText('.dev')).toBeTruthy();
  });

  it('renders navigation items', () => {
    render(
      <DashboardLayout user={mockUser}>
        <span>Content</span>
      </DashboardLayout>
    );
    expect(screen.getByText('Problems')).toBeTruthy();
    expect(screen.getByText('Discuss')).toBeTruthy();
  });

  it('navigates to Problems when logo is clicked', () => {
    const { container } = render(
      <DashboardLayout user={mockUser}>
        <span>Content</span>
      </DashboardLayout>
    );
    const logoLink = container.querySelector('[accessibilitylabel="Ruwt – go to problems"]') ||
                     container.querySelector('[aria-label="Ruwt – go to problems"]');
    expect(logoLink).not.toBeNull();
    fireEvent.click(logoLink!);
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  it('renders with null profile (loading fallback)', () => {
    mockAppMode = {
      ...mockAppMode,
      profile: null as any,
      profileLoading: true,
    };

    render(
      <DashboardLayout user={mockUser}>
        <span>Content</span>
      </DashboardLayout>
    );
    expect(screen.getByText('Content')).toBeTruthy();
  });

  /* ── Org gating tests ───────────────────────────────────────── */

  it('shows gate UI when requireOrg is true and user is not org member', () => {
    render(
      <DashboardLayout user={mockUser} requireOrg>
        <span>Protected Content</span>
      </DashboardLayout>
    );

    expect(screen.getByText('Team Account Required')).toBeTruthy();
    expect(screen.queryByText('Protected Content')).toBeNull();
    expect(screen.getByText('Upgrade to Teams')).toBeTruthy();
  });

  it('renders children when requireOrg is true and user is org member', () => {
    mockAppMode = {
      ...mockAppMode,
      isOrgMember: true,
      orgInfo: { id: 'org-1', name: 'Test Org', role: 'admin', subscriptionStatus: 'active', subscriptionPlan: 'monthly', subscriptionEndsAt: null, trial: null },
      profile: { ...mockAppMode.profile, accountType: 'team' } as any,
    };

    render(
      <DashboardLayout user={mockUser} requireOrg>
        <span>Protected Content</span>
      </DashboardLayout>
    );

    expect(screen.getByText('Protected Content')).toBeTruthy();
    expect(screen.queryByText('Team Account Required')).toBeNull();
  });

  it('shows loading spinner when requireOrg and profile is loading', () => {
    mockAppMode = { ...mockAppMode, profileLoading: true };

    const { container } = render(
      <DashboardLayout user={mockUser} requireOrg>
        <span>Protected Content</span>
      </DashboardLayout>
    );

    expect(screen.queryByText('Protected Content')).toBeNull();
    // ActivityIndicator renders a div with role="progressbar"
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('navigates to Hiring when Upgrade to Teams is clicked', () => {
    render(
      <DashboardLayout user={mockUser} requireOrg>
        <span>Protected Content</span>
      </DashboardLayout>
    );

    fireEvent.click(screen.getByText('Upgrade to Teams'));
    expect(mockNavigate).toHaveBeenCalledWith('Hiring');
  });

  it('renders children without gating when requireOrg is false', () => {
    render(
      <DashboardLayout user={mockUser}>
        <span>Open Content</span>
      </DashboardLayout>
    );

    expect(screen.getByText('Open Content')).toBeTruthy();
    expect(screen.queryByText('Team Account Required')).toBeNull();
  });

  /* ── Content skeleton tests ──────────────────────────────── */

  it('shows content skeleton when initial load is not complete', () => {
    mockDashboardData = { ...mockDashboardData, initialLoadComplete: false };

    const { container } = render(
      <DashboardLayout user={mockUser}>
        <span>Dashboard Content</span>
      </DashboardLayout>
    );

    // Children should NOT be rendered while loading
    expect(screen.queryByText('Dashboard Content')).toBeNull();
    // Skeleton blocks should be present (aria-hidden divs)
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders children once initial load completes', () => {
    mockDashboardData = { ...mockDashboardData, initialLoadComplete: true };

    render(
      <DashboardLayout user={mockUser}>
        <span>Dashboard Content</span>
      </DashboardLayout>
    );

    expect(screen.getByText('Dashboard Content')).toBeTruthy();
  });

  it('does not show content skeleton for requireOrg pages during prefetch', () => {
    mockDashboardData = { ...mockDashboardData, initialLoadComplete: false };
    mockAppMode = { ...mockAppMode, profileLoading: true };

    const { container } = render(
      <DashboardLayout user={mockUser} requireOrg>
        <span>Org Content</span>
      </DashboardLayout>
    );

    // requireOrg + profileLoading should show ActivityIndicator, not skeleton
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('always renders header and nav even during initial load', () => {
    mockDashboardData = { ...mockDashboardData, initialLoadComplete: false };

    render(
      <DashboardLayout user={mockUser}>
        <span>Content</span>
      </DashboardLayout>
    );

    // Header elements should always be visible
    expect(screen.getByText('R')).toBeTruthy();
    expect(screen.getByText('.dev')).toBeTruthy();
    expect(screen.getByText('Problems')).toBeTruthy();
  });

  it('shows trial banner for team accounts with trial', () => {
    mockAppMode = {
      ...mockAppMode,
      isOrgMember: true,
      orgInfo: { id: 'org-1', name: 'Test Org', role: 'admin', subscriptionStatus: 'none', subscriptionPlan: null, subscriptionEndsAt: null, trial: { isActive: true, daysRemaining: 20, assessmentsUsed: 0, assessmentsLimit: 1, invitesUsed: 0, invitesLimit: 3 } },
      profile: { ...mockAppMode.profile, accountType: 'team', trial: { isActive: true, daysRemaining: 20, assessmentsUsed: 0, assessmentsLimit: 1, invitesUsed: 0, invitesLimit: 3 }, subscriptionStatus: 'none' } as any,
    };

    render(
      <DashboardLayout user={mockUser}>
        <span>Content</span>
      </DashboardLayout>
    );

    expect(screen.getByTestId('trial-banner')).toBeTruthy();
  });
});
