// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
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
vi.mock('@/shared/social/FeaturedReplay', () => ({
  FeaturedReplay: () => <div data-testid="featured-replay" />,
}));
vi.mock('@/shared/social/ActivityFeed', () => ({
  ActivityFeed: () => <div data-testid="activity-feed" />,
}));

const mockWidth = vi.fn(() => 1024);
vi.mock('@/shared/hooks/useWindowWidth', () => ({
  useWindowWidth: () => mockWidth(),
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const { LandingScreen } = await import('./LandingScreen');

describe('LandingScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockWidth.mockReturnValue(1024);
  });

  /* ── Basic rendering ───────────────────────────────────────────── */
  it('renders the Ruwt logo', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('Ruwt').length).toBeGreaterThanOrEqual(1);
  });

  it('renders hero section with CTA', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText(/AI Fluency Index/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders stats row', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('0-850').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('15').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Free').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Sign in and Get Started buttons', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('Sign in').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Get Started').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Now in Beta badge', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('Now in Beta').length).toBeGreaterThanOrEqual(1);
  });

  /* ── Hero CTAs ─────────────────────────────────────────────────── */
  it('renders Find Your Score button', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('Find Your Score').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Try a Challenge CTA', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText(/Try a Challenge/).length).toBeGreaterThanOrEqual(1);
  });

  /* ── Sections ──────────────────────────────────────────────────── */
  it('renders Arena IDE section', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('The Arena IDE').length).toBeGreaterThanOrEqual(1);
  });

  it('renders What Your AFI Measures section', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('What Your AFI Measures').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Model Selection').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Prompt Efficiency').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Iterative Debugging').length).toBeGreaterThanOrEqual(1);
  });

  it('renders How Scoring Works section', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('How Scoring Works').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Solve Challenges').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Build Your AFI').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Earn Certification').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Built on Trust section', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('Built on Trust').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Powered by Cloudflare').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Open Source Models').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Your Data Stays Private').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Real Leaderboard').length).toBeGreaterThanOrEqual(1);
  });

  it('renders For Teams section', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('For Teams').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/AI Fluency/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Daily Challenge CTA section', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('Daily Challenge').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Today's Challenge/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Featured Replay component', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText(/Watch How Top Solvers Think/).length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector('[data-testid="featured-replay"]')).not.toBeNull();
  });

  it('renders ActivityFeed component', () => {
    render(<LandingScreen />);
    expect(document.querySelector('[data-testid="activity-feed"]')).not.toBeNull();
  });

  it('renders final CTA section', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText(/What will your AFI be/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Find Your Score').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Benchmark Your Team').length).toBeGreaterThanOrEqual(1);
  });

  it('renders footer with copyright', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText(/All rights reserved/).length).toBeGreaterThanOrEqual(1);
  });

  /* ── Navigation actions ────────────────────────────────────────── */
  it('navigates to Login when Sign in is clicked', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getAllByText('Sign in')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('navigates to Register when Get Started is clicked', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getAllByText('Get Started')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to Register when Find Your Score is clicked', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getAllByText('Find Your Score')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to GuestArena on Try a Challenge click', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getByText(/Try a Challenge/));
    expect(mockNavigate).toHaveBeenCalledWith('GuestArena', { challengeId: 'fizzbuzz-budget' });
  });

  it('navigates to Teams when Benchmark Your Team is clicked', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getAllByText('Benchmark Your Team')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('Hiring');
  });

  it('navigates to Teams from For Hiring Managers card', () => {
    render(<LandingScreen />);
    const learnMoreButtons = screen.getAllByText(/Learn More/);
    fireEvent.click(learnMoreButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('Hiring');
  });

  /* ── Redirect logged-in user ───────────────────────────────────── */
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

    // Let async settle
    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
    });

    expect(mockReset).not.toHaveBeenCalled();
  });

  /* ── Navigation for CTA buttons ───────────────────────────────── */

  it('navigates to Register when "See Today\'s Challenge" is clicked', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getByText("See Today's Challenge"));
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to Register when "Try This Challenge" is clicked', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getByText('Try This Challenge'));
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to Register when "Find Your Score" CTA is clicked', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getAllByText('Find Your Score')[1]);
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  /* ── Mobile responsive ─────────────────────────────────────────── */
  it('renders stats row on mobile (width < 768)', () => {
    mockWidth.mockReturnValue(375);
    render(<LandingScreen />);
    // All stats should still be there
    expect(screen.getAllByText('100+').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
  });

  it('navigates to Hiring when For Teams is clicked', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getAllByText('For Teams')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('Hiring');
  });

  it('navigates to Problems when Browse Challenges is clicked', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getByText('Browse Challenges'));
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  it('navigates to Hiring when Benchmark Your Team is clicked in teams section', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getByText('Assess Candidates'));
    expect(mockNavigate).toHaveBeenCalledWith('Hiring');
  });

  it('navigates to Hiring from Benchmark Your Team in final CTA', () => {
    render(<LandingScreen />);
    const buttons = screen.getAllByText('Benchmark Your Team');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(mockNavigate).toHaveBeenCalledWith('Hiring');
  });
});
