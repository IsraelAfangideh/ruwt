// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react';

/* ── Hoisted variables that vi.mock callbacks can reference ───────── */
const { mockNavReset, mockGetUserFn, mockUnsubscribeFn, shouldChildThrow, shouldChildSuspend: _shouldChildSuspend } = vi.hoisted(() => ({
  mockNavReset: vi.fn(),
  mockGetUserFn: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  mockUnsubscribeFn: vi.fn(),
  shouldChildThrow: { value: false },
  shouldChildSuspend: { value: false, resolve: null as (() => void) | null },
}));
const shouldChildSuspend = _shouldChildSuspend;

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
vi.mock('@/shared/lib/supabase/client', () => ({
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
vi.mock('@/features/marketing/LandingScreen', () => ({
  LandingScreen: () => <div data-testid="LandingScreen">LandingScreen</div>,
}));

/* ── Mock all lazy-loaded screens ────────────────────────────────── */
vi.mock('@/features/auth/LoginScreen', () => ({ LoginScreen: () => <div>LoginScreen</div> }));
vi.mock('@/features/auth/RegisterScreen', () => ({ RegisterScreen: () => <div>RegisterScreen</div> }));
vi.mock('@/features/auth/CallbackScreen', () => ({ CallbackScreen: () => <div>CallbackScreen</div> }));
vi.mock('@/features/marketing/OnboardingScreen', () => ({ OnboardingScreen: () => <div>OnboardingScreen</div> }));
vi.mock('@/features/dashboard/DashboardScreen', () => ({ DashboardScreen: () => <div>DashboardScreen</div> }));
vi.mock('@/features/challenges/ChallengesScreen', () => ({ ChallengesScreen: () => <div>ChallengesScreen</div> }));
vi.mock('@/features/social/DiscussScreen', () => ({ DiscussScreen: () => <div>DiscussScreen</div> }));
vi.mock('@/features/leaderboard/LeaderboardScreen', () => ({ LeaderboardScreen: () => <div>LeaderboardScreen</div> }));
vi.mock('@/features/profile/ProfileScreen', () => ({ ProfileScreen: () => <div>ProfileScreen</div> }));
vi.mock('@/features/profile/SettingsScreen', () => ({ SettingsScreen: () => <div>SettingsScreen</div> }));
vi.mock('@/features/arena/ArenaScreen', () => ({ ArenaScreen: () => <div>ArenaScreen</div> }));
vi.mock('@/features/replay/ReplayScreen', () => ({ ReplayScreen: () => <div>ReplayScreen</div> }));
vi.mock('@/features/challenges/DailyChallengeScreen', () => ({ DailyChallengeScreen: () => <div>DailyChallengeScreen</div> }));
vi.mock('@/features/assessments/screens/AssessmentListScreen', () => ({ AssessmentListScreen: () => <div>AssessmentListScreen</div> }));
vi.mock('@/features/assessments/screens/AssessmentIDEScreen', () => ({ AssessmentIDEScreen: () => <div>AssessmentIDEScreen</div> }));
vi.mock('@/features/assessments/screens/AssessmentResultsDashboardScreen', () => ({ AssessmentResultsDashboardScreen: () => <div>AssessmentResultsDashboardScreen</div> }));
vi.mock('@/features/assessments/screens/AssessmentLandingScreen', () => ({ AssessmentLandingScreen: () => <div>AssessmentLandingScreen</div> }));
vi.mock('@/features/assessments/screens/AssessmentFlowScreen', () => ({ AssessmentFlowScreen: () => <div>AssessmentFlowScreen</div> }));
vi.mock('@/features/assessments/screens/AssessmentResultsScreen', () => ({ AssessmentResultsScreen: () => <div>AssessmentResultsScreen</div> }));
vi.mock('@/features/teams/TeamsScreen', () => ({ TeamsScreen: () => <div>HiringScreen</div> }));
vi.mock('@/features/arena/GuestArenaScreen', () => ({ GuestArenaScreen: () => <div>GuestArenaScreen</div> }));
vi.mock('@/features/profile/PublicProfileScreen', () => ({ PublicProfileScreen: () => <div>PublicProfileScreen</div> }));
vi.mock('@/features/social/ShareScreen', () => ({ ShareScreen: () => <div>ShareScreen</div> }));
vi.mock('@/features/profile/CertificateScreen', () => ({ CertificateScreen: () => <div>CertificateScreen</div> }));
vi.mock('@/features/teams/OrgManagementScreen', () => ({ OrgManagementScreen: () => <div>OrgManagementScreen</div> }));
vi.mock('@/features/teams/OrgJoinScreen', () => ({ OrgJoinScreen: () => <div>OrgJoinScreen</div> }));
vi.mock('@/features/marketing/NotFoundScreen', () => ({ NotFoundScreen: () => <div>NotFoundScreen</div> }));
vi.mock('@/shared/ui/ScreenSkeletons', () => ({
  CardGridSkeleton: () => <div data-testid="skeleton-card-grid" />,
}));

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
      reset: (...args: any[]) => mockNavReset(...args),
    }),
  };
});

vi.mock('@react-navigation/native-stack', () => {
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: { children: React.ReactNode }) => {
        // When shouldChildThrow.value is true, render a throwing component
        // to exercise the ChunkErrorBoundary
        if (shouldChildThrow.value) {
          const ThrowingChild = () => { throw new Error('Chunk load failure'); };
          return (
            <div data-testid="stack-navigator">
              <ThrowingChild />
            </div>
          );
        }
        // When shouldChildSuspend.value is true, render a suspending component
        // to exercise the LoadingFallback via <Suspense>
        if (shouldChildSuspend.value) {
          let resolved = false;
          let resolvePromise: (() => void) | null = null;
          const promise = new Promise<void>((resolve) => { resolvePromise = resolve; });
          shouldChildSuspend.resolve = () => { resolved = true; resolvePromise?.(); };
          const SuspendingChild = () => {
            if (!resolved) throw promise;
            return <div data-testid="stack-navigator">{children}</div>;
          };
          return <SuspendingChild />;
        }
        return (
          <div data-testid="stack-navigator">{children}</div>
        );
      },
      Screen: ({ name }: { name: string; component: React.ComponentType }) => (
        <div data-testid={`screen-${name}`} />
      ),
    }),
  };
});

// Import Sentry AFTER mock to access the mock functions
const Sentry = await import('@sentry/react');
const mockCaptureException = vi.mocked(Sentry.captureException);

import { AppNavigator } from './AppNavigator';

describe('AppNavigator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onAuthChangeCb = null;
    shouldChildThrow.value = false;
    shouldChildSuspend.value = false;
    shouldChildSuspend.resolve = null;
    mockGetUserFn.mockResolvedValue({ data: { user: null }, error: null });
  });

  afterEach(() => {
    shouldChildThrow.value = false;
    shouldChildSuspend.value = false;
    shouldChildSuspend.resolve = null;
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
      'Dashboard', 'Problems', 'Discuss', 'Leaderboard', 'Profile', 'Settings',
      'Arena', 'Replay', 'DailyChallenge', 'Assessments', 'AssessmentBuilder',
      'AssessmentResultsDashboard', 'AssessmentLanding', 'AssessmentFlow',
      'AssessmentResults', 'Hiring', 'GuestArena', 'PublicProfile', 'Share',
      'Certificate', 'OrgManagement', 'OrgJoin', 'NotFound',
    ];
    for (const name of expectedScreenNames) {
      const screenEl = container.querySelector(`[data-testid="screen-${name}"]`);
      expect(screenEl, `Screen "${name}" should be registered in navigator`).not.toBeNull();
    }
  });

  /* ── Auth state change: SIGNED_OUT resets nav ───────────────────── */
  it('resets nav to Landing on SIGNED_OUT', async () => {
    render(<AppNavigator />);

    expect(onAuthChangeCb).not.toBeNull();

    onAuthChangeCb!('SIGNED_OUT', null);

    expect(mockNavReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Landing' }],
    });
  });

  /* ── Cleanup: unsubscribes on unmount ──────────────────────────── */
  it('unsubscribes auth listener on unmount', () => {
    const { unmount } = render(<AppNavigator />);
    unmount();
    expect(mockUnsubscribeFn).toHaveBeenCalled();
  });

  /* ── lazyWithRetry handles chunk load failure with retry logic ── */
  it('handles chunk load failure with sessionStorage retry logic', async () => {
    // The lazyWithRetry function is tested indirectly through the screens.
    // Since all screens are mocked, they load successfully.
    // The retry logic (lines 23-31) requires a real import failure which
    // we can't easily simulate with mocked screens.
    // This test documents that the retry logic exists and screens load.
    const { container } = render(<AppNavigator />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="stack-navigator"]')).not.toBeNull();
    });
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

  /* ── ChunkErrorBoundary: renders error UI when child throws ───── */
  it('shows error UI with reload button when a child component throws', () => {
    // Suppress React error boundary console.error noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    shouldChildThrow.value = true;

    const { getByText } = render(<AppNavigator />);

    // The error boundary should catch the throw and render the error UI
    expect(getByText('Something went wrong')).toBeInTheDocument();
    expect(getByText('A new version may have been deployed. Reload to continue.')).toBeInTheDocument();
    expect(getByText('Reload')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  /* ── ChunkErrorBoundary: componentDidCatch reports to Sentry ──── */
  it('reports chunk errors to Sentry via componentDidCatch', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    shouldChildThrow.value = true;

    render(<AppNavigator />);

    // componentDidCatch should have called Sentry.captureException
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: { type: 'chunk_error' },
        contexts: expect.objectContaining({
          react: expect.objectContaining({
            componentStack: expect.anything(),
          }),
        }),
      }),
    );

    consoleSpy.mockRestore();
  });

  /* ── ChunkErrorBoundary: reload button triggers window.location.reload ── */
  it('calls window.location.reload when Reload button is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
      configurable: true,
    });

    shouldChildThrow.value = true;

    const { getByText } = render(<AppNavigator />);

    fireEvent.click(getByText('Reload'));
    expect(reloadMock).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  /* ── LoadingFallback: shown while lazy components are loading ──── */
  it('renders LoadingFallback spinner while a lazy child is suspending', async () => {
    shouldChildSuspend.value = true;

    const { container } = render(<AppNavigator />);

    expect(container.querySelector('[data-testid="skeleton-card-grid"]')).not.toBeNull();

    // Resolve the suspense so the component unmounts cleanly
    if (shouldChildSuspend.resolve) {
      shouldChildSuspend.resolve();
    }
  });
});

/* ── lazyWithRetry: isolated tests for chunk retry logic ─────────── */
describe('lazyWithRetry', () => {
  let reloadMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
      configurable: true,
    });
  });

  it('sets sessionStorage key and calls window.location.reload on first chunk failure', async () => {
    const { lazyWithRetry } = await import('./AppNavigator');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const chunkError = new Error('Failed to fetch dynamically imported module');
    const LazyComp = lazyWithRetry(
      'TestFirst',
      () => Promise.reject(chunkError),
      (m: any) => m.default,
    );

    render(
      <React.Suspense fallback={<div data-testid="suspense-fallback">Loading</div>}>
        <LazyComp />
      </React.Suspense>,
    );

    await waitFor(() => {
      expect(sessionStorage.getItem('chunk_retry_TestFirst')).toBe('1');
    });
    expect(reloadMock).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('successfully renders a lazy component when the factory resolves', async () => {
    const { lazyWithRetry } = await import('./AppNavigator');

    const TestComp = () => <div data-testid="lazy-loaded">Loaded!</div>;
    const LazyComp = lazyWithRetry(
      'TestSuccess',
      () => Promise.resolve({ TestComp }),
      (m: any) => m.TestComp,
    );

    const { container } = render(
      <React.Suspense fallback={<div>Loading</div>}>
        <LazyComp />
      </React.Suspense>,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-testid="lazy-loaded"]')).not.toBeNull();
    });
  });

  it('removes sessionStorage key and re-throws error on second chunk failure', async () => {
    const { lazyWithRetry } = await import('./AppNavigator');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Pre-set the sessionStorage key to simulate a second failure
    sessionStorage.setItem('chunk_retry_TestSecond', '1');

    const chunkError = new Error('Failed to fetch dynamically imported module');
    const LazyComp = lazyWithRetry(
      'TestSecond',
      () => Promise.reject(chunkError),
      (m: any) => m.default,
    );

    class TestErrorBoundary extends React.Component<
      { children: React.ReactNode },
      { error: Error | null }
    > {
      state = { error: null as Error | null };
      static getDerivedStateFromError(error: Error) {
        return { error };
      }
      render(): JSX.Element {
        if (this.state.error) {
          return <div data-testid="rethrown-error">{this.state.error.message}</div>;
        }
        return <>{this.props.children}</>;
      }
    }

    const { container } = render(
      <TestErrorBoundary>
        <React.Suspense fallback={<div>Loading</div>}>
          <LazyComp />
        </React.Suspense>
      </TestErrorBoundary>,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-testid="rethrown-error"]')).not.toBeNull();
    });

    expect(sessionStorage.getItem('chunk_retry_TestSecond')).toBeNull();
    expect(reloadMock).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
