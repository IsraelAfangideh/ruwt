// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardDescription: ({ children, ...p }: any) => <div {...p}>{children}</div>,
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const DATA = {
  windowDays: 30,
  firstSessionDefinition: 'passed >= 1 challenge within 24h of signup',
  headline: { metric: 'first-session pass-rate', value: 62.5, target: 50, meetsTarget: true },
  funnel: { signups: 8, openedChallenge: 6, usedAiOnFirstAttempt: 4, passedFirstSession: 5, returnedAfterFirstSession: 2 },
  rates: { firstSessionPassRate: 62.5, openRate: 75, aiUseRateOfOpeners: 66.7, returnRate: 25 },
  weekly: [{ week: '2026-32', signups: 5, passedFirstSession: 3, firstSessionPassRate: 60 }],
};

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { AdminActivationScreen } = await import('./AdminActivationScreen');

describe('AdminActivationScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(DATA) });
    (globalThis.fetch as any) = mockFetch;
  });

  it('renders the headline pass-rate, target badge, and funnel after load', async () => {
    render(<AdminActivationScreen />);
    await waitFor(() => expect(screen.getByText('62.5%')).toBeInTheDocument());
    expect(screen.getByText(/Target 50%/)).toBeInTheDocument();
    expect(screen.getByText('Opened a challenge')).toBeInTheDocument();
    expect(screen.getByText('Passed (first session)')).toBeInTheDocument();
    expect(screen.getByText('Returned after 24h')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/analytics/activation?days=30');
  });

  it('shows an admin-only message on 403', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403, json: () => Promise.resolve({}) });
    render(<AdminActivationScreen />);
    await waitFor(() => expect(screen.getByText('Admin access required.')).toBeInTheDocument());
  });
});
