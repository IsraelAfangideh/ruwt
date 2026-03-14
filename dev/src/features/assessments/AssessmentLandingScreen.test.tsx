// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } });

let routeParams: any = { token: 'test-invite-token' };
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: vi.fn() }),
  useRoute: () => ({ params: routeParams }),
}));
vi.mock('@/shared/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
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
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
}));
vi.mock('@/shared/lib/difficulty', () => ({
  getDifficultyStyle: (d: string) => ({
    color: d === 'easy' ? '#22c55e' : d === 'hard' ? '#ef4444' : '#38bdf8',
    bg: 'rgba(56,189,248,0.12)',
    label: d.charAt(0).toUpperCase() + d.slice(1),
  }),
}));
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

const mockPreview = {
  title: 'Frontend Developer Assessment',
  description: 'Evaluate AI coding efficiency',
  challengeCount: 5,
  timeLimitMinutes: 90,
  difficultyBreakdown: { easy: 2, medium: 2, hard: 1 },
  categoryBreakdown: { prompt_efficiency: 3, model_selection: 2 },
  expired: false,
  companyName: 'TestCorp',
  companyLogoUrl: null,
  welcomeMessage: null,
};

const mockFetch = vi.fn();

describe('AssessmentLandingScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeParams = { token: 'test-invite-token' };
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPreview),
    });
    vi.stubGlobal('fetch', mockFetch);
  });

  /* ── Loading state ─────────────────────────────────────────────── */
  it('renders loading state initially', async () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    const { container } = render(<AssessmentLandingScreen />);
    expect(container.querySelector('[data-testid="skeleton-detail"]')).not.toBeNull();
  });

  /* ── Preview loaded ────────────────────────────────────────────── */
  it('renders assessment preview after loading', async () => {
    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Frontend Developer Assessment/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders challenge count and time limit', async () => {
    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/5 coding challenge/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/90 minutes/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders Start Assessment button', async () => {
    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Start Assessment').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders AI-Efficiency Assessment badge', async () => {
    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('AI-Efficiency Assessment').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders difficulty breakdown badges', async () => {
    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Easy/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Medium/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Hard/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders How it works and Scoring info', async () => {
    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('How it works:').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Scoring:').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders company name when present', async () => {
    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('TestCorp').length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── No token ──────────────────────────────────────────────────── */
  it('renders invalid link message when no token', async () => {
    routeParams = {};
    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);
    expect(screen.getAllByText('Invalid assessment link').length).toBeGreaterThanOrEqual(1);
  });

  /* ── Expired assessment ────────────────────────────────────────── */
  it('renders expired assessment message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockPreview, expired: true }),
    });
    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/invite has expired/).length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── Start assessment flow ─────────────────────────────────────── */
  it('navigates to AssessmentFlow on successful start', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockPreview) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ session: { id: 'sess-123' } }) });

    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Start Assessment').length).toBeGreaterThanOrEqual(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Assessment'));
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('AssessmentFlow', { sessionId: 'sess-123' });
    });
  });

  it('shows "Starting..." during assessment start', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockPreview) })
      .mockReturnValueOnce(new Promise(() => {}));

    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Start Assessment').length).toBeGreaterThanOrEqual(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Assessment'));
    });

    expect(screen.getAllByText('Starting...').length).toBeGreaterThanOrEqual(1);
  });

  it('redirects to Login if user not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockPreview) });

    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Start Assessment').length).toBeGreaterThanOrEqual(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Assessment'));
    });

    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('shows error from failed start API', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockPreview) })
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: 'Assessment already taken' }) });

    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Start Assessment').length).toBeGreaterThanOrEqual(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Assessment'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Assessment already taken').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows default error when start API has no message', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockPreview) })
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) });

    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Start Assessment').length).toBeGreaterThanOrEqual(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Assessment'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Failed to start assessment').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows error on network failure during start', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockPreview) })
      .mockRejectedValueOnce(new Error('Network error'));

    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Start Assessment').length).toBeGreaterThanOrEqual(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Assessment'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Network error').length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── Preview fetch failure ─────────────────────────────────────── */
  it('handles preview fetch failure gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);

    await waitFor(() => {
      // Should still render the page with default content
      expect(screen.getAllByText('Start Assessment').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles preview fetch non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve(null) });

    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);

    await waitFor(() => {
      // Should render with fallback content (no preview data)
      expect(screen.getAllByText('Start Assessment').length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── Company branding ──────────────────────────────────────────── */
  it('renders Ruwt logo when no company info', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockPreview, companyName: null, companyLogoUrl: null }),
    });

    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Ruwt').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders Powered by Ruwt footer when company name present', async () => {
    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Powered by Ruwt').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders company logo when companyLogoUrl is present', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockPreview, companyLogoUrl: 'https://example.com/logo.png' }),
    });

    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    const { container } = render(<AssessmentLandingScreen />);
    await waitFor(() => {
      const img = container.querySelector('img[src="https://example.com/logo.png"]');
      expect(img).not.toBeNull();
    });
  });

  it('renders welcome message when present', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockPreview, welcomeMessage: 'Welcome to our assessment!' }),
    });

    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Welcome to our assessment!').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders singular "challenge" for count of 1', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockPreview, challengeCount: 1 }),
    });

    const { AssessmentLandingScreen } = await import('./AssessmentLandingScreen');
    render(<AssessmentLandingScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('1 coding challenge').length).toBeGreaterThanOrEqual(1);
    });
  });
});
