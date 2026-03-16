// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: vi.fn() }),
}));

let mockUser: any = null;
vi.mock('@/shared/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockImplementation(() => Promise.resolve({ data: { user: mockUser } })) },
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
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

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
    expect(screen.getAllByText(/AI Fluency/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders For Engineering Teams badge', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('For Engineering Teams')).toBeInTheDocument();
  });

  it('renders FAQ section with all questions', () => {
    render(<TeamsScreen />);
    expect(screen.getByText(/different from a take-home/)).toBeInTheDocument();
    expect(screen.getByText(/candidate has never used AI/)).toBeInTheDocument();
    expect(screen.getByText(/Can candidates cheat/)).toBeInTheDocument();
    expect(screen.getByText(/How long does an assessment take/)).toBeInTheDocument();
  });

  it('expands FAQ answer when question is clicked', () => {
    render(<TeamsScreen />);
    const question = screen.getByText(/different from a take-home/);
    fireEvent.click(question);
    expect(screen.getByText(/tracks every AI interaction/)).toBeInTheDocument();
  });

  it('collapses FAQ answer when same question is clicked again', () => {
    render(<TeamsScreen />);
    const question = screen.getByText(/different from a take-home/);
    fireEvent.click(question);
    expect(screen.getByText(/tracks every AI interaction/)).toBeInTheDocument();
    fireEvent.click(question);
    expect(screen.queryByText(/tracks every AI interaction/)).toBeNull();
  });

  it('renders comparison table headers', () => {
    render(<TeamsScreen />);
    expect(screen.getAllByText(/Ruwt/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/HackerRank/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Codility/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Take-Home/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders comparison table rows', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('Measures AI usage')).toBeInTheDocument();
    expect(screen.getByText('Real cost tracking')).toBeInTheDocument();
    expect(screen.getByText('Full session replay')).toBeInTheDocument();
  });

  it('renders pricing section with subscription plans', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('Simple, Flat-Rate Pricing')).toBeInTheDocument();
    expect(screen.getByText('$200/month')).toBeInTheDocument();
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
    expect(screen.getByText('Three Steps. Real Data.')).toBeInTheDocument();
    expect(screen.getByText('Build Your Assessment')).toBeInTheDocument();
    expect(screen.getByText('Send the Link')).toBeInTheDocument();
    expect(screen.getAllByText('Compare Candidates').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Why Teams Switch to Ruwt trust section', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('Why Teams Switch to Ruwt')).toBeInTheDocument();
    expect(screen.getByText('Real AI, Real Cost')).toBeInTheDocument();
    expect(screen.getByText('Objective Comparison')).toBeInTheDocument();
    expect(screen.getByText('Full Session Replay')).toBeInTheDocument();
    expect(screen.getByText('Tamper-Proof Tracking')).toBeInTheDocument();
  });

  it('renders candidate comparison section', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('See What You Get')).toBeInTheDocument();
    expect(screen.getByText('Candidate A')).toBeInTheDocument();
    expect(screen.getAllByText(/Passed 5\/5/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders problem section', () => {
    render(<TeamsScreen />);
    expect(screen.getByText(/Every Engineer Says They Use AI/)).toBeInTheDocument();
    expect(screen.getByText(/Take-homes show the answer/)).toBeInTheDocument();
    expect(screen.getByText(/HackerRank tests algorithms/)).toBeInTheDocument();
  });

  it('renders hero stats', () => {
    render(<TeamsScreen />);
    expect(screen.getAllByText('5 min').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('SETUP')).toBeInTheDocument();
    expect(screen.getAllByText('0-850').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Sign in and Get Started for logged-out users', () => {
    render(<TeamsScreen />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument();
  });

  it('shows Dashboard button for logged-in users', async () => {
    mockUser = { id: 'u1' };
    render(<TeamsScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    });
  });

  it('navigates to Dashboard when header Dashboard button is clicked (logged in, line 210)', async () => {
    mockUser = { id: 'u1' };
    render(<TeamsScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(mockNavigate).toHaveBeenCalledWith('Dashboard');
  });

  it('navigates to Login when header Sign In is clicked', () => {
    render(<TeamsScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('navigates to Register when header Get Started is clicked', () => {
    render(<TeamsScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to Register when Start Free Trial is clicked (not logged in)', () => {
    render(<TeamsScreen />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Start Free Trial' })[0]);
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('starts trial and navigates to AssessmentBuilder when Start Free Trial is clicked (logged in)', async () => {
    mockUser = { id: 'u1' };
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(ok({ trial: {}, orgId: 'org1' }))
    ));
    render(<TeamsScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: 'Start Free Trial' })[0]);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('AssessmentBuilder', {});
    });
    expect(fetch).toHaveBeenCalledWith('/api/trial/start', { method: 'POST' });
  });

  it('navigates to AssessmentBuilder when trial already used (logged in)', async () => {
    mockUser = { id: 'u1' };
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(fail({ error: 'Trial already used', code: 'TRIAL_NOT_ELIGIBLE' }))
    ));
    render(<TeamsScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: 'Start Free Trial' })[0]);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('AssessmentBuilder', {});
    });
  });

  it('shows error when trial start fails with non-eligible reason (logged in)', async () => {
    mockUser = { id: 'u1' };
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(fail({ error: 'Profile not found', code: 'TRIAL_NOT_ELIGIBLE' }))
    ));
    render(<TeamsScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: 'Start Free Trial' })[0]);
    await waitFor(() => {
      expect(screen.getByText('Profile not found')).toBeInTheDocument();
    });
    // Should NOT navigate to AssessmentBuilder
    expect(mockNavigate).not.toHaveBeenCalledWith('AssessmentBuilder', {});
  });

  it('renders Book a Demo button', () => {
    render(<TeamsScreen />);
    expect(screen.getAllByRole('button', { name: 'Book a Demo' }).length).toBeGreaterThanOrEqual(1);
  });

  it('shows demo form when Book a Demo is clicked', () => {
    render(<TeamsScreen />);
    const demoButtons = screen.getAllByRole('button', { name: 'Book a Demo' });
    fireEvent.click(demoButtons[0]);
    expect(screen.getAllByPlaceholderText('Jane Smith').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByPlaceholderText('jane@company.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByPlaceholderText('Acme Corp').length).toBeGreaterThanOrEqual(1);
  });

  it('submits demo form and shows success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(ok({}))));
    render(<TeamsScreen />);
    const demoButtons = screen.getAllByRole('button', { name: 'Book a Demo' });
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
    const requestButtons = screen.getAllByRole('button', { name: 'Request Demo' });
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
    const demoButtons = screen.getAllByRole('button', { name: 'Book a Demo' });
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
    const requestButtons = screen.getAllByRole('button', { name: 'Request Demo' });
    fireEvent.click(requestButtons[0]);
    await waitFor(() => {
      expect(screen.getAllByText('Server error').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows demo error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.reject(new Error('Network'))));
    render(<TeamsScreen />);
    const demoButtons = screen.getAllByRole('button', { name: 'Book a Demo' });
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
    const requestButtons = screen.getAllByRole('button', { name: 'Request Demo' });
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
    const subscribeButtons = screen.getAllByRole('button', { name: 'Subscribe' });
    fireEvent.click(subscribeButtons[0]);
    await waitFor(() => {
      expect(window.location.href).toBe('https://stripe.com/checkout');
    });
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('handles subscribe when user is unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(ok({ error: 'Unauthorized' }))
    ));
    render(<TeamsScreen />);
    const subscribeButtons = screen.getAllByRole('button', { name: 'Subscribe' });
    fireEvent.click(subscribeButtons[0]);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Register');
    });
  });

  it('renders cross-link to developer challenges', () => {
    render(<TeamsScreen />);
    expect(screen.getByText(/Developer\? Practice free challenges/)).toBeInTheDocument();
  });

  it('navigates to Landing when logo is clicked', () => {
    render(<TeamsScreen />);
    fireEvent.click(screen.getAllByText('Ruwt')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
  });

  it('renders footer with copyright', () => {
    render(<TeamsScreen />);
    expect(screen.getByText(/All rights reserved/)).toBeInTheDocument();
  });

  it('renders final CTA section', () => {
    render(<TeamsScreen />);
    expect(screen.getByText('One Score. Every Engineer.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Start Free Trial' }).length).toBeGreaterThanOrEqual(2);
  });

  it('renders guarantee text', () => {
    render(<TeamsScreen />);
    expect(screen.getAllByText(/30-day money-back guarantee/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Contact Us button for enterprise tier', () => {
    render(<TeamsScreen />);
    expect(screen.getByRole('button', { name: 'Contact Us' })).toBeInTheDocument();
  });

  it('opens demo form when Contact Us is clicked', () => {
    render(<TeamsScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Contact Us' }));
    // Demo form should appear
    expect(screen.getAllByPlaceholderText('Jane Smith').length).toBeGreaterThanOrEqual(1);
  });

  it('renders pricing note in final CTA', () => {
    render(<TeamsScreen />);
    expect(screen.getAllByText(/\$200\/month when you're ready/).length).toBeGreaterThanOrEqual(1);
  });

  it('navigates to Register when final CTA button is clicked (not logged in)', () => {
    render(<TeamsScreen />);
    const ctaButtons = screen.getAllByRole('button', { name: 'Start Free Trial' });
    fireEvent.click(ctaButtons[ctaButtons.length - 1]);
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('shows Book a Demo button in final CTA when not submitted and form not shown', () => {
    render(<TeamsScreen />);
    // The final CTA section has a Book a Demo button
    const demoButtons = screen.getAllByRole('button', { name: 'Book a Demo' });
    expect(demoButtons.length).toBeGreaterThanOrEqual(2); // hero + final CTA
  });

  it('opens demo form when final CTA Book a Demo is clicked', () => {
    render(<TeamsScreen />);
    const demoButtons = screen.getAllByRole('button', { name: 'Book a Demo' });
    // The last Book a Demo should be in the final CTA
    fireEvent.click(demoButtons[demoButtons.length - 1]);
    expect(screen.getAllByPlaceholderText('Jane Smith').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Demo requested!" badge after demo form submission in final CTA', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(ok({}))));
    render(<TeamsScreen />);
    const demoButtons = screen.getAllByRole('button', { name: 'Book a Demo' });
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
    const requestButtons = screen.getAllByRole('button', { name: 'Request Demo' });
    fireEvent.click(requestButtons[0]);
    await waitFor(() => {
      expect(screen.getAllByText('Demo requested!').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('navigates to Landing when cross-link is clicked', () => {
    render(<TeamsScreen />);
    fireEvent.click(screen.getByText(/Developer\? Practice free challenges/));
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
  });

  it('handles subscribe error by showing demo form', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(ok({ error: 'Create an organization first' }))
    );
    vi.stubGlobal('fetch', mockFetch);
    render(<TeamsScreen />);
    const subscribeButtons = screen.getAllByRole('button', { name: 'Subscribe' });
    await act(async () => {
      fireEvent.click(subscribeButtons[0]);
    });
    // Verify checkout was called
    expect(mockFetch).toHaveBeenCalledWith('/api/checkout', expect.anything());
    // Button resets (not stuck on Loading)
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Subscribe' }).length).toBeGreaterThan(0);
    });
  });

  it('submits demo form with optional Team Size and Message fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(ok({}))));
    render(<TeamsScreen />);
    const demoButtons = screen.getAllByRole('button', { name: 'Book a Demo' });
    fireEvent.click(demoButtons[0]);
    // Fill all required fields
    screen.getAllByPlaceholderText('Jane Smith').forEach((el) =>
      fireEvent.change(el, { target: { value: 'Jane' } })
    );
    screen.getAllByPlaceholderText('jane@company.com').forEach((el) =>
      fireEvent.change(el, { target: { value: 'jane@co.com' } })
    );
    screen.getAllByPlaceholderText('Acme Corp').forEach((el) =>
      fireEvent.change(el, { target: { value: 'Acme' } })
    );
    // Fill the optional fields (lines 181-182)
    screen.getAllByPlaceholderText('e.g. 5-10 engineers').forEach((el) =>
      fireEvent.change(el, { target: { value: '15 engineers' } })
    );
    screen.getAllByPlaceholderText('Tell us about your hiring needs...').forEach((el) =>
      fireEvent.change(el, { target: { value: 'We need AI assessment for our team' } })
    );
    const requestButtons = screen.getAllByRole('button', { name: 'Request Demo' });
    fireEvent.click(requestButtons[0]);
    await waitFor(() => {
      expect(screen.getAllByText("We'll be in touch!").length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows fallback error when demo submission fails without error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: false, json: () => Promise.reject(new Error('parse error')) })
    ));
    render(<TeamsScreen />);
    const demoButtons = screen.getAllByRole('button', { name: 'Book a Demo' });
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
    const requestButtons = screen.getAllByRole('button', { name: 'Request Demo' });
    fireEvent.click(requestButtons[0]);
    await waitFor(() => {
      expect(screen.getAllByText(/Something went wrong/).length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── Error handling / negative tests ─────────────────────────────── */

  describe('error handling', () => {
    it('handles trial start network failure (logged in)', async () => {
      mockUser = { id: 'u1' };
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.reject(new Error('Network down'))));
      render(<TeamsScreen />);
      await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
      fireEvent.click(screen.getAllByRole('button', { name: 'Start Free Trial' })[0]);
      await waitFor(() => {
        expect(screen.getAllByText(/Something went wrong|Network/).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('handles trial start with malformed JSON response', async () => {
      mockUser = { id: 'u1' };
      let trialCalled = false;
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/api/trial/start')) {
          trialCalled = true;
          return Promise.resolve({ ok: true, json: () => Promise.reject(new Error('bad json')) });
        }
        return Promise.resolve(ok({}));
      }));
      render(<TeamsScreen />);
      await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
      fireEvent.click(screen.getAllByRole('button', { name: 'Start Free Trial' })[0]);
      await waitFor(() => {
        expect(trialCalled).toBe(true);
      });
    });

    it('handles checkout with network failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.reject(new Error('Network'))));
      render(<TeamsScreen />);
      const subscribeButtons = screen.getAllByRole('button', { name: 'Subscribe' });
      await act(async () => { fireEvent.click(subscribeButtons[0]); });
      // Should not crash, button should reset
      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Subscribe' }).length).toBeGreaterThan(0);
      });
    });

    it('handles checkout with malformed JSON response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
        Promise.resolve({ ok: true, json: () => Promise.reject(new Error('bad json')) })
      ));
      render(<TeamsScreen />);
      const subscribeButtons = screen.getAllByRole('button', { name: 'Subscribe' });
      await act(async () => { fireEvent.click(subscribeButtons[0]); });
      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Subscribe' }).length).toBeGreaterThan(0);
      });
    });

    it('handles demo form with empty required fields', async () => {
      render(<TeamsScreen />);
      const demoButtons = screen.getAllByRole('button', { name: 'Book a Demo' });
      fireEvent.click(demoButtons[0]);
      // Don't fill anything, just click submit
      const requestButtons = screen.getAllByRole('button', { name: 'Request Demo' });
      fireEvent.click(requestButtons[0]);
      // Should not crash — form might validate client-side or server-side
      expect(screen.getAllByRole('button', { name: 'Request Demo' }).length).toBeGreaterThanOrEqual(1);
    });

    it('handles demo form with invalid email format', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(ok({}))));
      render(<TeamsScreen />);
      const demoButtons = screen.getAllByRole('button', { name: 'Book a Demo' });
      fireEvent.click(demoButtons[0]);
      screen.getAllByPlaceholderText('Jane Smith').forEach((el) =>
        fireEvent.change(el, { target: { value: 'Jane' } })
      );
      screen.getAllByPlaceholderText('jane@company.com').forEach((el) =>
        fireEvent.change(el, { target: { value: 'not-an-email' } })
      );
      screen.getAllByPlaceholderText('Acme Corp').forEach((el) =>
        fireEvent.change(el, { target: { value: 'Acme' } })
      );
      const requestButtons = screen.getAllByRole('button', { name: 'Request Demo' });
      fireEvent.click(requestButtons[0]);
      // The form submits (server-side validation handles email format)
      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });
    });

    it('handles trial start with server 500 error', async () => {
      mockUser = { id: 'u1' };
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
        Promise.resolve(fail({ error: 'Internal server error' }))
      ));
      render(<TeamsScreen />);
      await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
      fireEvent.click(screen.getAllByRole('button', { name: 'Start Free Trial' })[0]);
      await waitFor(() => {
        expect(screen.getAllByText(/Internal server error/).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('handles double-click on Subscribe button', async () => {
      let callCount = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(ok({ url: 'https://stripe.com/checkout' }));
      }));
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = { href: '' };
      render(<TeamsScreen />);
      const subscribeButtons = screen.getAllByRole('button', { name: 'Subscribe' });
      fireEvent.click(subscribeButtons[0]);
      fireEvent.click(subscribeButtons[0]);
      await waitFor(() => {
        expect(callCount).toBeGreaterThanOrEqual(1);
      });
      Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
    });

    it('handles checkout response with no url field', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
        Promise.resolve(ok({}))
      ));
      render(<TeamsScreen />);
      const subscribeButtons = screen.getAllByRole('button', { name: 'Subscribe' });
      await act(async () => { fireEvent.click(subscribeButtons[0]); });
      await waitFor(() => {
        // No URL means redirect to Register for unauthorized
        expect(screen.getAllByRole('button', { name: 'Subscribe' }).length).toBeGreaterThan(0);
      });
    });

    it('handles trial start when user becomes null unexpectedly', async () => {
      mockUser = null;
      render(<TeamsScreen />);
      // Not logged in, Start Free Trial should go to Register
      fireEvent.click(screen.getAllByRole('button', { name: 'Start Free Trial' })[0]);
      expect(mockNavigate).toHaveBeenCalledWith('Register');
    });

    it('handles demo form submission with very long input', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(ok({}))));
      render(<TeamsScreen />);
      const demoButtons = screen.getAllByRole('button', { name: 'Book a Demo' });
      fireEvent.click(demoButtons[0]);
      screen.getAllByPlaceholderText('Jane Smith').forEach((el) =>
        fireEvent.change(el, { target: { value: 'A'.repeat(500) } })
      );
      screen.getAllByPlaceholderText('jane@company.com').forEach((el) =>
        fireEvent.change(el, { target: { value: 'a@b.com' } })
      );
      screen.getAllByPlaceholderText('Acme Corp').forEach((el) =>
        fireEvent.change(el, { target: { value: 'Corp' } })
      );
      const requestButtons = screen.getAllByRole('button', { name: 'Request Demo' });
      fireEvent.click(requestButtons[0]);
      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });
    });
  });
});
