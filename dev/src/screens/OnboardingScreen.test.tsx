// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockReset = vi.fn();
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } });

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children, ...p }: any) => <div {...p}>{children}</div>,
}));
vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
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

// Mock fetch: onboardingCompleted = 0 so user stays on onboarding
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ onboardingCompleted: 0 }),
});
vi.stubGlobal('fetch', mockFetch);

const { OnboardingScreen } = await import('./OnboardingScreen');

describe('OnboardingScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ onboardingCompleted: 0 }),
    });
    (globalThis.fetch as any) = mockFetch;
  });

  /* ── Loading state ─────────────────────────────────────────────── */
  it('renders loading spinner initially', () => {
    const { container } = render(<OnboardingScreen />);
    expect(container.querySelector('svg') || container.textContent).toBeTruthy();
  });

  /* ── Step 1: Welcome ───────────────────────────────────────────── */
  it('renders the welcome step after loading', async () => {
    render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Welcome to ruwt.dev/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders progress dots', async () => {
    const { container } = render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Welcome to ruwt.dev/).length).toBeGreaterThanOrEqual(1);
    });
    const dots = container.querySelectorAll('[class*="r-borderRadius"]');
    expect(dots.length).toBeGreaterThanOrEqual(3);
  });

  it('renders the Next button on step 1', async () => {
    render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Next').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders New to ruwt.dev? badge on step 1', async () => {
    render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/New to ruwt.dev/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders flow cards on step 1', async () => {
    render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Pick a Challenge').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Solve with AI').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Rank by Efficiency').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders the AI budget tip card', async () => {
    render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Your AI budget matters/).length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── Step 2: First Challenge ───────────────────────────────────── */
  it('advances to step 2 when Next is clicked', async () => {
    render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Next').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getAllByText('Your First Challenge').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders FizzBuzz Budget challenge card on step 2', async () => {
    render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Next').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getAllByText('FizzBuzz Budget').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('Easy').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Onboarding').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('JavaScript').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Quick Tips on step 2', async () => {
    render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Next').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getAllByText('Quick Tips').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders Start Challenge button on step 2', async () => {
    render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Next').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getAllByText('Start Challenge').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders Back button and skip link on step 2', async () => {
    render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Next').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getAllByText('Back').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/I'll explore on my own/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('goes back to step 1 when Back is clicked on step 2', async () => {
    render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Next').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getAllByText('Back').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByText('Back'));

    await waitFor(() => {
      expect(screen.getAllByText(/Welcome to ruwt.dev/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('navigates to Arena on Start Challenge', async () => {
    render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Next').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getAllByText('Start Challenge').length).toBeGreaterThanOrEqual(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Challenge'));
    });

    expect(mockNavigate).toHaveBeenCalledWith('Arena', { challengeId: 'fizzbuzz-budget' });
  });

  it('completes onboarding on skip link', async () => {
    render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Next').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getAllByText(/I'll explore on my own/).length).toBeGreaterThanOrEqual(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/I'll explore on my own/));
    });

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Dashboard' }],
      });
    });
  });

  /* ── Step 3: Completion ────────────────────────────────────────── */
  it('does not advance past step 2 via Next on step 2 (no Next button)', async () => {
    render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Next').length).toBeGreaterThanOrEqual(1);
    });

    // Go to step 2
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getAllByText('Start Challenge').length).toBeGreaterThanOrEqual(1);
    });

    // Step 2 does not have a "Next" button, it has "Start Challenge"
    expect(screen.queryByText('Next')).toBeNull();
  });

  /* ── Redirects ─────────────────────────────────────────────────── */
  it('redirects to Login if no user', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    render(<OnboardingScreen />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    });
  });

  it('redirects to Dashboard if onboarding already completed', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ onboardingCompleted: 1 }),
    });
    (globalThis.fetch as any) = mockFetch;

    render(<OnboardingScreen />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Dashboard' }],
      });
    });
  });

  it('continues onboarding if profile check fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    (globalThis.fetch as any) = mockFetch;

    render(<OnboardingScreen />);

    await waitFor(() => {
      expect(screen.getAllByText(/Welcome to ruwt.dev/).length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── Step 1: goBack does nothing on step 0 ─────────────────────── */
  it('goBack does not go below step 0', async () => {
    render(<OnboardingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Welcome to ruwt.dev/).length).toBeGreaterThanOrEqual(1);
    });
    // Step 0 has no Back button, so we're verifying step 0 stays rendered
    expect(screen.queryByText('Back')).toBeNull();
  });

  it('continues onboarding when profile fetch returns res.ok=false (line 46)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    });
    (globalThis.fetch as any) = mockFetch;

    render(<OnboardingScreen />);

    await waitFor(() => {
      expect(screen.getAllByText(/Welcome to ruwt.dev/).length).toBeGreaterThanOrEqual(1);
    });
    // Should not redirect — stays on onboarding
    expect(mockReset).not.toHaveBeenCalled();
  });

});
