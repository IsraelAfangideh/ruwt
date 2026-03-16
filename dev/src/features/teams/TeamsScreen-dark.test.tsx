// @vitest-environment jsdom
/**
 * Dark-mode variant of TeamsScreen tests.
 * Exercises isDark branches for styling ternaries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), reset: vi.fn() }),
}));

vi.mock('@/shared/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockImplementation(() => Promise.resolve({ data: { user: null } })) },
  }),
}));
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => (
    <button onClick={onPress} {...props}>{children}</button>
  ),
}));
vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/shared/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/shared/ui/Input', () => ({
  Input: ({ onChangeText, label, ...props }: any) => (
    <input aria-label={label} onChange={(e: any) => onChangeText?.(e.target.value)} {...props} />
  ),
}));
vi.mock('@/shared/lib/stripe', () => ({
  SUBSCRIPTION_PLANS: [
    {
      id: 'plan-monthly', priceInCents: 20000, interval: 'month', label: '$200/month',
      monthlyEquivalent: '$200', badge: 'Most Popular',
      features: ['Unlimited assessments', 'Full session replays'],
    },
    {
      id: 'plan-annual', priceInCents: 192000, interval: 'year', label: '$1,920/year',
      monthlyEquivalent: '$160', badge: null, savings: 'Save 20%',
      features: ['Everything in monthly', 'Annual discount'],
    },
  ],
  ENTERPRISE_TIER: {
    id: 'enterprise', label: 'Enterprise',
    features: ['SSO integration', 'Dedicated support'],
  },
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockDarkTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })));

const { TeamsScreen } = await import('./TeamsScreen');

describe('TeamsScreen (dark mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })));
  });

  it('renders hero section in dark mode', () => {
    render(<TeamsScreen />);
    expect(screen.getAllByText(/AI Fluency/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders pricing cards in dark mode', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('For Engineering Teams')).toBeInTheDocument();
  });

  it('renders feature list in dark mode', () => {
    render(<TeamsScreen />);
    expect(screen.getAllByText(/Unlimited assessments/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders enterprise tier in dark mode', () => {
    render(<TeamsScreen />);
    expect(screen.getAllByText(/Enterprise/).length).toBeGreaterThanOrEqual(1);
  });
});
