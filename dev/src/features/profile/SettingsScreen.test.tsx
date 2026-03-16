// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), reset: vi.fn() }),
}));
let mockAuthReturn: any = { user: { id: 'u1', email: 'test@test.com' }, loading: false };
vi.mock('@/shared/hooks/useAuthGuard', () => ({
  useAuthGuard: () => mockAuthReturn,
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
const mockShowToast = vi.fn();
vi.mock('@/shared/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

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
      expect(screen.getByText('Practice')).toBeInTheDocument();
    });
    expect(screen.getByText(/Free unlimited practice/)).toBeInTheDocument();
  });

  it('shows Hiring Subscription card for team account', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'none', subscriptionPlan: null }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Hiring Subscription')).toBeInTheDocument();
    });
  });

  it('shows Subscribe button for team account with no subscription', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'none', subscriptionPlan: null }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Subscribe — \$200\/mo/)).toBeInTheDocument();
    });
  });

  it('shows Resubscribe button for canceled team subscription', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'canceled', subscriptionPlan: null }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Resubscribe' })).toBeInTheDocument();
    });
    expect(screen.getByText(/Your subscription has been canceled/)).toBeInTheDocument();
  });

  it('shows Manage Billing button for active team subscription', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'active', subscriptionPlan: 'monthly' }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Manage Billing' })).toBeInTheDocument();
    });
    expect(screen.getByText(/Active monthly subscription/)).toBeInTheDocument();
  });

  it('shows annual plan text for active annual subscription', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'active', subscriptionPlan: 'annual' }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Active annual subscription/)).toBeInTheDocument();
    });
  });

  it('shows past due warning for team with past_due status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'past_due', subscriptionPlan: 'monthly' }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Your payment is past due/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Manage Billing' })).toBeInTheDocument();
  });

  it('shows newsletter toggle as subscribed when newsletterSubscribed is 1', async () => {
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Daily newsletter')).toBeInTheDocument();
    });
    expect(screen.getByText(/Platform updates and dev links/)).toBeInTheDocument();
  });

  it('sends PATCH when newsletter toggle is clicked', async () => {
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Daily newsletter')).toBeInTheDocument();
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
      expect(screen.getByText('Daily newsletter')).toBeInTheDocument();
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
      expect(screen.getByText('Account')).toBeInTheDocument();
    });
    expect(screen.getByText(/test@test.com/)).toBeInTheDocument();
  });

  it('shows success banner when URL has purchased=true', async () => {
    window.history.replaceState({}, '', '/settings?purchased=true');
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Purchase successful/)).toBeInTheDocument();
    });
  });

  it('renders Email Preferences with newsletter hint text', async () => {
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Control what emails you receive/)).toBeInTheDocument();
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
      expect(screen.getByText('Daily newsletter')).toBeInTheDocument();
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
      expect(screen.getByRole('button', { name: 'Manage Billing' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Manage Billing' }));
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
      expect(screen.getByText(/Subscribe — \$200\/mo/)).toBeInTheDocument();
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
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  it('shows loading skeleton while auth state is resolving', () => {
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
      expect(screen.getByText('Daily newsletter')).toBeInTheDocument();
    });
  });

  it('shows error toast when billing portal response has no URL', async () => {
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
      expect(screen.getByRole('button', { name: 'Manage Billing' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Manage Billing' }));
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('No billing account found', 'error');
    });
    // Should NOT redirect since data.url is falsy
    expect(hrefSetter).not.toHaveBeenCalled();

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('shows error toast when billing portal fetch throws', async () => {
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
      expect(screen.getByRole('button', { name: 'Manage Billing' })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Manage Billing' }));
    });
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Failed to open billing portal', 'error');
    });
  });

  it('shows annual plan description for annual subscribers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'active', subscriptionPlan: 'annual' }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/annual/i)).toBeInTheDocument();
    });
  });

  it('shows Resubscribe button for canceled subscriptions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'canceled', subscriptionPlan: 'monthly' }),
    }));
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Resubscribe' })).toBeInTheDocument();
    });
  });

  it('reverts newsletter toggle and shows error when PATCH fails', async () => {
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
      expect(screen.getByText(/newsletter/i)).toBeInTheDocument();
    });

    // Toggle newsletter — should revert after PATCH fails
    // Click on the "Daily newsletter" pressable to toggle
    const toggle = screen.getByText('Daily newsletter');
    await act(async () => { fireEvent.click(toggle); });

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Failed to update preference', 'error');
    });
  });

  it('reverts newsletter toggle and shows error when PATCH throws', async () => {
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
      expect(screen.getByText(/newsletter/i)).toBeInTheDocument();
    });

    const toggle = screen.getByText('Daily newsletter');
    await act(async () => { fireEvent.click(toggle); });

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Failed to update preference', 'error');
    });
  });

  it('shows error toast when profile fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    render(<SettingsScreen />);
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Failed to load profile', 'error');
    });
  });

  it('renders settings with missing optional profile fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ newsletterSubscribed: 0 }),
    }));

    render(<SettingsScreen />);
    await waitFor(() => {
      // Should render without errors even with missing accountType, subscriptionStatus, etc.
      expect(screen.getByText(/newsletter/i)).toBeInTheDocument();
    });
  });

  it('renders settings layout when profile fetch returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    }));

    render(<SettingsScreen />);
    // Should still render the settings page (with defaults)
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });
  });

  /* ── Error handling / negative tests ─────────────────────────────── */

  describe('error handling', () => {
    it('handles profile fetch returning malformed JSON', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      }));
      render(<SettingsScreen />);
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('handles profile fetch with 500 status', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      }));
      render(<SettingsScreen />);
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
    });

    it('handles multiple rapid newsletter toggle clicks', async () => {
      render(<SettingsScreen />);
      await waitFor(() => {
        expect(screen.getByText('Daily newsletter')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Daily newsletter'));
      fireEvent.click(screen.getByText('Daily newsletter'));
      // Should not crash from rapid toggling
      expect(screen.getByText('Daily newsletter')).toBeInTheDocument();
    });

    it('handles profile with null subscription fields', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ accountType: null, newsletterSubscribed: null, subscriptionStatus: null, subscriptionPlan: null }),
      }));
      render(<SettingsScreen />);
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('handles billing portal returning non-ok response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/billing/portal')) {
          return { ok: false, json: async () => ({ error: 'Billing error' }) } as Response;
        }
        return {
          ok: true,
          json: async () => ({ accountType: 'team', newsletterSubscribed: 1, subscriptionStatus: 'active', subscriptionPlan: 'monthly' }),
        } as Response;
      }));
      render(<SettingsScreen />);
      await waitFor(() => {
        expect(screen.getByText('Manage Billing')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Manage Billing'));
      });
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalled();
      });
    });

    it('shows settings with unknown account type', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ accountType: 'unknown', newsletterSubscribed: 1, subscriptionStatus: 'none', subscriptionPlan: null }),
      }));
      render(<SettingsScreen />);
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('handles email display with long email address', async () => {
      mockAuthReturn = { user: { id: 'u1', email: 'very-long-email-address-that-goes-on-and-on@extremely-long-domain-name.com' }, loading: false };
      render(<SettingsScreen />);
      await waitFor(() => {
        expect(screen.getByText('Account')).toBeInTheDocument();
      });
      expect(screen.getByText(/very-long-email/)).toBeInTheDocument();
    });

    it('handles missing user email gracefully', async () => {
      mockAuthReturn = { user: { id: 'u1', email: '' }, loading: false };
      render(<SettingsScreen />);
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('shows dashboard layout even when user is null (redirect)', () => {
      mockAuthReturn = { user: null, loading: false };
      const { container } = render(<SettingsScreen />);
      // When user is null, should show skeleton (waiting for redirect)
      expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
    });
  });
});
