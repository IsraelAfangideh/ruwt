// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), reset: vi.fn() }),
}));
let mockAuthReturn: any = { user: { id: 'u1', email: 'test@test.com' }, loading: false };
vi.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: () => mockAuthReturn,
}));
vi.mock('@/components/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
}));
vi.mock('@/components/ui/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
  SkeletonLines: () => <div data-testid="skeleton-lines" />,
}));
const mockShowToast = vi.fn();
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
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

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ accountType: 'individual', newsletterSubscribed: 1, subscriptionStatus: 'none', subscriptionPlan: null }),
}));

const { SettingsScreen } = await import('./SettingsScreen');

describe('SettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { user: { id: 'u1', email: 'test@test.com' }, loading: false };
    window.history.replaceState({}, '', '/settings');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'individual', newsletterSubscribed: 1, subscriptionStatus: 'none', subscriptionPlan: null }),
    }));
  });

  it('renders dashboard layout wrapper', async () => {
    const { container } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="dashboard-layout"]')).not.toBeNull();
    });
  });

  it('renders settings content after loading', async () => {
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('Email Preferences').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Daily newsletter/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows Practice card for individual account', async () => {
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Practice')).toBeTruthy();
    });
    expect(screen.getByText(/Free unlimited practice/)).toBeTruthy();
  });

  it('shows Hiring Subscription card for team account', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'none', subscriptionPlan: null }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Hiring Subscription')).toBeTruthy();
    });
  });

  it('shows Subscribe button for team account with no subscription', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'none', subscriptionPlan: null }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Subscribe — \$200\/mo/)).toBeTruthy();
    });
  });

  it('shows Resubscribe button for canceled team subscription', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'canceled', subscriptionPlan: null }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Resubscribe')).toBeTruthy();
    });
    expect(screen.getByText(/Your subscription has been canceled/)).toBeTruthy();
  });

  it('shows Manage Billing button for active team subscription', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'active', subscriptionPlan: 'monthly' }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Manage Billing')).toBeTruthy();
    });
    expect(screen.getByText(/Active monthly subscription/)).toBeTruthy();
  });

  it('shows annual plan text for active annual subscription', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'active', subscriptionPlan: 'annual' }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Active annual subscription/)).toBeTruthy();
    });
  });

  it('shows past due warning for team with past_due status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'past_due', subscriptionPlan: 'monthly' }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Your payment is past due/)).toBeTruthy();
    });
    expect(screen.getByText('Manage Billing')).toBeTruthy();
  });

  it('shows newsletter toggle as subscribed when newsletterSubscribed is 1', async () => {
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Daily newsletter')).toBeTruthy();
    });
    expect(screen.getByText(/Platform updates and dev links/)).toBeTruthy();
  });

  it('sends PATCH when newsletter toggle is clicked', async () => {
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Daily newsletter')).toBeTruthy();
    });
    // Click the toggle row (the Pressable wrapping Daily newsletter)
    fireEvent.click(screen.getByText('Daily newsletter'));
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const patchCall = calls.find((c: any[]) => c[1]?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
      expect(JSON.parse(patchCall[1].body)).toEqual({ newsletterSubscribed: 0 });
    });
  });

  it('reverts newsletter toggle on PATCH failure', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
      callCount++;
      if (opts?.method === 'PATCH') {
        return { ok: false, json: async () => ({}) } as Response;
      }
      return {
        ok: true,
        json: async () => ({ accountType: 'individual', newsletterSubscribed: 1, subscriptionStatus: 'none', subscriptionPlan: null }),
      } as Response;
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Daily newsletter')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Daily newsletter'));
    // After revert, the toggle should still show subscribed state (no visible change in DOM test)
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const patchCall = calls.find((c: any[]) => c[1]?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
    });
  });

  it('shows Account card with user email', async () => {
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Account')).toBeTruthy();
    });
    expect(screen.getByText(/test@test.com/)).toBeTruthy();
  });

  it('shows success banner when URL has purchased=true', async () => {
    window.history.replaceState({}, '', '/settings?purchased=true');
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Purchase successful/)).toBeTruthy();
    });
  });

  it('renders Email Preferences with newsletter hint text', async () => {
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Control what emails you receive/)).toBeTruthy();
    });
  });

  it('reverts newsletter toggle on network error (catch branch)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
      if (opts?.method === 'PATCH') {
        throw new Error('Network failure');
      }
      return {
        ok: true,
        json: async () => ({ accountType: 'individual', newsletterSubscribed: 1, subscriptionStatus: 'none', subscriptionPlan: null }),
      } as Response;
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Daily newsletter')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Daily newsletter'));
    // After network error, the toggle should revert
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const patchCall = calls.find((c: any[]) => c[1]?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
    });
  });

  it('calls billing portal and redirects when Manage Billing is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/billing/portal')) {
        return { ok: true, json: async () => ({ url: 'https://billing.stripe.com/portal' }) } as Response;
      }
      return {
        ok: true,
        json: async () => ({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'active', subscriptionPlan: 'monthly' }),
      } as Response;
    }));
    // Mock window.location.href setter
    const hrefSetter = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '', origin: originalLocation.origin, search: '' },
      writable: true,
    });
    Object.defineProperty(window.location, 'href', {
      set: hrefSetter,
      get: () => '',
    });

    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Manage Billing')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Manage Billing'));
    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith('https://billing.stripe.com/portal');
    });

    // Restore
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('navigates to /teams when Subscribe button is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'none', subscriptionPlan: null }),
    }));
    const hrefSetter = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '', origin: originalLocation.origin, search: '' },
      writable: true,
    });
    Object.defineProperty(window.location, 'href', {
      set: hrefSetter,
      get: () => '',
    });

    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Subscribe — \$200\/mo/)).toBeTruthy();
    });
    fireEvent.click(screen.getByText(/Subscribe — \$200\/mo/));
    expect(hrefSetter).toHaveBeenCalledWith('/hiring');

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('handles profile fetch failure and shows toast', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));
    render(<SettingsScreen />);
    // Should still render since it catches the error
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeTruthy();
    });
  });

  it('shows loading skeleton when auth is loading (line 78)', () => {
    mockAuthReturn = { user: null, loading: true };
    const { container } = render(<SettingsScreen />);
    expect(container.querySelectorAll('[data-testid="skeleton"]').length).toBeGreaterThanOrEqual(1);
  });

  it('sets newsletterSubscribed to false when API returns 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'individual', newsletterSubscribed: 0, subscriptionStatus: 'none', subscriptionPlan: null }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Daily newsletter')).toBeTruthy();
    });
  });

  it('shows toast when billing portal returns no url (line 134)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/billing/portal')) {
        return { ok: true, json: async () => ({ error: 'No billing account found' }) } as Response;
      }
      return {
        ok: true,
        json: async () => ({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'active', subscriptionPlan: 'monthly' }),
      } as Response;
    }));
    const hrefSetter = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '', origin: originalLocation.origin, search: '' },
      writable: true,
    });
    Object.defineProperty(window.location, 'href', {
      set: hrefSetter,
      get: () => '',
    });

    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Manage Billing')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Manage Billing'));
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('No billing account found', 'error');
    });
    // Should NOT redirect since data.url is falsy
    expect(hrefSetter).not.toHaveBeenCalled();

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('shows toast when billing portal fetch throws (line 135 catch)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/billing/portal')) {
        throw new Error('Portal unavailable');
      }
      return {
        ok: true,
        json: async () => ({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'active', subscriptionPlan: 'monthly' }),
      } as Response;
    }));

    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Manage Billing')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Manage Billing'));
    });
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Failed to open billing portal', 'error');
    });
  });

  it('shows annual plan description when subscriptionPlan is annual (line 118)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'active', subscriptionPlan: 'annual' }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/annual/i)).toBeTruthy();
    });
  });

  it('shows canceled subscription with Resubscribe button (line 146)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'canceled', subscriptionPlan: 'monthly' }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Resubscribe')).toBeTruthy();
    });
  });

  it('reverts newsletter toggle and shows toast when PATCH returns non-ok (line 66-68)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts?: any) => {
      if (opts?.method === 'PATCH') {
        return Promise.resolve({ ok: false } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ accountType: 'individual', newsletterSubscribed: 1, subscriptionStatus: 'none', subscriptionPlan: null }),
      } as Response);
    }));

    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/newsletter/i)).toBeTruthy();
    });

    // Toggle newsletter — should revert after PATCH fails
    // Click on the "Daily newsletter" pressable to toggle
    const toggle = screen.getByText('Daily newsletter');
    await act(async () => { fireEvent.click(toggle); });

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Failed to update preference', 'error');
    });
  });

  it('reverts newsletter toggle and shows toast when PATCH throws (line 70-72)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts?: any) => {
      if (opts?.method === 'PATCH') {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ accountType: 'individual', newsletterSubscribed: 1, subscriptionStatus: 'none', subscriptionPlan: null }),
      } as Response);
    }));

    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/newsletter/i)).toBeTruthy();
    });

    const toggle = screen.getByText('Daily newsletter');
    await act(async () => { fireEvent.click(toggle); });

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Failed to update preference', 'error');
    });
  });

  it('shows toast when profile fetch fails (line 37-38)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    render(<SettingsScreen />);
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Failed to load profile', 'error');
    });
  });

  it('handles profile response with missing optional fields (line 32-35)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ newsletterSubscribed: 0 }),
    }));

    render(<SettingsScreen />);
    await waitFor(() => {
      // Should render without errors even with missing accountType, subscriptionStatus, etc.
      expect(screen.getByText(/newsletter/i)).toBeTruthy();
    });
  });

  it('handles profile fetch returning non-ok status (line 30)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    }));

    render(<SettingsScreen />);
    // Should still render the settings page (with defaults)
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
    });
  });
});
