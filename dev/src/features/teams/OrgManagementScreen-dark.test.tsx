// @vitest-environment jsdom
/**
 * Dark-mode variant of OrgManagementScreen tests.
 * Exercises isDark branches for styling ternaries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockReset = vi.fn();

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
}));

vi.mock('@/shared/hooks/useAuthGuard', () => ({
  useAuthGuard: () => ({ user: { id: 'u1' }, loading: false }),
}));
vi.mock('@/shared/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/shared/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => (
    <button onClick={onPress} {...props}>{children}</button>
  ),
}));
vi.mock('@/shared/ui/Input', () => ({
  Input: ({ onChangeText, label, ...props }: any) => (
    <input aria-label={label} onChange={(e: any) => onChangeText?.(e.target.value)} {...props} />
  ),
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockDarkTheme());
vi.mock('@/shared/ui/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const mockOrg = {
  id: 'org1', name: 'Acme Corp', logoUrl: 'https://acme.com/logo.png',
  domain: 'acme.com', assessmentCredits: 10, subscriptionStatus: 'active',
  subscriptionPlan: 'monthly', subscriptionEndsAt: '2026-06-01T00:00:00Z',
  role: 'owner',
};

const mockMembers = [
  { id: 'm1', userId: 'u1', role: 'owner', joinedAt: '2026-01-01', name: 'Owner User', email: 'owner@acme.com', avatarUrl: null },
  { id: 'm2', userId: 'u2', role: 'admin', joinedAt: '2026-01-02', name: 'Admin User', email: 'admin@acme.com', avatarUrl: null },
  { id: 'm3', userId: 'u3', role: 'member', joinedAt: '2026-01-03', name: null, email: 'member@acme.com', avatarUrl: null },
];

const mockInvitations = [
  { id: 'inv1', email: 'invited@acme.com', role: 'member', status: 'pending', expiresAt: '2026-04-01T00:00:00Z', createdAt: '2026-02-01' },
];

const ok = (data: any) => ({ ok: true, json: () => Promise.resolve(data) });

function setupFetch(map: Record<string, any> = {}) {
  const entries = Object.entries(map).sort(([a], [b]) => b.length - a.length);
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    for (const [pattern, response] of entries) {
      if (url.includes(pattern)) return Promise.resolve(response);
    }
    return Promise.resolve(ok([]));
  }));
}

setupFetch({
  '/api/orgs': ok([mockOrg]),
  '/members': ok(mockMembers),
  '/invitations': ok(mockInvitations),
});
const { OrgManagementScreen } = await import('./OrgManagementScreen');

describe('OrgManagementScreen (dark mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/members': ok(mockMembers),
      '/invitations': ok(mockInvitations),
    });
  });

  it('renders org management in dark mode', async () => {
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Acme Corp/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders members section in dark mode', async () => {
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Members|owner/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders invitations in dark mode', async () => {
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/invited@acme.com/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders subscription info in dark mode', async () => {
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/active/i).length).toBeGreaterThanOrEqual(1);
    });
  });
});
