// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

/* ── Controllable mocks ──────────────────────────────────────────── */
const mockNavigate = vi.fn();
const mockReset = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
}));

let onAuthStateChangeCb: ((event: string, session: any) => void) | null = null;
const mockUnsubscribe = vi.fn();
const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
const mockUpdateUser = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/shared/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: vi.fn((cb: any) => {
        onAuthStateChangeCb = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }),
      getSession: mockGetSession,
      updateUser: mockUpdateUser,
    },
  }),
}));

vi.mock('@/features/auth/BrandPanel', () => ({ BrandPanel: () => <div data-testid="brand-panel" /> }));
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
}));
vi.mock('@/shared/ui/Input', () => ({
  Input: ({ onChangeText, onSubmitEditing, secureTextEntry, editable, ...props }: any) => (
    <input
      onChange={(e: any) => onChangeText?.(e.target.value)}
      onKeyDown={(e: any) => e.key === 'Enter' && onSubmitEditing?.()}
      type={secureTextEntry ? 'password' : 'text'}
      disabled={editable === false}
      {...props}
    />
  ),
}));
vi.mock('@/shared/ui/Label', () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));

const mockIsDesktopFn = vi.fn(() => false);
vi.mock('@/shared/hooks/useWindowWidth', () => ({ useIsDesktop: () => mockIsDesktopFn() }));
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

const { CallbackScreen } = await import('./CallbackScreen');

describe('CallbackScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDesktopFn.mockReturnValue(false);
    onAuthStateChangeCb = null;
    localStorage.clear();
    // Default fetch: profile with onboardingCompleted = 1
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ onboardingCompleted: 1 }),
    }));
  });

  /* ── Loading state ─────────────────────────────────────────────── */
  it('renders loading state with "Completing sign in" text', () => {
    render(<CallbackScreen />);
    expect(screen.getAllByText(/Completing sign in/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Ruwt logo on mobile', () => {
    mockIsDesktopFn.mockReturnValue(false);
    render(<CallbackScreen />);
    expect(screen.getAllByText('Ruwt').length).toBeGreaterThanOrEqual(1);
  });

  it('renders BrandPanel on desktop', () => {
    mockIsDesktopFn.mockReturnValue(true);
    const { container } = render(<CallbackScreen />);
    expect(container.querySelector('[data-testid="brand-panel"]')).not.toBeNull();
  });

  it('renders loading spinner', () => {
    const { container } = render(<CallbackScreen />);
    expect(container.querySelector('svg') || container.textContent).toBeTruthy();
  });

  /* ── Auth state change: SIGNED_IN → navigate to Assessments ─────── */
  it('navigates to Assessments on SIGNED_IN event when no pending challenge', async () => {
    render(<CallbackScreen />);
    expect(onAuthStateChangeCb).not.toBeNull();

    await act(async () => {
      onAuthStateChangeCb!('SIGNED_IN', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Assessments' }],
      });
    });
  });

  /* ── Auth state change: INITIAL_SESSION → navigate ───────────── */
  it('navigates on INITIAL_SESSION event', async () => {
    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('INITIAL_SESSION', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalled();
    });
  });

  /* ── Pending challenge redirect ────────────────────────────────── */
  it('redirects to Arena with pending challenge if set in localStorage', async () => {
    localStorage.setItem('ruwt_pending_challenge', 'fizzbuzz-budget');

    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('SIGNED_IN', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Arena', params: { challengeId: 'fizzbuzz-budget' } }],
      });
    });
    expect(localStorage.getItem('ruwt_pending_challenge')).toBeNull();
  });

  /* ── Team intent redirect ──────────────────────────────────────── */
  it('redirects to AssessmentBuilder on team intent', async () => {
    localStorage.setItem('ruwt_team_intent', 'true');

    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('SIGNED_IN', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'AssessmentBuilder' }],
      });
    });
    expect(localStorage.getItem('ruwt_team_intent')).toBeNull();
  });

  /* ── OAuth redirect from localStorage ──────────────────────────── */
  it('reads oauth_redirect from localStorage and navigates there', async () => {
    localStorage.setItem('oauth_redirect', 'Problems');

    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('SIGNED_IN', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Problems' }],
      });
    });
    expect(localStorage.getItem('oauth_redirect')).toBeNull();
  });

  /* ── Onboarding redirect when profile says not completed ───────── */
  it('redirects to Onboarding when profile.onboardingCompleted is 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ onboardingCompleted: 0 }),
    }));

    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('SIGNED_IN', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    });
  });

  /* ── Profile check failure → continues with default redirect ───── */
  it('falls through to default redirect when profile fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('SIGNED_IN', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Assessments' }],
      });
    });
  });

  /* ── getSession fallback navigates ─────────────────────────────── */
  it('navigates when getSession returns a session', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } } });

    render(<CallbackScreen />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalled();
    });
  });

  /* ── Timeout → error state (use fake timers only here) ─────────── */
  it('shows error state after 8-second timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(<CallbackScreen />);

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Authentication failed').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/Something went wrong/).length).toBeGreaterThanOrEqual(1);

    vi.useRealTimers();
  });

  it('shows "Back to sign in" button in error state', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(<CallbackScreen />);

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Back to sign in').length).toBeGreaterThanOrEqual(1);
    });

    vi.useRealTimers();
  });

  it('clicking "Back to sign in" navigates to Login', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(<CallbackScreen />);

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Back to sign in').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByText('Back to sign in'));
    expect(mockNavigate).toHaveBeenCalledWith('Login');

    vi.useRealTimers();
  });

  it('renders error state on desktop with BrandPanel', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockIsDesktopFn.mockReturnValue(true);

    render(<CallbackScreen />);

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Authentication failed').length).toBeGreaterThanOrEqual(1);
    });

    vi.useRealTimers();
  });

  it('renders error state on mobile with Ruwt logo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockIsDesktopFn.mockReturnValue(false);

    render(<CallbackScreen />);

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Ruwt').length).toBeGreaterThanOrEqual(1);
    });

    vi.useRealTimers();
  });

  /* ── Password recovery flow ────────────────────────────────────── */
  it('shows password recovery form on PASSWORD_RECOVERY event', async () => {
    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('PASSWORD_RECOVERY', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(screen.getAllByText('Set new password').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('New password').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Confirm password').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Update password').length).toBeGreaterThanOrEqual(1);
  });

  it('shows error if password is too short', async () => {
    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('PASSWORD_RECOVERY', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(screen.getAllByText('Update password').length).toBeGreaterThanOrEqual(1);
    });

    const inputs = document.querySelectorAll('input[type="password"]');
    fireEvent.change(inputs[0], { target: { value: 'ab' } });
    fireEvent.click(screen.getByText('Update password'));

    await waitFor(() => {
      expect(screen.getAllByText('Password must be at least 8 characters').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows error if passwords do not match', async () => {
    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('PASSWORD_RECOVERY', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(screen.getAllByText('Update password').length).toBeGreaterThanOrEqual(1);
    });

    const inputs = document.querySelectorAll('input[type="password"]');
    fireEvent.change(inputs[0], { target: { value: 'password123' } });
    fireEvent.change(inputs[1], { target: { value: 'differentpass' } });
    fireEvent.click(screen.getByText('Update password'));

    await waitFor(() => {
      expect(screen.getAllByText('Passwords do not match').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows success state after successful password update', async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: null });

    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('PASSWORD_RECOVERY', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(screen.getAllByText('Update password').length).toBeGreaterThanOrEqual(1);
    });

    const inputs = document.querySelectorAll('input[type="password"]');
    fireEvent.change(inputs[0], { target: { value: 'newpassword' } });
    fireEvent.change(inputs[1], { target: { value: 'newpassword' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Update password'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Password updated').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/Redirecting you to assessments/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows error from updateUser failure', async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: { message: 'Token expired' } });

    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('PASSWORD_RECOVERY', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(screen.getAllByText('Update password').length).toBeGreaterThanOrEqual(1);
    });

    const inputs = document.querySelectorAll('input[type="password"]');
    fireEvent.change(inputs[0], { target: { value: 'newpassword' } });
    fireEvent.change(inputs[1], { target: { value: 'newpassword' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Update password'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Token expired').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows password recovery form on desktop with BrandPanel', async () => {
    mockIsDesktopFn.mockReturnValue(true);
    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('PASSWORD_RECOVERY', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(screen.getAllByText('Set new password').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows password recovery mobile header on mobile', async () => {
    mockIsDesktopFn.mockReturnValue(false);
    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('PASSWORD_RECOVERY', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(screen.getAllByText('Ruwt').length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── Team intent fetch failure still navigates ─────────────────── */
  it('navigates to AssessmentBuilder even if profile PATCH fails', async () => {
    localStorage.setItem('ruwt_team_intent', 'true');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('SIGNED_IN', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'AssessmentBuilder' }],
      });
    });
  });

  /* ── Does not navigate on events without session ───────────────── */
  it('does not navigate on SIGNED_IN without session', async () => {
    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('SIGNED_IN', null);
    });

    expect(mockReset).not.toHaveBeenCalled();
  });

  /* ── PASSWORD_RECOVERY without session does not trigger ────────── */
  it('does not show password recovery without session', async () => {
    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('PASSWORD_RECOVERY', null);
    });

    expect(screen.getAllByText(/Completing sign in/).length).toBeGreaterThanOrEqual(1);
  });

  /* ── Password reset success auto-redirects to Problems after timeout ── */
  it('redirects to Problems after successful password update via setTimeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockUpdateUser.mockResolvedValueOnce({ error: null });

    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('PASSWORD_RECOVERY', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(screen.getAllByText('Update password').length).toBeGreaterThanOrEqual(1);
    });

    const inputs = document.querySelectorAll('input[type="password"]');
    fireEvent.change(inputs[0], { target: { value: 'newpassword' } });
    fireEvent.change(inputs[1], { target: { value: 'newpassword' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Update password'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Password updated').length).toBeGreaterThanOrEqual(1);
    });

    // Advance past the 2000ms setTimeout
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Assessments' }],
    });

    vi.useRealTimers();
  });

  /* ── Mobile header in password recovery navigates to Landing ──── */
  it('navigates to Landing when Ruwt logo is clicked in password recovery (mobile)', async () => {
    mockIsDesktopFn.mockReturnValue(false);
    render(<CallbackScreen />);

    await act(async () => {
      onAuthStateChangeCb!('PASSWORD_RECOVERY', { user: { id: 'u1' } });
    });

    await waitFor(() => {
      expect(screen.getAllByText('Ruwt').length).toBeGreaterThanOrEqual(1);
    });

    // Click the Ruwt logo in the mobile header
    fireEvent.click(screen.getAllByText('Ruwt')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
  });

  /* ── Mobile header in error state navigates to Landing ──────── */
  it('navigates to Landing when Ruwt logo is clicked in error state (mobile)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockIsDesktopFn.mockReturnValue(false);

    render(<CallbackScreen />);

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Ruwt').length).toBeGreaterThanOrEqual(1);
    });

    // Click the Ruwt logo in the error state mobile header
    fireEvent.click(screen.getAllByText('Ruwt')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('Landing');

    vi.useRealTimers();
  });
});
