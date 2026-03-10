// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AppModeProvider, useAppMode } from './AppModeContext';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  Pressable: ({ children, onPress, ...p }: any) => <button onClick={onPress} {...p}>{typeof children === 'function' ? children({ pressed: false }) : children}</button>,
  StyleSheet: { create: (s: any) => s },
}));

function TestConsumer() {
  const ctx = useAppMode();
  return (
    <div>
      <span data-testid="mode">{ctx.mode}</span>
      <span data-testid="loading">{String(ctx.profileLoading)}</span>
      <span data-testid="is-org">{String(ctx.isOrgMember)}</span>
      <span data-testid="can-hiring">{String(ctx.canAccessHiringMode)}</span>
      <button data-testid="set-hiring" onClick={() => ctx.setMode('hiring')}>Set Hiring</button>
      <button data-testid="set-practice" onClick={() => ctx.setMode('practice')}>Set Practice</button>
    </div>
  );
}

describe('AppModeContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('defaults to practice mode for individual user', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ accountType: 'individual', org: null, preferredMode: null }),
    } as Response);

    render(<AppModeProvider><TestConsumer /></AppModeProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('mode').textContent).toBe('practice');
    expect(screen.getByTestId('is-org').textContent).toBe('false');
    expect(screen.getByTestId('can-hiring').textContent).toBe('false');
  });

  it('resolves to hiring mode from server preference', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        accountType: 'team',
        preferredMode: 'hiring',
        org: {
          id: 'o1', name: 'Org', role: 'admin',
          subscriptionStatus: 'active', subscriptionPlan: 'monthly',
          subscriptionEndsAt: null, trial: null,
        },
      }),
    } as Response);

    render(<AppModeProvider><TestConsumer /></AppModeProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('mode').textContent).toBe('hiring');
    expect(screen.getByTestId('is-org').textContent).toBe('true');
    expect(screen.getByTestId('can-hiring').textContent).toBe('true');
  });

  it('forces practice mode when user has no org even if server says hiring', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ accountType: 'individual', org: null, preferredMode: 'hiring' }),
    } as Response);

    render(<AppModeProvider><TestConsumer /></AppModeProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('mode').textContent).toBe('practice');
  });

  it('persists mode to localStorage on setMode', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        accountType: 'team',
        preferredMode: null,
        org: {
          id: 'o1', name: 'Org', role: 'admin',
          subscriptionStatus: 'active', subscriptionPlan: 'monthly',
          subscriptionEndsAt: null, trial: null,
        },
      }),
    } as Response);

    render(<AppModeProvider><TestConsumer /></AppModeProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    act(() => {
      screen.getByTestId('set-hiring').click();
    });

    expect(screen.getByTestId('mode').textContent).toBe('hiring');
    expect(localStorage.getItem('ruwt-app-mode')).toBe('hiring');
  });

  it('reads localStorage as fallback when server has no preference', async () => {
    localStorage.setItem('ruwt-app-mode', 'hiring');

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        accountType: 'team',
        preferredMode: null,
        org: {
          id: 'o1', name: 'Org', role: 'admin',
          subscriptionStatus: 'active', subscriptionPlan: 'monthly',
          subscriptionEndsAt: null, trial: null,
        },
      }),
    } as Response);

    render(<AppModeProvider><TestConsumer /></AppModeProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('mode').textContent).toBe('hiring');
  });

  it('handles fetch error gracefully', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    render(<AppModeProvider><TestConsumer /></AppModeProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('mode').textContent).toBe('practice');
  });

  it('detects active trial as canAccessHiringMode', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        accountType: 'team',
        preferredMode: null,
        org: {
          id: 'o1', name: 'Org', role: 'admin',
          subscriptionStatus: 'none', subscriptionPlan: null,
          subscriptionEndsAt: null,
          trial: { isActive: true, daysRemaining: 20, assessmentsUsed: 0, assessmentsLimit: 1, invitesUsed: 0, invitesLimit: 3 },
        },
      }),
    } as Response);

    render(<AppModeProvider><TestConsumer /></AppModeProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('can-hiring').textContent).toBe('true');
  });

  it('detects canceled-but-paid subscription as canAccessHiringMode', async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        accountType: 'team',
        preferredMode: null,
        org: {
          id: 'o1', name: 'Org', role: 'admin',
          subscriptionStatus: 'canceled', subscriptionPlan: 'monthly',
          subscriptionEndsAt: futureDate, trial: null,
        },
      }),
    } as Response);

    render(<AppModeProvider><TestConsumer /></AppModeProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('can-hiring').textContent).toBe('true');
  });

  it('throws when useAppMode is used outside provider', () => {
    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useAppMode must be used within AppModeProvider');
  });
});
