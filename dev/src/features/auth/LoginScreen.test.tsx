// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

/* ── Controllable mocks ──────────────────────────────────────────── */
const mockNavigate = vi.fn();
const mockReset = vi.fn();
const mockSignInWithPassword = vi.fn().mockResolvedValue({ error: null });
const mockSignInWithOAuth = vi.fn().mockResolvedValue({ error: null });
const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
  useRoute: () => ({ params: {} }),
}));

vi.mock('@/shared/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signInWithOAuth: mockSignInWithOAuth,
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  }),
}));

vi.mock('@/features/auth/BrandPanel', () => ({ BrandPanel: () => <div data-testid="brand-panel" /> }));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));

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

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

const mockIsDesktopFn = vi.fn(() => false);
vi.mock('@/shared/hooks/useWindowWidth', () => ({ useIsDesktop: () => mockIsDesktopFn() }));

vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const { LoginScreen } = await import('./LoginScreen');

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDesktopFn.mockReturnValue(false);
    localStorage.clear();
  });

  /* ── Basic rendering ───────────────────────────────────────────── */
  it('renders sign-in heading and input labels', () => {
    render(<LoginScreen />);
    expect(screen.getAllByText('Sign in').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
  });

  it('renders GitHub OAuth button', () => {
    render(<LoginScreen />);
    expect(screen.getAllByText('Continue with GitHub').length).toBeGreaterThanOrEqual(1);
  });

  it('renders email input placeholder', () => {
    const { container } = render(<LoginScreen />);
    expect(container.querySelector('input[placeholder="you@example.com"]')).not.toBeNull();
  });

  it('shows BrandPanel on desktop', () => {
    mockIsDesktopFn.mockReturnValue(true);
    const { container } = render(<LoginScreen />);
    expect(container.querySelector('[data-testid="brand-panel"]')).not.toBeNull();
  });

  it('shows mobile Ruwt logo on mobile', () => {
    mockIsDesktopFn.mockReturnValue(false);
    render(<LoginScreen />);
    expect(screen.getAllByText('Ruwt').length).toBeGreaterThanOrEqual(1);
  });

  it('renders subtitle text', () => {
    render(<LoginScreen />);
    expect(screen.getAllByText(/Sign in to your account/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Sign up link', () => {
    render(<LoginScreen />);
    expect(screen.getAllByText('Sign up').length).toBeGreaterThanOrEqual(1);
  });

  it('renders "or" divider', () => {
    render(<LoginScreen />);
    expect(screen.getAllByText('or').length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Forgot password?" link', () => {
    render(<LoginScreen />);
    expect(screen.getAllByText('Forgot password?').length).toBeGreaterThanOrEqual(1);
  });

  /* ── Email login flow ──────────────────────────────────────────── */
  it('calls signInWithPassword on form submission', async () => {
    render(<LoginScreen />);

    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    // The "Sign in" text appears both as heading and button; use getAllByText + find the button
    const signInButtons = screen.getAllByText('Sign in');
    const submitBtn = signInButtons.find(el => el.tagName === 'BUTTON' || el.closest('button'));

    await act(async () => {
      fireEvent.click(submitBtn!.closest('button') || submitBtn!);
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'secret123',
    });
  });

  it('resets navigation to Dashboard on successful login', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });

    render(<LoginScreen />);

    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    const signInButtons = screen.getAllByText('Sign in');
    const submitBtn = signInButtons.find(el => el.tagName === 'BUTTON' || el.closest('button'));

    await act(async () => {
      fireEvent.click(submitBtn!.closest('button') || submitBtn!);
    });

    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Assessments' }],
    });
  });

  it('shows error message on failed login', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid credentials' },
    });

    render(<LoginScreen />);

    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });

    const signInButtons = screen.getAllByText('Sign in');
    const submitBtn = signInButtons.find(el => el.tagName === 'BUTTON' || el.closest('button'));

    await act(async () => {
      fireEvent.click(submitBtn!.closest('button') || submitBtn!);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Invalid credentials').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows "Signing in..." while loading', async () => {
    // Never resolves to keep loading state
    mockSignInWithPassword.mockReturnValueOnce(new Promise(() => {}));

    render(<LoginScreen />);

    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    const signInButtons = screen.getAllByText('Sign in');
    const submitBtn = signInButtons.find(el => el.tagName === 'BUTTON' || el.closest('button'));

    await act(async () => {
      fireEvent.click(submitBtn!.closest('button') || submitBtn!);
    });

    expect(screen.getAllByText('Signing in...').length).toBeGreaterThanOrEqual(1);
  });

  /* ── OAuth flow ────────────────────────────────────────────────── */
  it('calls signInWithOAuth for GitHub on button click', async () => {
    render(<LoginScreen />);

    await act(async () => {
      fireEvent.click(screen.getByText('Continue with GitHub'));
    });

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: { redirectTo: expect.stringContaining('/callback') },
    });
  });

  it('stores oauth_redirect in localStorage on OAuth', async () => {
    render(<LoginScreen />);

    await act(async () => {
      fireEvent.click(screen.getByText('Continue with GitHub'));
    });

    // Default redirectTo is 'Assessments'
    expect(localStorage.getItem('oauth_redirect')).toBe('Assessments');
  });

  it('shows error when OAuth fails', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({
      error: { message: 'OAuth provider unavailable' },
    });

    render(<LoginScreen />);

    await act(async () => {
      fireEvent.click(screen.getByText('Continue with GitHub'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('OAuth provider unavailable').length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── Forgot password flow ──────────────────────────────────────── */
  it('shows error when forgot password clicked without email', async () => {
    render(<LoginScreen />);

    await act(async () => {
      fireEvent.click(screen.getByText('Forgot password?'));
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Enter your email address first/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('sends password reset email', async () => {
    render(<LoginScreen />);

    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@test.com' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Forgot password?'));
    });

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@test.com', {
      redirectTo: expect.stringContaining('/callback'),
    });
  });

  it('shows success message after reset email sent', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });

    render(<LoginScreen />);

    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@test.com' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Forgot password?'));
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Password reset link sent/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows error when reset email fails', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({
      error: { message: 'Rate limit exceeded' },
    });

    render(<LoginScreen />);

    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@test.com' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Forgot password?'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Rate limit exceeded').length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── Navigation links ──────────────────────────────────────────── */
  it('navigates to Register when "Sign up" is clicked', () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByText('Sign up'));
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to Landing when mobile Ruwt logo is clicked', () => {
    mockIsDesktopFn.mockReturnValue(false);
    render(<LoginScreen />);
    fireEvent.click(screen.getByText('Ruwt'));
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
  });

  /* ── Desktop does not show Ruwt mobile logo ────────────────────── */
  it('does not show Ruwt mobile logo on desktop', () => {
    mockIsDesktopFn.mockReturnValue(true);
    render(<LoginScreen />);
    // Ruwt text should NOT appear on desktop (BrandPanel handles branding)
    const ruwtTexts = screen.queryAllByText('Ruwt');
    // On desktop mode, Ruwt text should not appear in the form panel
    // BrandPanel is mocked out, so we check there is no inline Ruwt text
    expect(ruwtTexts.length).toBe(0);
  });

  /* ── Submit on Enter key ───────────────────────────────────────── */
  it('submits form on Enter key in password field', async () => {
    render(<LoginScreen />);

    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    await act(async () => {
      fireEvent.keyDown(passwordInput, { key: 'Enter' });
    });

    expect(mockSignInWithPassword).toHaveBeenCalled();
  });
});
