// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';

const mockNavigate = vi.fn();
const mockReset = vi.fn();
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null } });

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
}));
vi.mock('@/shared/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));
vi.mock('@/shared/social/FeaturedReplay', () => ({
  FeaturedReplay: () => <div data-testid="featured-replay" />,
}));
vi.mock('@/shared/social/ActivityFeed', () => ({
  ActivityFeed: () => <div data-testid="activity-feed" />,
}));
vi.mock('@/shared/social/PlatformStats', () => ({
  PlatformStats: () => <div data-testid="platform-stats" />,
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockDarkTheme());

const { LandingScreen } = await import('./LandingScreen');

/** Matches text that a design element splits across child nodes. */
const hasText = (re: RegExp) => expect(document.body.textContent ?? '').toMatch(re);

/**
 * Matches on textContent rather than `getAllByRole('button', { name })`, which
 * computes an accessible name for every node and takes seconds on a page this
 * large. A string matches exactly; a regex matches loosely.
 */
const buttonsNamed = (name: string | RegExp) =>
  screen
    .getAllByRole('button')
    .filter((b) =>
      typeof name === 'string' ? b.textContent === name : name.test(b.textContent ?? ''),
    );

const clickButton = (name: string | RegExp, index = 0) => fireEvent.click(buttonsNamed(name)[index]);

describe('LandingScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  /* ── Masthead + hero ───────────────────────────────────────────── */
  it('renders the Ruwt wordmark', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('Ruwt').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the hero headline as an h1', () => {
    render(<LandingScreen />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/AI\s*Fluency\s*Index\?/);
  });

  it('renders the beta eyebrow', () => {
    render(<LandingScreen />);
    expect(screen.getByText('Now in Beta')).toBeInTheDocument();
    expect(screen.getByText('Free browser IDE')).toBeInTheDocument();
  });

  it('renders the hero stat strip', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('Free').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('15').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$0').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('0–850').length).toBeGreaterThanOrEqual(1);
  });

  it('renders nav actions', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('For Teams').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByText('Get Started')).toBeInTheDocument();
  });

  /* ── The split ledger ──────────────────────────────────────────── */
  it('renders both solve paths with their final costs', () => {
    render(<LandingScreen />);
    expect(screen.getByText('No strategy')).toBeInTheDocument();
    expect(screen.getByText('AFI 780')).toBeInTheDocument();
    expect(screen.getByText('$0.4120')).toBeInTheDocument();
    expect(screen.getByText('$0.0031')).toBeInTheDocument();
    expect(screen.getAllByText('Passed')).toHaveLength(2);
  });

  it('states the cost gap and labels the figures as illustrative', () => {
    render(<LandingScreen />);
    hasText(/133× the spend for the same green tests/);
    hasText(/Illustrative figures, real model pricing/);
  });

  /* ── Sections ──────────────────────────────────────────────────── */
  it('renders the Arena section', () => {
    render(<LandingScreen />);
    expect(screen.getByText('The Arena')).toBeInTheDocument();
    hasText(/Every solve is an itemized receipt/);
    expect(screen.getByText('Fix the Connection Pool Race Condition')).toBeInTheDocument();
    expect(screen.getByAltText(/Arena IDE/)).toBeInTheDocument();
  });

  it('renders the Index section with the AFI gauge and all five dimensions', () => {
    render(<LandingScreen />);
    expect(screen.getByText('The Index')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /AI Fluency Index runs from 0 to 850/ })).toBeInTheDocument();
    for (const name of [
      'Model Selection',
      'Prompt Efficiency',
      'Iterative Debugging',
      'Multi-Model Strategy',
      'Speed',
    ]) {
      expect(screen.getAllByText(name).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders the three certification tiers', () => {
    render(<LandingScreen />);
    expect(screen.getByText('AI-Fluent')).toBeInTheDocument();
    expect(screen.getByText('AI-Fluent Pro')).toBeInTheDocument();
    expect(screen.getByText('AI-Fluent Expert')).toBeInTheDocument();
    expect(screen.getByText('400+')).toBeInTheDocument();
    expect(screen.getByText('550+')).toBeInTheDocument();
    expect(screen.getByText('700+')).toBeInTheDocument();
  });

  it('renders the IDE section with every capability', () => {
    render(<LandingScreen />);
    expect(screen.getByText('The IDE')).toBeInTheDocument();
    for (const name of ['AI Agent', 'npm Packages', 'Full Terminal', 'Bring Your Own Key', 'Auto-Save']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('renders the trust section', () => {
    render(<LandingScreen />);
    expect(screen.getByText('Built on Trust')).toBeInTheDocument();
    expect(screen.getByText('Powered by Cloudflare')).toBeInTheDocument();
    expect(screen.getByText('Open Source Models')).toBeInTheDocument();
    expect(screen.getByText('Your Data Stays Private')).toBeInTheDocument();
    expect(screen.getByText('Real Leaderboard')).toBeInTheDocument();
  });

  it('renders the live signal components', () => {
    render(<LandingScreen />);
    expect(screen.getByTestId('platform-stats')).toBeInTheDocument();
    expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
    expect(screen.getByTestId('featured-replay')).toBeInTheDocument();
  });

  it('renders the teams section', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('For Teams').length).toBeGreaterThanOrEqual(2);
    hasText(/Measure your team’s AI Fluency/);
    expect(screen.getByText('3-tier')).toBeInTheDocument();
  });

  it('renders the closing statement', () => {
    render(<LandingScreen />);
    hasText(/What will your AFI be\?/);
  });

  it('renders footer with copyright', () => {
    render(<LandingScreen />);
    hasText(/All rights reserved/);
  });

  /* ── Accessibility ─────────────────────────────────────────────── */
  it('has no axe violations', async () => {
    const { container } = render(<LandingScreen />);
    expect(await axe(container)).toHaveNoViolations();
  }, 30000);

  it('exposes one h1 and a heading for every section', () => {
    render(<LandingScreen />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBe(6);
  });

  /* ── Live panels hide when their component renders nothing ─────── */
  it('shows a signal panel once its component has rendered content', () => {
    render(<LandingScreen />);
    for (const id of ['platform-stats', 'activity-feed']) {
      const panel = screen.getByTestId(id).closest('.lp-panel');
      expect(panel).not.toBeNull();
      expect(panel).not.toHaveAttribute('hidden');
    }
  });

  it('hides a signal panel whose component renders nothing', async () => {
    // ActivityFeed genuinely returns null when there is too little activity.
    vi.resetModules();
    vi.doMock('@/shared/social/ActivityFeed', () => ({ ActivityFeed: () => null }));
    const { LandingScreen: Fresh } = await import('./LandingScreen');

    const { container } = render(<Fresh />);

    await waitFor(() => {
      expect(container.querySelectorAll('.lp-panel[hidden]')).toHaveLength(1);
    });
    vi.doUnmock('@/shared/social/ActivityFeed');
  });

  /* ── Navigation ────────────────────────────────────────────────── */
  it('navigates to Login from Sign in', () => {
    render(<LandingScreen />);
    clickButton('Sign in');
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('navigates to Register from Get Started', () => {
    render(<LandingScreen />);
    clickButton('Get Started');
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to Register from both Find Your Score buttons', () => {
    render(<LandingScreen />);
    const buttons = buttonsNamed('Find Your Score');
    expect(buttons).toHaveLength(2);
    buttons.forEach((b) => fireEvent.click(b));
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to the IDE from both IDE buttons', () => {
    render(<LandingScreen />);
    clickButton(/Open the IDE/);
    clickButton('Open the IDE');
    expect(mockNavigate).toHaveBeenCalledWith('IDE');
  });

  it('navigates to Register from the featured ticket', () => {
    render(<LandingScreen />);
    clickButton('Try This Challenge');
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to Problems from Browse Challenges', () => {
    render(<LandingScreen />);
    clickButton('Browse Challenges');
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  it("navigates to Register from See Today's Challenge", () => {
    render(<LandingScreen />);
    clickButton(/See Today’s Challenge/);
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to Hiring from the nav, the teams block and the closing CTA', () => {
    render(<LandingScreen />);
    clickButton('For Teams');
    clickButton('Assess Candidates');
    const benchmark = buttonsNamed('Benchmark Your Team');
    expect(benchmark).toHaveLength(2);
    benchmark.forEach((b) => fireEvent.click(b));
    expect(mockNavigate).toHaveBeenCalledTimes(4);
    expect(mockNavigate).toHaveBeenNthCalledWith(1, 'Hiring');
    expect(mockNavigate).toHaveBeenNthCalledWith(4, 'Hiring');
  });

  /* ── Auth redirect ─────────────────────────────────────────────── */
  it('redirects logged-in users to Assessments', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });

    render(<LandingScreen />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Assessments' }],
      });
    });
  });

  it('does not redirect anonymous visitors', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    render(<LandingScreen />);

    await waitFor(() => expect(mockGetUser).toHaveBeenCalled());
    expect(mockReset).not.toHaveBeenCalled();
  });

  describe('error handling', () => {
    it.each([
      ['undefined user', { data: { user: undefined } }],
      ['null user', { data: { user: null } }],
    ])('still renders the page with %s', async (_label, value) => {
      mockGetUser.mockResolvedValue(value);
      render(<LandingScreen />);
      await waitFor(() => expect(mockGetUser).toHaveBeenCalled());
      expect(screen.getByText('Get Started')).toBeInTheDocument();
      expect(mockReset).not.toHaveBeenCalled();
    });

    it('survives getUser rejecting', async () => {
      mockGetUser.mockRejectedValue(new Error('offline'));
      render(<LandingScreen />);
      await waitFor(() => expect(mockGetUser).toHaveBeenCalled());
      expect(screen.getByText('Get Started')).toBeInTheDocument();
      expect(mockReset).not.toHaveBeenCalled();
    });
  });
});
