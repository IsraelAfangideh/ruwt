// @vitest-environment jsdom
/**
 * Dark-mode variant of SettingsScreen tests.
 * Exercises isDark branches for styling ternaries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), reset: vi.fn() }),
}));
vi.mock('@/shared/hooks/useAuthGuard', () => ({
  useAuthGuard: () => ({ user: { id: 'u1', email: 'test@test.com' }, loading: false }),
}));
vi.mock('@/shared/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
}));
vi.mock('@/shared/ui/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
  SkeletonLines: () => <div data-testid="skeleton-lines" />,
}));
vi.mock('@/shared/ui/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockDarkTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ accountType: 'individual', newsletterSubscribed: 1, subscriptionStatus: 'none', subscriptionPlan: null }),
}));

const { SettingsScreen } = await import('./SettingsScreen');

describe('SettingsScreen (dark mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'individual', newsletterSubscribed: 1, subscriptionStatus: 'none', subscriptionPlan: null }),
    }));
  });

  it('renders settings in dark mode', async () => {
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders email preferences in dark mode', async () => {
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Email Preferences').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders Practice card in dark mode', async () => {
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Practice')).toBeInTheDocument();
    });
  });

  it('renders team account in dark mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 0, subscriptionStatus: 'active', subscriptionPlan: 'monthly' }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
    });
  });
});
