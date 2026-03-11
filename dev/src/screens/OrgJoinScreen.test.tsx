// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockReset = vi.fn();
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } });

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
  useRoute: () => ({ params: { token: 'test-join-token' } }),
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
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
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

const { OrgJoinScreen } = await import('./OrgJoinScreen');

describe('OrgJoinScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    localStorage.clear();
  });

  /* ── Basic rendering ───────────────────────────────────────────── */
  it('renders Join Team heading', async () => {
    render(<OrgJoinScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Join Team').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders invitation description', async () => {
    render(<OrgJoinScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/invited to join an organization/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders Accept Invitation button', async () => {
    render(<OrgJoinScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Accept Invitation').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders info text about team access', async () => {
    render(<OrgJoinScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/add you to the team/).length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── Redirect to login if no user ──────────────────────────────── */
  it('redirects to Login when no user is authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    render(<OrgJoinScreen />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    });
  });

  it('stores token in localStorage when redirecting to login', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    render(<OrgJoinScreen />);

    await waitFor(() => {
      expect(localStorage.getItem('ruwt_org_join_token')).toBe('test-join-token');
    });
  });

  /* ── Successful join ───────────────────────────────────────────── */
  it('shows success message after joining', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    }));

    render(<OrgJoinScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Accept Invitation').length).toBeGreaterThanOrEqual(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Accept Invitation'));
    });

    await waitFor(() => {
      expect(screen.getAllByText(/joined the team/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows "Joining..." while request is in progress', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    render(<OrgJoinScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Accept Invitation').length).toBeGreaterThanOrEqual(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Accept Invitation'));
    });

    expect(screen.getAllByText('Joining...').length).toBeGreaterThanOrEqual(1);
  });

  /* ── Error handling ────────────────────────────────────────────── */
  it('shows error from server response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Token expired' }),
    }));

    render(<OrgJoinScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Accept Invitation').length).toBeGreaterThanOrEqual(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Accept Invitation'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Token expired').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows default error message when server error has no message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    }));

    render(<OrgJoinScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Accept Invitation').length).toBeGreaterThanOrEqual(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Accept Invitation'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Failed to join organization').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows network error on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection failed')));

    render(<OrgJoinScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Accept Invitation').length).toBeGreaterThanOrEqual(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Accept Invitation'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Network error').length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── Navigation after successful join (line 50) ───────────────── */
  it('navigates to Assessments after successful join via setTimeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    }));

    render(<OrgJoinScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Accept Invitation').length).toBeGreaterThanOrEqual(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Accept Invitation'));
    });

    await waitFor(() => {
      expect(screen.getAllByText(/joined the team/).length).toBeGreaterThanOrEqual(1);
    });

    // Advance past the 2000ms setTimeout
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Assessments' }],
    });
    vi.useRealTimers();
  });

  /* ── Loading state ─────────────────────────────────────────────── */
  it('shows loading spinner while checking auth', () => {
    // getUser never resolves
    mockGetUser.mockReturnValueOnce(new Promise(() => {}));

    const { container } = render(<OrgJoinScreen />);
    expect(container.querySelector('[data-testid="skeleton-detail"]')).not.toBeNull();
  });
});
