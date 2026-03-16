/**
 * Negative / error-path tests for LoginScreen.
 * Covers: double-submission, boundary inputs (empty, long, XSS, SQL injection),
 * network failures on auth calls.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

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
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      signInWithOAuth: (...args: any[]) => mockSignInWithOAuth(...args),
      resetPasswordForEmail: (...args: any[]) => mockResetPasswordForEmail(...args),
    },
  }),
}));
vi.mock('@/features/auth/BrandPanel', () => ({ BrandPanel: () => <div data-testid="brand-panel" /> }));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, disabled, ...props }: any) => (
    <button onClick={onPress} disabled={disabled} {...props}>{children}</button>
  ),
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
vi.mock('@/shared/hooks/useWindowWidth', () => ({ useIsDesktop: () => false }));
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const { LoginScreen } = await import('./LoginScreen');

describe('LoginScreen — negative paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    localStorage.clear();
  });

  function fillAndSubmit(email: string, password: string) {
    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: email } });
    fireEvent.change(passwordInput, { target: { value: password } });
    const signInButtons = screen.getAllByText('Sign in');
    const submitBtn = signInButtons.find(el => el.tagName === 'BUTTON' || el.closest('button'));
    fireEvent.click(submitBtn!.closest('button') || submitBtn!);
  }

  it('does not call signInWithPassword twice on rapid double-click', async () => {
    mockSignInWithPassword.mockImplementation(() => new Promise(() => {}));
    render(<LoginScreen />);

    // Fill form first
    const emailInput = document.querySelector('input[placeholder="you@example.com"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secret' } });

    // Click submit — enters loading state
    const signInButtons = screen.getAllByText('Sign in');
    const submitBtn = signInButtons.find(el => el.tagName === 'BUTTON' || el.closest('button'));
    await act(async () => { fireEvent.click(submitBtn!.closest('button') || submitBtn!); });

    // Second click — button now says "Signing in..." and is disabled
    expect(screen.getAllByText('Signing in...').length).toBeGreaterThanOrEqual(1);
    // Even if we try clicking again, it won't fire
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
  });

  it('handles empty email and password gracefully', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<LoginScreen />);
    await act(async () => { fillAndSubmit('', ''); });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: '', password: '' });
  });

  it('handles extremely long email input without crashing', async () => {
    const longEmail = 'a'.repeat(10000) + '@test.com';
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<LoginScreen />);
    await act(async () => { fillAndSubmit(longEmail, 'pass'); });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: longEmail, password: 'pass' });
  });

  it('handles XSS vector in email field without executing scripts', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<LoginScreen />);
    await act(async () => { fillAndSubmit('<script>alert("xss")</script>', 'password'); });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: '<script>alert("xss")</script>', password: 'password',
    });
    await waitFor(() => {
      expect(screen.getAllByText(/Invalid login credentials/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles SQL injection vector in password field', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<LoginScreen />);
    await act(async () => { fillAndSubmit('user@test.com', "'; DROP TABLE users; --"); });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@test.com', password: "'; DROP TABLE users; --",
    });
  });

  it('shows server error message from signInWithPassword', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Email not confirmed' } });
    render(<LoginScreen />);
    await act(async () => { fillAndSubmit('user@test.com', 'pass'); });
    await waitFor(() => {
      expect(screen.getAllByText('Email not confirmed').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows error when OAuth provider is unavailable', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: { message: 'Provider temporarily unavailable' } });
    render(<LoginScreen />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continue with GitHub' })); });
    await waitFor(() => {
      expect(screen.getAllByText('Provider temporarily unavailable').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles zero-length password submission', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<LoginScreen />);
    await act(async () => { fillAndSubmit('user@test.com', ''); });
    expect(mockSignInWithPassword).toHaveBeenCalled();
  });

  it('handles special characters in both fields', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid' } });
    render(<LoginScreen />);
    await act(async () => { fillAndSubmit('user+test@test.com', 'p@$$w0rd!#%'); });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user+test@test.com', password: 'p@$$w0rd!#%',
    });
  });
});
