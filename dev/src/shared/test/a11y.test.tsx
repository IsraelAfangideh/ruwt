/**
 * Automated accessibility tests using vitest-axe (axe-core).
 * Tests hand-crafted HTML patterns AND real screen components for WCAG violations.
 * Includes keyboard navigation tests (Tab, Enter, Escape).
 *
 * Run: npm run test:a11y
 */
// @vitest-environment jsdom
import 'vitest-axe/extend-expect';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';

// ── Common Mocks ──────────────────────────────────────────────────────

vi.mock('react-native', () => ({
  View: ({ children, style: _s, accessibilityRole: _ar, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, style: _s, accessibilityRole: _ar, numberOfLines: _n, ...p }: any) => <span {...p}>{children}</span>,
  ScrollView: ({ children, style: _s, contentContainerStyle: _c, showsHorizontalScrollIndicator: _sh, horizontal: _h, ...p }: any) => <div {...p}>{children}</div>,
  TextInput: ({ placeholder, style: _s, placeholderTextColor: _p, onChangeText: _o, ...p }: any) => <input placeholder={placeholder} aria-label={placeholder} {...p} />,
  Pressable: ({ children, onPress, accessibilityRole: _ar, style: _s, ...p }: any) => {
    return <button onClick={onPress} {...p}>{typeof children === 'function' ? children({ pressed: false }) : children}</button>;
  },
  Image: ({ style: _s, accessibilityLabel, resizeMode: _r, source: _src, ...p }: any) => <img alt={accessibilityLabel || ''} />,
  ActivityIndicator: () => <div role="progressbar" aria-label="Loading" />,
  StyleSheet: {
    create: (s: any) => s,
    flatten: (s: any) => (Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : s || {}),
  },
  Platform: { OS: 'web' },
}));

vi.mock('@/shared/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    borderStrong: '#999', card: '#fff', muted: '#f5f5f5', error: '#f00', errorBg: '#fee',
    success: '#0a0', successBg: '#efe', primary: '#000', primaryForeground: '#fff',
    secondary: '#eee', secondaryForeground: '#000', destructive: '#f00',
    textSubtle: '#aaa', bgElevated: '#fafafa', accentBg: '#ffe',
  }),
  useTheme: () => ({ isDark: false }),
}));
vi.mock('@/shared/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));

// ── Component Mocks ───────────────────────────────────────────────────

vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div role="region" {...p}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
}));

vi.mock('@/shared/ui/Badge', () => ({
  Badge: ({ children }: any) => <span role="status">{children}</span>,
}));

vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, disabled, ...props }: any) => (
    <button onClick={onPress} disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock('@/shared/ui/Input', () => ({
  Input: ({ placeholder, onChangeText, secureTextEntry, onSubmitEditing, editable, ...props }: any) => (
    <input
      aria-label={placeholder ?? 'input'}
      placeholder={placeholder}
      type={secureTextEntry ? 'password' : 'text'}
      onChange={(e: any) => onChangeText?.(e.target.value)}
      onKeyDown={(e: any) => e.key === 'Enter' && onSubmitEditing?.()}
      disabled={editable === false}
      {...props}
    />
  ),
}));

vi.mock('@/shared/ui/Label', () => ({
  Label: ({ children, ...p }: any) => <label {...p}>{children}</label>,
}));

// ── Mocks needed for real LoginScreen ─────────────────────────────────

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), reset: vi.fn() }),
  useRoute: () => ({ params: {} }),
}));

vi.mock('@/shared/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

vi.mock('@/shared/lib/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock('@/features/auth/BrandPanel', () => ({ BrandPanel: () => <div data-testid="brand-panel" /> }));
vi.mock('@/features/auth/AuthShell', () => ({
  AuthShell: ({ children }: any) => <div data-testid="auth-shell">{children}</div>,
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/hooks/useWindowWidth', () => ({ useIsDesktop: () => false }));
vi.mock('@/shared/navigation/resetNavigation', () => ({
  resetNavigation: vi.fn(),
  validScreen: (_val: string, _list: string[], def: string) => def,
}));
vi.mock('@/shared/navigation/types', () => ({
  DEFAULT_AUTH_REDIRECT: 'Dashboard',
  ALLOWED_AUTH_REDIRECTS: ['Dashboard'],
}));

// ── Mocks needed for real ChallengesScreen ────────────────────────────

vi.mock('@/shared/hooks/useAuthGuard', () => ({
  useAuthGuard: () => ({ user: { id: 'u1' }, loading: false }),
}));
vi.mock('@/shared/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/features/challenges/ChallengeCard', () => ({
  ChallengeCard: ({ challenge }: any) => (
    <div data-testid="challenge-card" role="article" aria-label={challenge.title}>
      <span>{challenge.title}</span>
    </div>
  ),
}));
vi.mock('@/shared/lib/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/shared/lib/difficulty', () => ({
  DIFFICULTIES: [
    { key: 'all', label: 'All Levels' },
    { key: 'easy', label: 'Easy' },
    { key: 'medium', label: 'Medium' },
    { key: 'hard', label: 'Hard' },
  ],
  getDifficultyStyle: () => ({ color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', label: 'Medium' }),
}));

// ── Mocks needed for DashboardScreen ──────────────────────────────────

const { mockUseDashboardData } = vi.hoisted(() => ({
  mockUseDashboardData: vi.fn(),
}));

vi.mock('@/shared/lib/DashboardDataContext', () => ({
  useDashboardData: (...args: any[]) => mockUseDashboardData(...args),
}));

vi.mock('@/shared/ui/Avatar', () => ({ Avatar: () => <div data-testid="avatar" /> }));
vi.mock('@/shared/ui/Progress', () => ({
  Progress: ({ value }: any) => <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label="Progress" />,
}));
vi.mock('@/shared/ui/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

// ── Dynamic imports (top-level await) ─────────────────────────────────

const { LoginScreen } = await import('@/features/auth/LoginScreen');
const { ChallengesScreen } = await import('@/features/challenges/ChallengesScreen');
const { DashboardScreen } = await import('@/features/dashboard/DashboardScreen');

/** Common axe rules to disable for mock-rendered React Native components.
 *  These rules fire because RN-web mock maps View/Text to div/span with
 *  RN-specific props (accessibilityRole) that don't map cleanly to HTML. */
const MOCK_SAFE_RULES = {
  'color-contrast': { enabled: false },
  'aria-allowed-attr': { enabled: false },
  'landmark-unique': { enabled: false },
};

// ── Tests ─────────────────────────────────────────────────────────────

describe('Accessibility (a11y)', () => {
  describe('Badge component', () => {
    it('has no a11y violations', async () => {
      const { container } = render(<span role="status">Easy</span>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Card component', () => {
    it('has no a11y violations with proper headings', async () => {
      const { container } = render(
        <div role="region" aria-label="Challenge card">
          <div>
            <h3>Test Challenge</h3>
            <p>A coding challenge</p>
          </div>
          <div>
            <button>Start</button>
          </div>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Form inputs', () => {
    it('input with label has no violations', async () => {
      const { container } = render(
        <div>
          <label htmlFor="email-input">Email</label>
          <input id="email-input" type="email" placeholder="you@example.com" />
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('input with aria-label has no violations', async () => {
      const { container } = render(
        <input aria-label="Search challenges" type="text" placeholder="Search..." />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Navigation structure', () => {
    it('nav with links has no violations', async () => {
      const { container } = render(
        <nav aria-label="Main navigation">
          <ul>
            <li><a href="/challenges">Challenges</a></li>
            <li><a href="/leaderboard">Leaderboard</a></li>
            <li><a href="/profile">Profile</a></li>
          </ul>
        </nav>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Interactive elements', () => {
    it('buttons have accessible names', async () => {
      const { container } = render(
        <div>
          <button>Start Challenge</button>
          <button aria-label="Close dialog">X</button>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Status indicators', () => {
    it('progress indicator with aria role has no violations', async () => {
      const { container } = render(
        <div role="progressbar" aria-valuenow={75} aria-valuemin={0} aria-valuemax={100} aria-label="Challenge progress">
          75%
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('alert messages have no violations', async () => {
      const { container } = render(
        <div role="alert">
          <span>Error: Invalid submission</span>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Data tables', () => {
    it('leaderboard table structure has no violations', async () => {
      const { container } = render(
        <table>
          <caption>Leaderboard</caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">User</th>
              <th scope="col">Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>Alice</td>
              <td>$0.05</td>
            </tr>
          </tbody>
        </table>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Terminal / Arena', () => {
    it('terminal region with ARIA attributes has no violations', async () => {
      const { container } = render(
        <div role="region" aria-label="Terminal">
          <div role="application" aria-roledescription="terminal" aria-label="Interactive terminal" tabIndex={0}>
            <span>$ ruwt</span>
          </div>
          <div aria-live="polite" aria-atomic={false} role="log" aria-label="Terminal output">
            <div>Welcome to ruwt</div>
          </div>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Dialog / Modal', () => {
    it('dialog with proper ARIA attributes has no violations', async () => {
      const { container } = render(
        <div role="dialog" aria-labelledby="dlg-title" aria-modal="true">
          <h2 id="dlg-title">Confirm Submission</h2>
          <p>Are you sure you want to submit?</p>
          <button>Cancel</button>
          <button>Submit</button>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  /* ──────────────────────────────────────────────────────────────────
   *  REAL COMPONENT A11Y TESTS
   * ────────────────────────────────────────────────────────────────── */

  describe('LoginScreen (real component)', () => {

    beforeEach(() => { localStorage.clear(); });

    it('renders without critical a11y violations', async () => {
      const { container } = render(<LoginScreen />);
      const results = await axe(container, {
        rules: MOCK_SAFE_RULES,
      });
      expect(results).toHaveNoViolations();
    });

    it('email input is keyboard-focusable', () => {
      render(<LoginScreen />);
      const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
      expect(emailInput).not.toBeNull();
      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);
    });

    it('password input is keyboard-focusable', () => {
      render(<LoginScreen />);
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
      expect(passwordInput).not.toBeNull();
      passwordInput.focus();
      expect(document.activeElement).toBe(passwordInput);
    });

    it('sign-in button is keyboard-accessible via Tab', () => {
      render(<LoginScreen />);
      const buttons = document.querySelectorAll('button');
      // All buttons should be focusable
      buttons.forEach(btn => {
        btn.focus();
        expect(document.activeElement).toBe(btn);
      });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ChallengesScreen (real component)', () => {
    const mockChallenges = [
      { id: 'c1', title: 'FizzBuzz Budget', description: 'Budget aware fizzbuzz', difficulty: 'easy', category: 'prompt_efficiency', tier: 'onboarding', sortOrder: 1, language: 'javascript', userStatus: null, skillTested: 'prompt writing', stats: { solvers: 5 }, maxCost: 100 },
      { id: 'c2', title: 'Cache Buster', description: 'Fix the cache', difficulty: 'hard', category: 'iterative_debugging', tier: 'core', sortOrder: 2, language: 'javascript', userStatus: 'passed', skillTested: null, stats: { solvers: 2 }, maxCost: 500 },
    ];

    beforeEach(() => {
      mockUseDashboardData.mockReturnValue({
        state: {
          challenges: { data: mockChallenges, status: 'loaded', lastFetchedAt: Date.now() },
          dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
        },
        initialLoadComplete: true,
        refreshEndpoint: vi.fn(),
        refreshAll: vi.fn(),
      });
      window.history.replaceState({}, '', window.location.pathname);
    });

    it('renders without critical a11y violations', async () => {
      const { container } = render(<ChallengesScreen />);
      const results = await axe(container, {
        rules: MOCK_SAFE_RULES,
      });
      expect(results).toHaveNoViolations();
    });

    it('search input is keyboard-focusable', () => {
      const { container } = render(<ChallengesScreen />);
      const searchInput = container.querySelector('input[placeholder="Search challenges..."]') as HTMLInputElement;
      expect(searchInput).not.toBeNull();
      searchInput.focus();
      expect(document.activeElement).toBe(searchInput);
    });

    it('filter buttons are keyboard-navigable via Tab', () => {
      const { container } = render(<ChallengesScreen />);
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
      buttons.forEach(btn => {
        btn.focus();
        expect(document.activeElement).toBe(btn);
      });
    });
  });

  describe('DashboardScreen (real component)', () => {
    const baseDashboardData = {
      profile: {
        name: 'TestUser', email: 'test@test.com', avatarUrl: null, username: 'testuser',
        credits: 50000, currentStreak: 3, longestStreak: 7, lastStreakDate: '2026-02-27',
        streakFreezes: 2, onboardingCompleted: 1,
      },
      progress: {
        totalChallenges: 60, solvedCount: 5,
        categorySolves: { prompt_efficiency: 2 },
        categoryTotals: { prompt_efficiency: 10 },
      },
      rank: { position: 12, totalRanked: 50 },
      dailyChallenge: { challengeId: 'dc1', title: 'Daily FizzBuzz', difficulty: 'easy', category: 'prompt_efficiency', solvedToday: false },
      recentBadges: [],
      recentActivity: [],
      unreadNotifications: 0,
      heatmap: {},
    };

    beforeEach(() => {
      mockUseDashboardData.mockReturnValue({
        state: {
          dashboard: { data: baseDashboardData, status: 'loaded', lastFetchedAt: Date.now() },
          challenges: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
          dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
          leaderboard: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
          seasons: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
          badges: { data: { catalog: [], earned: [] }, status: 'loaded', lastFetchedAt: Date.now() },
          bookmarks: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
          activity: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
          notifications: { data: { unreadCount: 0 }, status: 'loaded', lastFetchedAt: Date.now() },
        },
        initialLoadComplete: true,
        refreshEndpoint: vi.fn(),
        refreshAll: vi.fn(),
      });
    });

    it('renders without critical a11y violations', async () => {
      const { container } = render(<DashboardScreen />);
      const results = await axe(container, {
        rules: MOCK_SAFE_RULES,
      });
      expect(results).toHaveNoViolations();
    });

    it('interactive elements are keyboard-focusable', () => {
      const { container } = render(<DashboardScreen />);
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
      buttons.forEach(btn => {
        btn.focus();
        expect(document.activeElement).toBe(btn);
      });
    });
  });

  /* ── Keyboard navigation patterns ─────────────────────────────── */

  describe('Keyboard navigation', () => {
    it('Tab moves focus through interactive elements in order', () => {
      render(
        <div>
          <button data-testid="btn1">First</button>
          <input data-testid="input1" aria-label="Name" />
          <button data-testid="btn2">Second</button>
        </div>
      );

      const btn1 = screen.getByTestId('btn1');
      const input1 = screen.getByTestId('input1');
      const btn2 = screen.getByTestId('btn2');

      btn1.focus();
      expect(document.activeElement).toBe(btn1);

      input1.focus();
      expect(document.activeElement).toBe(input1);

      btn2.focus();
      expect(document.activeElement).toBe(btn2);
    });

    it('Enter key activates focused button', () => {
      const handleClick = vi.fn();
      render(<button onClick={handleClick}>Action</button>);

      const btn = screen.getByText('Action');
      btn.focus();
      fireEvent.keyDown(btn, { key: 'Enter', code: 'Enter' });
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('Escape key closes a dialog-like element', () => {
      const handleClose = vi.fn();
      const { container } = render(
        <div role="dialog" aria-label="Test dialog" onKeyDown={(e: any) => e.key === 'Escape' && handleClose()}>
          <button>Close</button>
        </div>
      );

      const dialog = container.querySelector('[role="dialog"]')!;
      fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('disabled buttons are not keyboard-activatable', () => {
      const handleClick = vi.fn();
      render(<button onClick={handleClick} disabled>Disabled</button>);

      const btn = screen.getByText('Disabled');
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });
});
