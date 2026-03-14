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

vi.mock('@/shared/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#gold', border: '#ccc',
    borderStrong: '#999', card: '#fff', muted: '#f5f5f5',
    primary: '#000', primaryForeground: '#fff', secondary: '#eee',
    secondaryForeground: '#000', destructive: '#f00',
  }),
}));

const mockIsDesktopFn = vi.fn(() => false);
vi.mock('@/shared/hooks/useWindowWidth', () => ({
  useIsDesktop: () => mockIsDesktopFn(),
}));

vi.mock('@/shared/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
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
    expect(screen.getByText('404')).toBeTruthy();
    expect(screen.getByText('Page not found')).toBeTruthy();
    expect(screen.getByText(/doesn't exist or has been moved/)).toBeTruthy();
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
    fireEvent.click(screen.getByText('Go Home'));
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
  });

  it('navigates to Challenges when "Browse Problems" is clicked', () => {
    render(<NotFoundScreen />);
    fireEvent.click(screen.getByText('Browse Problems'));
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  it('navigates to Login when "Sign In" is clicked', () => {
    render(<NotFoundScreen />);
    fireEvent.click(screen.getByText('Sign In'));
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
