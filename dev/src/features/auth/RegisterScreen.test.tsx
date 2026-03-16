// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

/* ── Controllable mocks ──────────────────────────────────────────── */
const mockNavigate = vi.fn();
const mockSignUp = vi.fn().mockResolvedValue({ error: null });
const mockSignInWithOAuth = vi.fn().mockResolvedValue({ error: null });

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
vi.mock('@/shared/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
      signInWithOAuth: mockSignInWithOAuth,
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

const { RegisterScreen } = await import('./RegisterScreen');

describe('RegisterScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDesktopFn.mockReturnValue(false);
  });

  /* ── Basic rendering ───────────────────────────────────────────── */
  it('renders the registration form with name, email, password fields', () => {
    render(<RegisterScreen />);
    expect(screen.getAllByText(/Create your account/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
  });

  it('renders free practice badge', () => {
    render(<RegisterScreen />);
    expect(screen.getAllByText(/Free to practice/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders GitHub OAuth button', () => {
    render(<RegisterScreen />);
    expect(screen.getAllByText('Continue with GitHub').length).toBeGreaterThanOrEqual(1);
  });

  it('renders password hint', () => {
    render(<RegisterScreen />);
    expect(screen.getAllByText(/at least 8 characters/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows BrandPanel on desktop', () => {
    mockIsDesktopFn.mockReturnValue(true);
    const { container } = render(<RegisterScreen />);
    expect(container.querySelector('[data-testid="brand-panel"]')).not.toBeNull();
  });

  it('shows Ruwt logo on mobile', () => {
    mockIsDesktopFn.mockReturnValue(false);
    render(<RegisterScreen />);
    expect(screen.getAllByText('Ruwt').length).toBeGreaterThanOrEqual(1);
  });

  it('renders subtitle text', () => {
    render(<RegisterScreen />);
    expect(screen.getAllByText(/Start competing in under a minute/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders "or" divider', () => {
    render(<RegisterScreen />);
    expect(screen.getAllByText('or').length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Sign in" link for existing users', () => {
    render(<RegisterScreen />);
    expect(screen.getAllByText('Sign in').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Create account button', () => {
    render(<RegisterScreen />);
    expect(screen.getAllByRole('button', { name: 'Create account' }).length).toBeGreaterThanOrEqual(1);
  });

  /* ── Registration form submission ──────────────────────────────── */
  it('calls signUp with correct data on form submission', async () => {
    render(<RegisterScreen />);

    const nameInput = document.querySelector('input[placeholder="Your name"]') as HTMLInputElement;
    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });
    fireEvent.change(emailInput, { target: { value: 'jane@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'jane@test.com',
      password: 'password123',
      options: {
        data: { name: 'Jane Doe' },
        emailRedirectTo: expect.stringContaining('/callback'),
      },
    });
  });

  it('shows success screen with "Check your email" after successful signup', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null });

    render(<RegisterScreen />);

    const nameInput = document.querySelector('input[placeholder="Your name"]') as HTMLInputElement;
    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: 'Jane' } });
    fireEvent.change(emailInput, { target: { value: 'jane@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Check your email').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/jane@test.com/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Click the link in your email/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Back to sign in" button on success screen', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null });

    render(<RegisterScreen />);

    const nameInput = document.querySelector('input[placeholder="Your name"]') as HTMLInputElement;
    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: 'Jane' } });
    fireEvent.change(emailInput, { target: { value: 'jane@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Back to sign in').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('shows success screen on desktop with BrandPanel', async () => {
    mockIsDesktopFn.mockReturnValue(true);
    mockSignUp.mockResolvedValueOnce({ error: null });

    render(<RegisterScreen />);

    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'jane@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Check your email').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows success screen on mobile with Ruwt logo', async () => {
    mockIsDesktopFn.mockReturnValue(false);
    mockSignUp.mockResolvedValueOnce({ error: null });

    render(<RegisterScreen />);

    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'jane@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Ruwt').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('navigates to Landing when mobile logo is clicked on success screen', async () => {
    mockIsDesktopFn.mockReturnValue(false);
    mockSignUp.mockResolvedValueOnce({ error: null });

    render(<RegisterScreen />);

    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'jane@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Check your email').length).toBeGreaterThanOrEqual(1);
    });

    // Click the Ruwt logo in the success screen mobile header
    fireEvent.click(screen.getByText('Ruwt'));
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
  });

  it('shows error message on signup failure', async () => {
    mockSignUp.mockResolvedValueOnce({
      error: { message: 'Email already registered' },
    });

    render(<RegisterScreen />);

    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'existing@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Email already registered').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows "Creating account..." while loading', async () => {
    mockSignUp.mockReturnValueOnce(new Promise(() => {}));

    render(<RegisterScreen />);

    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    });

    expect(screen.getAllByRole('button', { name: 'Creating account...' }).length).toBeGreaterThanOrEqual(1);
  });

  /* ── OAuth flow ────────────────────────────────────────────────── */
  it('calls signInWithOAuth for GitHub', async () => {
    render(<RegisterScreen />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue with GitHub' }));
    });

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: { redirectTo: expect.stringContaining('/callback') },
    });
  });

  it('shows error when OAuth fails', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({
      error: { message: 'Provider error' },
    });

    render(<RegisterScreen />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue with GitHub' }));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Provider error').length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── Navigation ────────────────────────────────────────────────── */
  it('navigates to Login when "Sign in" is clicked', () => {
    render(<RegisterScreen />);
    fireEvent.click(screen.getByText('Sign in'));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('navigates to Landing when mobile Ruwt logo is clicked', () => {
    mockIsDesktopFn.mockReturnValue(false);
    render(<RegisterScreen />);
    fireEvent.click(screen.getByText('Ruwt'));
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
  });

  /* ── Desktop hides mobile elements ─────────────────────────────── */
  it('does not show Ruwt mobile logo on desktop', () => {
    mockIsDesktopFn.mockReturnValue(true);
    render(<RegisterScreen />);
    expect(screen.queryAllByText('Ruwt').length).toBe(0);
  });

  /* ── Submit on Enter key ───────────────────────────────────────── */
  it('submits form on Enter key in password field', async () => {
    render(<RegisterScreen />);

    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    await act(async () => {
      fireEvent.keyDown(passwordInput, { key: 'Enter' });
    });

    expect(mockSignUp).toHaveBeenCalled();
  });

  /* ── Error handling / negative tests ─────────────────────────────── */

  describe('error handling', () => {
    it('shows error when signup returns auth error', async () => {
      mockSignUp.mockResolvedValue({ error: { message: 'Email already registered' } });
      render(<RegisterScreen />);
      const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: 'taken@test.com' } });
      fireEvent.change(passwordInput, { target: { value: 'pass1234' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create account' })); });
      await waitFor(() => { expect(screen.getByText('Email already registered')).toBeInTheDocument(); });
    });

    it('shows error when signup returns server error message', async () => {
      mockSignUp.mockResolvedValue({ error: { message: 'Server unavailable' } });
      render(<RegisterScreen />);
      const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
      fireEvent.change(passwordInput, { target: { value: 'pass1234' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create account' })); });
      await waitFor(() => { expect(screen.getByText('Server unavailable')).toBeInTheDocument(); });
    });

    it('shows error when GitHub OAuth returns error', async () => {
      mockSignInWithOAuth.mockResolvedValue({ error: { message: 'OAuth denied' } });
      render(<RegisterScreen />);
      await act(async () => { fireEvent.click(screen.getByText(/Continue with GitHub/)); });
      await waitFor(() => { expect(screen.getByText('OAuth denied')).toBeInTheDocument(); });
    });

    it('handles signup with empty email by showing validation error', async () => {
      mockSignUp.mockResolvedValue({ error: { message: 'Email is required' } });
      render(<RegisterScreen />);
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
      fireEvent.change(passwordInput, { target: { value: 'pass1234' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create account' })); });
      // Component submits; Supabase returns error for empty email
      await waitFor(() => { expect(screen.getByText('Email is required')).toBeInTheDocument(); });
    });

    it('handles signup with empty password by showing validation error', async () => {
      mockSignUp.mockResolvedValue({ error: { message: 'Password is required' } });
      render(<RegisterScreen />);
      const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create account' })); });
      await waitFor(() => { expect(screen.getByText('Password is required')).toBeInTheDocument(); });
    });

    it('handles signup with both fields empty', async () => {
      mockSignUp.mockResolvedValue({ error: { message: 'Credentials required' } });
      render(<RegisterScreen />);
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create account' })); });
      await waitFor(() => { expect(screen.getByText('Credentials required')).toBeInTheDocument(); });
    });

    it('shows error for weak password', async () => {
      mockSignUp.mockResolvedValue({ error: { message: 'Password too weak' } });
      render(<RegisterScreen />);
      const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
      fireEvent.change(passwordInput, { target: { value: '123' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create account' })); });
      await waitFor(() => { expect(screen.getByText('Password too weak')).toBeInTheDocument(); });
    });

    it('handles GitHub OAuth failure response', async () => {
      mockSignInWithOAuth.mockResolvedValue({ error: { message: 'GitHub service unavailable' } });
      render(<RegisterScreen />);
      await act(async () => { fireEvent.click(screen.getByText(/Continue with GitHub/)); });
      await waitFor(() => { expect(screen.getByText('GitHub service unavailable')).toBeInTheDocument(); });
    });

    it('handles signup with very long email', async () => {
      render(<RegisterScreen />);
      const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: 'a'.repeat(300) + '@test.com' } });
      fireEvent.change(passwordInput, { target: { value: 'longpassword' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create account' })); });
      expect(mockSignUp).toHaveBeenCalled();
    });

    it('shows rate limit error', async () => {
      mockSignUp.mockResolvedValue({ error: { message: 'Rate limit exceeded' } });
      render(<RegisterScreen />);
      const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
      fireEvent.change(passwordInput, { target: { value: 'pass1234' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create account' })); });
      await waitFor(() => { expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument(); });
    });

    it('handles invalid email format gracefully', async () => {
      mockSignUp.mockResolvedValue({ error: { message: 'Invalid email' } });
      render(<RegisterScreen />);
      const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
      fireEvent.change(passwordInput, { target: { value: 'pass1234' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create account' })); });
      await waitFor(() => { expect(screen.getByText('Invalid email')).toBeInTheDocument(); });
    });
  });
});
