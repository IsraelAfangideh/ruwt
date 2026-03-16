// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/* ── Mocks ─────────────────────────────────────────────────────────── */

const mockNavigate = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

vi.mock('@/features/auth/BrandPanel', () => ({
  BrandPanel: () => <div data-testid="brand-panel" />,
}));

vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
}));

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const mockIsDesktopFn = vi.fn(() => false);
vi.mock('@/shared/hooks/useWindowWidth', () => ({
  useIsDesktop: () => mockIsDesktopFn(),
}));

/* ── Lazy import AFTER mocks are set up ──────────────────────────── */
const { NotFoundScreen } = await import('./NotFoundScreen');

/* ── Tests ──────────────────────────────────────────────────────────── */

describe('NotFoundScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDesktopFn.mockReturnValue(false);
  });

  it('renders 404 code and page-not-found messaging', () => {
    render(<NotFoundScreen />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByText(/doesn't exist or has been moved/)).toBeInTheDocument();
  });

  it('renders all navigation link text', () => {
    render(<NotFoundScreen />);
    expect(screen.getAllByText('Go Home').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Browse Problems').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sign In').length).toBeGreaterThanOrEqual(1);
  });

  it('shows BrandPanel on desktop', () => {
    mockIsDesktopFn.mockReturnValue(true);
    const { container } = render(<NotFoundScreen />);
    expect(container.querySelector('[data-testid="brand-panel"]')).not.toBeNull();
  });

  it('renders Ruwt logo on mobile', () => {
    mockIsDesktopFn.mockReturnValue(false);
    render(<NotFoundScreen />);
    expect(screen.getAllByText('Ruwt').length).toBeGreaterThanOrEqual(1);
  });

  /* ── Navigation actions ────────────────────────────────────────── */
  it('navigates to Landing when "Go Home" is clicked', () => {
    render(<NotFoundScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Go Home' }));
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
  });

  it('navigates to Challenges when "Browse Problems" is clicked', () => {
    render(<NotFoundScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Browse Problems' }));
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  it('navigates to Login when "Sign In" is clicked', () => {
    render(<NotFoundScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('navigates to Landing when mobile Ruwt logo is clicked', () => {
    mockIsDesktopFn.mockReturnValue(false);
    render(<NotFoundScreen />);
    fireEvent.click(screen.getByText('Ruwt'));
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
  });

  /* ── Desktop does not show mobile logo ─────────────────────────── */
  it('does not render Ruwt mobile logo on desktop', () => {
    mockIsDesktopFn.mockReturnValue(true);
    render(<NotFoundScreen />);
    expect(screen.queryAllByText('Ruwt').length).toBe(0);
  });

  /* ── Does not show BrandPanel on mobile ────────────────────────── */
  it('does not show BrandPanel on mobile', () => {
    mockIsDesktopFn.mockReturnValue(false);
    const { container } = render(<NotFoundScreen />);
    expect(container.querySelector('[data-testid="brand-panel"]')).toBeNull();
  });
});
