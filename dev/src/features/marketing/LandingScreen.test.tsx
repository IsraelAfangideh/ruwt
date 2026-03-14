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
vi.mock('@/shared/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    borderStrong: '#999', card: '#fff', muted: '#f5f5f5', error: '#f00', errorBg: '#fee',
    success: '#0a0', successBg: '#efe', primary: '#000', primaryForeground: '#fff',
    secondary: '#eee', secondaryForeground: '#000', destructive: '#f00',
    textSubtle: '#aaa', bgElevated: '#fafafa', accentBg: '#ffe',
  }),
}));
vi.mock('@/shared/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));

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
    expect(screen.getAllByText(/Prove You Can Use AI/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Better Than Anyone/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders stats row', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('100+').length).toBeGreaterThanOrEqual(1);
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
  it('renders Start Free Practice button', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('Start Free Practice').length).toBeGreaterThanOrEqual(1);
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

  it('renders Three Skills That Matter section', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('Three Skills That Matter').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Model Selection').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Prompt Efficiency').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Iterative Debugging').length).toBeGreaterThanOrEqual(1);
  });

  it('renders How It Works section', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('How It Works').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pick a Challenge').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Solve with AI').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Climb the Leaderboard').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Built on Trust section', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('Built on Trust').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Powered by Cloudflare').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Open Source Models').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Your Data Stays Private').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Real Leaderboard').length).toBeGreaterThanOrEqual(1);
  });

  it('renders For Hiring Teams section', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('For Hiring Teams').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/AI-Fluent/).length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getAllByText(/Ready to prove your AI skills/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Get Started Free').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Book a Demo').length).toBeGreaterThanOrEqual(1);
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

  it('navigates to Register when Start Free Practice is clicked', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getByText('Start Free Practice'));
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to GuestArena on Try a Challenge click', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getByText(/Try a Challenge/));
    expect(mockNavigate).toHaveBeenCalledWith('GuestArena', { challengeId: 'fizzbuzz-budget' });
  });

  it('navigates to Teams when Book a Demo is clicked', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getAllByText('Book a Demo')[0]);
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

  it('navigates to Register when "Get Started Free" is clicked', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getByText('Get Started Free'));
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
});
