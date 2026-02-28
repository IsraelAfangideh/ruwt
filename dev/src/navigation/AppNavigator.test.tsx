// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

/* ── Hoisted variables that vi.mock callbacks can reference ───────── */
const { mockNavReset, mockGetUserFn, mockUnsubscribeFn } = vi.hoisted(() => ({
  mockNavReset: vi.fn(),
  mockGetUserFn: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  mockUnsubscribeFn: vi.fn(),
}));

let onAuthChangeCb: ((event: string, session: any) => void) | null = null;

/* ── Mock Sentry ─────────────────────────────────────────────────── */
vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  setUser: vi.fn(),
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/* ── Mock react-native ───────────────────────────────────────────── */
vi.mock('react-native', async () => {
  const actual = await vi.importActual<typeof import('react-native')>('react-native');
  return {
    ...actual,
    useColorScheme: () => 'light',
  };
});

/* ── Controllable supabase mock ──────────────────────────────────── */
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: (...args: any[]) => mockGetUserFn(...args),
      onAuthStateChange: vi.fn((cb: any) => {
        onAuthChangeCb = cb;
        return {
          data: { subscription: { unsubscribe: mockUnsubscribeFn } },
        };
      }),
    },
  }),
}));

/* ── Mock eagerly loaded LandingScreen ───────────────────────────── */
vi.mock('@/screens/LandingScreen', () => ({
  LandingScreen: () => <div data-testid="LandingScreen">LandingScreen</div>,
}));

/* ── Mock all lazy-loaded screens ────────────────────────────────── */
vi.mock('@/screens/LoginScreen', () => ({ LoginScreen: () => <div>LoginScreen</div> }));
vi.mock('@/screens/RegisterScreen', () => ({ RegisterScreen: () => <div>RegisterScreen</div> }));
vi.mock('@/screens/CallbackScreen', () => ({ CallbackScreen: () => <div>CallbackScreen</div> }));
vi.mock('@/screens/OnboardingScreen', () => ({ OnboardingScreen: () => <div>OnboardingScreen</div> }));
vi.mock('@/screens/DashboardScreen', () => ({ DashboardScreen: () => <div>DashboardScreen</div> }));
vi.mock('@/screens/ChallengesScreen', () => ({ ChallengesScreen: () => <div>ChallengesScreen</div> }));
vi.mock('@/screens/LeaderboardScreen', () => ({ LeaderboardScreen: () => <div>LeaderboardScreen</div> }));
vi.mock('@/screens/ProfileScreen', () => ({ ProfileScreen: () => <div>ProfileScreen</div> }));
vi.mock('@/screens/SettingsScreen', () => ({ SettingsScreen: () => <div>SettingsScreen</div> }));
vi.mock('@/screens/ArenaScreen', () => ({ ArenaScreen: () => <div>ArenaScreen</div> }));
vi.mock('@/screens/ReplayScreen', () => ({ ReplayScreen: () => <div>ReplayScreen</div> }));
vi.mock('@/screens/DailyChallengeScreen', () => ({ DailyChallengeScreen: () => <div>DailyChallengeScreen</div> }));
vi.mock('@/screens/AssessmentListScreen', () => ({ AssessmentListScreen: () => <div>AssessmentListScreen</div> }));
vi.mock('@/screens/AssessmentBuilderScreen', () => ({ AssessmentBuilderScreen: () => <div>AssessmentBuilderScreen</div> }));
vi.mock('@/screens/AssessmentResultsDashboardScreen', () => ({ AssessmentResultsDashboardScreen: () => <div>AssessmentResultsDashboardScreen</div> }));
vi.mock('@/screens/AssessmentLandingScreen', () => ({ AssessmentLandingScreen: () => <div>AssessmentLandingScreen</div> }));
vi.mock('@/screens/AssessmentFlowScreen', () => ({ AssessmentFlowScreen: () => <div>AssessmentFlowScreen</div> }));
vi.mock('@/screens/AssessmentResultsScreen', () => ({ AssessmentResultsScreen: () => <div>AssessmentResultsScreen</div> }));
vi.mock('@/screens/TeamsScreen', () => ({ TeamsScreen: () => <div>TeamsScreen</div> }));
vi.mock('@/screens/GuestArenaScreen', () => ({ GuestArenaScreen: () => <div>GuestArenaScreen</div> }));
vi.mock('@/screens/PublicProfileScreen', () => ({ PublicProfileScreen: () => <div>PublicProfileScreen</div> }));
vi.mock('@/screens/ShareScreen', () => ({ ShareScreen: () => <div>ShareScreen</div> }));
vi.mock('@/screens/CertificateScreen', () => ({ CertificateScreen: () => <div>CertificateScreen</div> }));
vi.mock('@/screens/OrgManagementScreen', () => ({ OrgManagementScreen: () => <div>OrgManagementScreen</div> }));
vi.mock('@/screens/OrgJoinScreen', () => ({ OrgJoinScreen: () => <div>OrgJoinScreen</div> }));
vi.mock('@/screens/NotFoundScreen', () => ({ NotFoundScreen: () => <div>NotFoundScreen</div> }));

/* ── Mock @react-navigation ──────────────────────────────────────── */
vi.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    NavigationContainer: ({ children, onReady, onStateChange }: { children: React.ReactNode; onReady?: () => void; onStateChange?: () => void }) => {
      React.useEffect(() => { onReady?.(); }, []);
      // Call onStateChange once after mount to trigger focus logic
      React.useEffect(() => {
        if (onStateChange) {
          setTimeout(() => onStateChange(), 0);
        }
      }, []);
      return <div>{children}</div>;
    },
    createNavigationContainerRef: () => ({
      isReady: () => true,
      reset: mockNavReset,
    }),
  };
});

vi.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="stack-navigator">{children}</div>
      ),
      Screen: ({ name }: { name: string; component: React.ComponentType }) => (
        <div data-testid={`screen-${name}`} />
      ),
    }),
  };
});

// Import Sentry AFTER mock to access the mock functions
const Sentry = await import('@sentry/react');
const mockSetUser = vi.mocked(Sentry.setUser);

import { AppNavigator } from './AppNavigator';

describe('AppNavigator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onAuthChangeCb = null;
    mockGetUserFn.mockResolvedValue({ data: { user: null }, error: null });
  });

  it('renders without crashing', () => {
    const { container } = render(<AppNavigator />);
    expect(container).toBeDefined();
  });

  it('renders the stack navigator', () => {
    const { container } = render(<AppNavigator />);
    const navigator = container.querySelector('[data-testid="stack-navigator"]');
    expect(navigator).not.toBeNull();
  });

  it('registers all expected screen routes', () => {
    const { container } = render(<AppNavigator />);
    const expectedScreenNames = [
      'Landing', 'Login', 'Register', 'Callback', 'Onboarding',
      'Dashboard', 'Challenges', 'Leaderboard', 'Profile', 'Settings',
      'Arena', 'Replay', 'DailyChallenge', 'Assessments', 'AssessmentBuilder',
      'AssessmentResultsDashboard', 'AssessmentLanding', 'AssessmentFlow',
      'AssessmentResults', 'Teams', 'GuestArena', 'PublicProfile', 'Share',
      'Certificate', 'OrgManagement', 'OrgJoin', 'NotFound',
    ];
    for (const name of expectedScreenNames) {
      const screenEl = container.querySelector(`[data-testid="screen-${name}"]`);
      expect(screenEl, `Screen "${name}" should be registered in navigator`).not.toBeNull();
    }
  });

  /* ── Sentry user identification on mount ───────────────────────── */
  it('sets Sentry user when getUser returns a user', async () => {
    mockGetUserFn.mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'user@test.com' } },
      error: null,
    });

    render(<AppNavigator />);

    await waitFor(() => {
      expect(mockSetUser).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'user@test.com',
      });
    });
  });

  it('does not set Sentry user when getUser returns null', async () => {
    mockGetUserFn.mockResolvedValueOnce({ data: { user: null }, error: null });

    render(<AppNavigator />);

    await waitFor(() => {
      expect(mockGetUserFn).toHaveBeenCalled();
    });

    expect(mockSetUser).not.toHaveBeenCalled();
  });

  /* ── Auth state change: SIGNED_IN sets Sentry user ─────────────── */
  it('sets Sentry user on SIGNED_IN auth state change', async () => {
    render(<AppNavigator />);

    expect(onAuthChangeCb).not.toBeNull();

    onAuthChangeCb!('SIGNED_IN', {
      user: { id: 'user-456', email: 'new@test.com' },
    });

    expect(mockSetUser).toHaveBeenCalledWith({
      id: 'user-456',
      email: 'new@test.com',
    });
  });

  /* ── Auth state change: SIGNED_OUT clears Sentry and resets nav ── */
  it('clears Sentry user and resets nav on SIGNED_OUT', async () => {
    render(<AppNavigator />);

    expect(onAuthChangeCb).not.toBeNull();

    onAuthChangeCb!('SIGNED_OUT', null);

    expect(mockSetUser).toHaveBeenCalledWith(null);
    expect(mockNavReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Landing' }],
    });
  });

  /* ── Handles email being undefined ─────────────────────────────── */
  it('sets Sentry user with undefined email when email is null', async () => {
    mockGetUserFn.mockResolvedValueOnce({
      data: { user: { id: 'user-789', email: null } },
      error: null,
    });

    render(<AppNavigator />);

    await waitFor(() => {
      expect(mockSetUser).toHaveBeenCalledWith({
        id: 'user-789',
        email: undefined,
      });
    });
  });

  /* ── Cleanup: unsubscribes on unmount ──────────────────────────── */
  it('unsubscribes auth listener on unmount', () => {
    const { unmount } = render(<AppNavigator />);
    unmount();
    expect(mockUnsubscribeFn).toHaveBeenCalled();
  });

  /* ── onStateChange focuses #main-content ─────────────────────── */
  it('focuses #main-content element on navigation state change', async () => {
    // Create a #main-content element in the DOM
    const mainContent = document.createElement('div');
    mainContent.id = 'main-content';
    mainContent.tabIndex = -1;
    document.body.appendChild(mainContent);
    const focusSpy = vi.spyOn(mainContent, 'focus');

    render(<AppNavigator />);

    // The NavigationContainer mock calls onStateChange via setTimeout(0)
    await waitFor(() => {
      expect(focusSpy).toHaveBeenCalled();
    });

    document.body.removeChild(mainContent);
    focusSpy.mockRestore();
  });
});
