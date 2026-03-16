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
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

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
      fireEvent.click(screen.getByRole('button', { name: 'Accept Invitation' }));
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
      fireEvent.click(screen.getByRole('button', { name: 'Accept Invitation' }));
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
      fireEvent.click(screen.getByRole('button', { name: 'Accept Invitation' }));
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
      fireEvent.click(screen.getByRole('button', { name: 'Accept Invitation' }));
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
      fireEvent.click(screen.getByRole('button', { name: 'Accept Invitation' }));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Network error').length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── navigation after successful join ───────────────── */
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
      fireEvent.click(screen.getByRole('button', { name: 'Accept Invitation' }));
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
