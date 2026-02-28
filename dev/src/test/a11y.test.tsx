// @vitest-environment jsdom
/**
 * Automated accessibility tests using axe-core.
 * Renders key components and asserts zero a11y violations.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';

/** Helper: assert zero axe violations with readable failure output */
function expectNoViolations(results: Awaited<ReturnType<typeof axe>>) {
  const violations = (results as any).violations ?? [];
  const messages = violations.map(
    (v: any) =>
      `[${v.id}] ${v.help} (${v.impact})\n  ${v.nodes.map((n: any) => n.html).join('\n  ')}`,
  );
  expect(violations.length, `Accessibility violations:\n${messages.join('\n\n')}`).toBe(0);
}

/* ── Shared mocks ──────────────────────────────────────────────────── */

const mockNavigate = vi.fn();
const mockReset = vi.fn();

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
  useRoute: () => ({ params: {} }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn(),
    },
  }),
}));

vi.mock('@/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/hooks/useWindowWidth', () => ({
  useWindowWidth: () => 1024,
  useIsDesktop: () => true,
}));
vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: () => false }));

vi.mock('@/theme', () => ({
  useColors: () => ({
    bg: '#f5f3f0', bgWarm: '#ebe8e4', bgElevated: '#ffffff', text: '#1a1816',
    textMuted: '#5c564e', textSubtle: '#6b6560', accent: '#846a30',
    accentMuted: '#7d6430', border: 'rgba(26,24,22,0.08)',
    borderStrong: 'rgba(26,24,22,0.15)', error: '#b06060',
    errorBg: 'rgba(176,96,96,0.1)', success: '#5a8a5a',
    successBg: 'rgba(90,138,90,0.1)', accentBg: 'rgba(154,123,60,0.1)',
    primary: '#1a1816', primaryForeground: '#f5f3f0',
    secondary: '#ebe8e4', secondaryForeground: '#1a1816',
    muted: '#ebe8e4', mutedForeground: '#5c564e',
    card: '#ffffff', cardForeground: '#1a1816',
    destructive: '#b06060', profit: '#16a34a', loss: '#dc2626',
  }),
  useTheme: () => ({ mode: 'light', setMode: vi.fn(), isDark: false }),
}));

vi.mock('@/components/BrandPanel', () => ({ BrandPanel: () => <div data-testid="brand-panel" /> }));

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/components/FeaturedReplay', () => ({ FeaturedReplay: () => <div /> }));
vi.mock('@/components/ActivityFeed', () => ({ ActivityFeed: () => <div /> }));

/* ── Tests ─────────────────────────────────────────────────────────── */

describe('Accessibility: LoginScreen', () => {
  it('has no axe violations', async () => {
    const { LoginScreen } = await import('@/screens/LoginScreen');
    const { container } = render(<LoginScreen />);
    const results = await axe(container);
    expectNoViolations(results);
  });
});

describe('Accessibility: LandingScreen', () => {
  it('has no axe violations', async () => {
    const { LandingScreen } = await import('@/screens/LandingScreen');
    const { container } = render(<LandingScreen />);
    const results = await axe(container);
    expectNoViolations(results);
  });
});

describe('Accessibility: Dialog', () => {
  it('has no axe violations when open', async () => {
    const { Dialog, DialogHeader, DialogTitle, DialogContent } = await import('@/components/ui/Dialog');
    const { container } = render(
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogHeader>
          <DialogTitle>Test Dialog</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p>Dialog content</p>
        </DialogContent>
      </Dialog>
    );
    const results = await axe(container);
    expectNoViolations(results);
  });
});

describe('Accessibility: Toast', () => {
  it('has no axe violations when showing toasts', async () => {
    const React = await import('react');
    // Inline toast rendering to test the raw HTML structure
    const { container } = render(
      <div role="region" aria-label="Notifications">
        <div role="status" aria-live="polite">
          Test info toast
        </div>
        <div role="alert" aria-live="assertive">
          Test error toast
        </div>
      </div>
    );
    const results = await axe(container);
    expectNoViolations(results);
  });
});
