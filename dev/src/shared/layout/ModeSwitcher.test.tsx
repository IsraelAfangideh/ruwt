// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeSwitcher } from './ModeSwitcher';

const mockNavigate = vi.fn();

vi.mock('react-native', () => ({
  View: ({ children, testID, ...p }: any) => <div data-testid={testID} {...p}>{children}</div>,
  Text: ({ children, style, testID, ...p }: any) => <span data-testid={testID} style={style} {...p}>{children}</span>,
  Pressable: ({ children, onPress, testID, style, ...p }: any) => <button data-testid={testID} onClick={onPress} style={typeof style === 'function' ? style({ pressed: false, hovered: false }) : style} {...p}>{typeof children === 'function' ? children({ pressed: false }) : children}</button>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const mockSetMode = vi.fn();
let mockAppMode: any = {
  mode: 'practice',
  setMode: mockSetMode,
  profile: null,
  profileLoading: false,
  orgInfo: { id: 'o', name: 'Acme Corp', role: 'admin', subscriptionStatus: 'active', subscriptionPlan: null, subscriptionEndsAt: null, trial: null },
  isOrgMember: true,
  canAccessHiringMode: true,
  refreshProfile: vi.fn(),
};

vi.mock('@/shared/lib/AppModeContext', () => ({
  useAppMode: () => mockAppMode,
}));

describe('ModeSwitcher', () => {
  afterEach(() => {
    mockSetMode.mockClear();
    mockNavigate.mockClear();
    mockAppMode = {
      mode: 'practice',
      setMode: mockSetMode,
      profile: null,
      profileLoading: false,
      orgInfo: { id: 'o', name: 'Acme Corp', role: 'admin', subscriptionStatus: 'active', subscriptionPlan: null, subscriptionEndsAt: null, trial: null },
      isOrgMember: true,
      canAccessHiringMode: true,
      refreshProfile: vi.fn(),
    };
  });

  it('renders nothing when user cannot access hiring mode', () => {
    mockAppMode = { ...mockAppMode, canAccessHiringMode: false };
    const { container } = render(<ModeSwitcher />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the pill with current mode label', () => {
    render(<ModeSwitcher />);
    expect(screen.getByTestId('mode-switcher')).toBeInTheDocument();
    expect(screen.getByText('Practice')).toBeInTheDocument();
  });

  it('shows org name when in hiring mode', () => {
    mockAppMode = { ...mockAppMode, mode: 'hiring' };
    render(<ModeSwitcher />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(<ModeSwitcher />);
    fireEvent.click(screen.getByTestId('mode-switcher'));
    expect(screen.getByTestId('mode-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('mode-option-practice')).toBeInTheDocument();
    expect(screen.getByTestId('mode-option-hiring')).toBeInTheDocument();
  });

  it('switches to hiring mode and navigates', () => {
    render(<ModeSwitcher />);
    fireEvent.click(screen.getByTestId('mode-switcher'));
    fireEvent.click(screen.getByTestId('mode-option-hiring'));
    expect(mockSetMode).toHaveBeenCalledWith('hiring');
    expect(mockNavigate).toHaveBeenCalledWith('Assessments');
  });

  it('switches to practice mode and navigates', () => {
    mockAppMode = { ...mockAppMode, mode: 'hiring' };
    render(<ModeSwitcher />);
    fireEvent.click(screen.getByTestId('mode-switcher'));
    fireEvent.click(screen.getByTestId('mode-option-practice'));
    expect(mockSetMode).toHaveBeenCalledWith('practice');
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  it('does not call setMode when selecting current mode', () => {
    render(<ModeSwitcher />);
    fireEvent.click(screen.getByTestId('mode-switcher'));
    fireEvent.click(screen.getByTestId('mode-option-practice'));
    expect(mockSetMode).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('closes dropdown on Escape key', () => {
    render(<ModeSwitcher />);
    fireEvent.click(screen.getByTestId('mode-switcher'));
    expect(screen.getByTestId('mode-dropdown')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('mode-dropdown')).toBeNull();
  });

  it('closes dropdown when overlay is clicked', () => {
    const { container } = render(<ModeSwitcher />);
    fireEvent.click(screen.getByTestId('mode-switcher'));
    expect(screen.getByTestId('mode-dropdown')).toBeInTheDocument();
    const overlay = container.querySelector('[accessibilitylabel="Close mode switcher"]') as HTMLElement;
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay);
    expect(screen.queryByTestId('mode-dropdown')).toBeNull();
  });

  it('shows "Hiring" fallback when orgInfo has no name', () => {
    mockAppMode = {
      ...mockAppMode,
      canAccessHiringMode: true,
      isOrgMember: true,
      orgInfo: { id: 'o', name: null as any, role: 'admin', subscriptionStatus: 'active', subscriptionPlan: null, subscriptionEndsAt: null, trial: null },
    };
    render(<ModeSwitcher />);
    fireEvent.click(screen.getByTestId('mode-switcher'));
    expect(screen.getByText('Hiring')).toBeInTheDocument();
  });
});
