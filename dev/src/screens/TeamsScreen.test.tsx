// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: vi.fn() }),
}));

let mockUser: any = null;
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockImplementation(() => Promise.resolve({ data: { user: mockUser } })) },
  }),
}));
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => (
    <button onClick={onPress} {...props}>{children}</button>
  ),
}));
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/components/ui/Input', () => ({
  Input: ({ onChangeText, label, ...props }: any) => (
    <input aria-label={label} onChange={(e: any) => onChangeText?.(e.target.value)} {...props} />
  ),
}));
vi.mock('@/lib/stripe', () => ({
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

const ok = (data: any) => ({ ok: true, json: () => Promise.resolve(data) });
const fail = (data: any) => ({ ok: false, json: () => Promise.resolve(data) });

vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(ok({}))));

const { TeamsScreen } = await import('./TeamsScreen');

describe('TeamsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(ok({}))));
  });

  it('renders the hero section headline', () => {
    render(<TeamsScreen />);
    expect(screen.getByText(/Actually Use AI/)).toBeTruthy();
  });

  it('renders For Hiring Teams badge', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('For Hiring Teams')).toBeTruthy();
  });

  it('renders FAQ section with all questions', () => {
    render(<TeamsScreen />);
    expect(screen.getByText(/different from a take-home/)).toBeTruthy();
    expect(screen.getByText(/candidate has never used AI/)).toBeTruthy();
    expect(screen.getByText(/Can candidates cheat/)).toBeTruthy();
    expect(screen.getByText(/How long does an assessment take/)).toBeTruthy();
  });

  it('expands FAQ answer when question is clicked', () => {
    render(<TeamsScreen />);
    const question = screen.getByText(/different from a take-home/);
    fireEvent.click(question);
    expect(screen.getByText(/tracks every AI interaction/)).toBeTruthy();
  });

  it('collapses FAQ answer when same question is clicked again', () => {
    render(<TeamsScreen />);
    const question = screen.getByText(/different from a take-home/);
    fireEvent.click(question);
    expect(screen.getByText(/tracks every AI interaction/)).toBeTruthy();
    fireEvent.click(question);
    expect(screen.queryByText(/tracks every AI interaction/)).toBeNull();
  });

  it('renders comparison table headers', () => {
    render(<TeamsScreen />);
    expect(screen.getAllByText(/Ruwt/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/HackerRank/)).toBeTruthy();
    expect(screen.getByText(/Codility/)).toBeTruthy();
    expect(screen.getAllByText(/Take-Home/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders comparison table rows', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('Measures AI usage')).toBeTruthy();
    expect(screen.getByText('Real cost tracking')).toBeTruthy();
    expect(screen.getByText('Full session replay')).toBeTruthy();
  });

  it('renders pricing section with subscription plans', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('Simple, Flat-Rate Pricing')).toBeTruthy();
    expect(screen.getByText('$200/month')).toBeTruthy();
    // Features are rendered with checkmark prefix; may appear in comparison table too
    expect(screen.getAllByText(/Unlimited assessments/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Enterprise tier with features', () => {
    render(<TeamsScreen />);
    expect(screen.getAllByText('Enterprise').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/SSO integration/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Dedicated support/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the three-step flow section', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('Three Steps to Better Hiring')).toBeTruthy();
    expect(screen.getByText('Create an Assessment')).toBeTruthy();
    expect(screen.getByText('Invite Candidates')).toBeTruthy();
    expect(screen.getByText('Review Results')).toBeTruthy();
  });

  it('renders Why Teams Choose Ruwt trust section', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('Why Teams Choose Ruwt')).toBeTruthy();
    expect(screen.getByText('Real AI, Real Cost')).toBeTruthy();
    expect(screen.getByText('Objective Metrics')).toBeTruthy();
    expect(screen.getByText('Full Replay')).toBeTruthy();
    expect(screen.getByText('Server-Tracked')).toBeTruthy();
  });

  it('renders results preview mockup', () => {
    render(<TeamsScreen />);
    expect(screen.getByText("What You'll See")).toBeTruthy();
    expect(screen.getByText('Jane Smith')).toBeTruthy();
    expect(screen.getByText(/Passed 5\/5 challenges/)).toBeTruthy();
  });

  it('renders ROI banner', () => {
    render(<TeamsScreen />);
    expect(screen.getByText(/Replace your take-home/)).toBeTruthy();
    expect(screen.getAllByText('5 min').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Setup time').length).toBeGreaterThanOrEqual(1);
  });

  it('renders platform stats', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('106')).toBeTruthy();
    expect(screen.getByText('Challenges')).toBeTruthy();
  });

  it('shows Sign in and Get Started for logged-out users', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('Sign in')).toBeTruthy();
    expect(screen.getByText('Get Started')).toBeTruthy();
  });

  it('shows Dashboard button for logged-in users', async () => {
    mockUser = { id: 'u1' };
    render(<TeamsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeTruthy();
    });
  });

  it('navigates to Register when Start Free Assessment is clicked (not logged in)', () => {
    render(<TeamsScreen />);
    fireEvent.click(screen.getByText('Start Free Assessment'));
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to AssessmentBuilder when Start Free Assessment is clicked (logged in)', async () => {
    mockUser = { id: 'u1' };
    render(<TeamsScreen />);
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeTruthy());
    fireEvent.click(screen.getByText('Start Free Assessment'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('AssessmentBuilder');
    });
  });

  it('renders Book a Demo button', () => {
    render(<TeamsScreen />);
    expect(screen.getAllByText('Book a Demo').length).toBeGreaterThanOrEqual(1);
  });

  it('shows demo form when Book a Demo is clicked', () => {
    render(<TeamsScreen />);
    const demoButtons = screen.getAllByText('Book a Demo');
    fireEvent.click(demoButtons[0]);
    expect(screen.getAllByPlaceholderText('Jane Smith').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByPlaceholderText('jane@company.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByPlaceholderText('Acme Corp').length).toBeGreaterThanOrEqual(1);
  });

  it('submits demo form and shows success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(ok({}))));
    render(<TeamsScreen />);
    const demoButtons = screen.getAllByText('Book a Demo');
    fireEvent.click(demoButtons[0]);
    // Fill all duplicated form instances
    screen.getAllByPlaceholderText('Jane Smith').forEach((el) =>
      fireEvent.change(el, { target: { value: 'Jane' } })
    );
    screen.getAllByPlaceholderText('jane@company.com').forEach((el) =>
      fireEvent.change(el, { target: { value: 'jane@co.com' } })
    );
    screen.getAllByPlaceholderText('Acme Corp').forEach((el) =>
      fireEvent.change(el, { target: { value: 'Acme' } })
    );
    const requestButtons = screen.getAllByText('Request Demo');
    fireEvent.click(requestButtons[0]);
    await waitFor(() => {
      expect(screen.getAllByText("We'll be in touch!").length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows demo error on submission failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(fail({ error: 'Server error' }))
    ));
    render(<TeamsScreen />);
    const demoButtons = screen.getAllByText('Book a Demo');
    fireEvent.click(demoButtons[0]);
    screen.getAllByPlaceholderText('Jane Smith').forEach((el) =>
      fireEvent.change(el, { target: { value: 'Jane' } })
    );
    screen.getAllByPlaceholderText('jane@company.com').forEach((el) =>
      fireEvent.change(el, { target: { value: 'jane@co.com' } })
    );
    screen.getAllByPlaceholderText('Acme Corp').forEach((el) =>
      fireEvent.change(el, { target: { value: 'Acme' } })
    );
    const requestButtons = screen.getAllByText('Request Demo');
    fireEvent.click(requestButtons[0]);
    await waitFor(() => {
      expect(screen.getAllByText('Server error').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows demo error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.reject(new Error('Network'))));
    render(<TeamsScreen />);
    const demoButtons = screen.getAllByText('Book a Demo');
    fireEvent.click(demoButtons[0]);
    screen.getAllByPlaceholderText('Jane Smith').forEach((el) =>
      fireEvent.change(el, { target: { value: 'Jane' } })
    );
    screen.getAllByPlaceholderText('jane@company.com').forEach((el) =>
      fireEvent.change(el, { target: { value: 'jane@co.com' } })
    );
    screen.getAllByPlaceholderText('Acme Corp').forEach((el) =>
      fireEvent.change(el, { target: { value: 'Acme' } })
    );
    const requestButtons = screen.getAllByText('Request Demo');
    fireEvent.click(requestButtons[0]);
    await waitFor(() => {
      expect(screen.getAllByText(/Something went wrong/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles subscribe click with checkout redirect', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(ok({ url: 'https://stripe.com/checkout' }))
    ));
    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { href: '' };
    render(<TeamsScreen />);
    const subscribeButtons = screen.getAllByText('Subscribe');
    fireEvent.click(subscribeButtons[0]);
    await waitFor(() => {
      expect(window.location.href).toBe('https://stripe.com/checkout');
    });
    window.location = originalLocation;
  });

  it('handles subscribe when user is unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(ok({ error: 'Unauthorized' }))
    ));
    render(<TeamsScreen />);
    const subscribeButtons = screen.getAllByText('Subscribe');
    fireEvent.click(subscribeButtons[0]);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Register');
    });
  });

  it('renders cross-link to developer challenges', () => {
    render(<TeamsScreen />);
    expect(screen.getByText(/Developer\? Try free challenges/)).toBeTruthy();
  });

  it('navigates to Landing when logo is clicked', () => {
    render(<TeamsScreen />);
    fireEvent.click(screen.getAllByText('Ruwt')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
  });

  it('renders footer with copyright', () => {
    render(<TeamsScreen />);
    expect(screen.getByText(/All rights reserved/)).toBeTruthy();
  });

  it('renders final CTA section', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('Start Assessing AI Skills Today')).toBeTruthy();
    expect(screen.getByText('Subscribe Now')).toBeTruthy();
  });

  it('renders guarantee text', () => {
    render(<TeamsScreen />);
    expect(screen.getAllByText(/30-day money-back guarantee/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Contact Us button for enterprise tier', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('Contact Us')).toBeTruthy();
  });

  it('opens demo form when Contact Us is clicked', () => {
    render(<TeamsScreen />);
    fireEvent.click(screen.getByText('Contact Us'));
    // Demo form should appear
    expect(screen.getAllByPlaceholderText('Jane Smith').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Subscribe Now button in final CTA', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('Subscribe Now')).toBeTruthy();
  });

  it('handles Subscribe Now click in final CTA section', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(ok({ url: 'https://stripe.com/checkout' }))
    ));
    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { href: '' };
    render(<TeamsScreen />);
    fireEvent.click(screen.getByText('Subscribe Now'));
    await waitFor(() => {
      expect(window.location.href).toBe('https://stripe.com/checkout');
    });
    window.location = originalLocation;
  });

  it('shows Book a Demo button in final CTA when not submitted and form not shown', () => {
    render(<TeamsScreen />);
    // The final CTA section has a Book a Demo button
    const demoButtons = screen.getAllByText('Book a Demo');
    expect(demoButtons.length).toBeGreaterThanOrEqual(2); // hero + final CTA
  });

  it('shows "Demo requested!" badge after demo form submission in final CTA', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(ok({}))));
    render(<TeamsScreen />);
    const demoButtons = screen.getAllByText('Book a Demo');
    fireEvent.click(demoButtons[0]);
    screen.getAllByPlaceholderText('Jane Smith').forEach((el) =>
      fireEvent.change(el, { target: { value: 'Jane' } })
    );
    screen.getAllByPlaceholderText('jane@company.com').forEach((el) =>
      fireEvent.change(el, { target: { value: 'jane@co.com' } })
    );
    screen.getAllByPlaceholderText('Acme Corp').forEach((el) =>
      fireEvent.change(el, { target: { value: 'Acme' } })
    );
    const requestButtons = screen.getAllByText('Request Demo');
    fireEvent.click(requestButtons[0]);
    await waitFor(() => {
      expect(screen.getAllByText('Demo requested!').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('navigates to Landing when cross-link is clicked', () => {
    render(<TeamsScreen />);
    fireEvent.click(screen.getByText(/Developer\? Try free challenges/));
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
  });

  it('handles subscribe error alert', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(ok({ error: 'Create an organization first' }))
    ));
    const mockAlert = vi.fn();
    vi.stubGlobal('alert', mockAlert);
    render(<TeamsScreen />);
    const subscribeButtons = screen.getAllByText('Subscribe');
    fireEvent.click(subscribeButtons[0]);
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Create an organization first');
    });
  });
});
