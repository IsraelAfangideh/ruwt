// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeSwitcher } from './ModeSwitcher';

const mockNavigate = vi.fn();

vi.mock('react-native', () => ({
  View: ({ children, testID, ...p }: any) => <div data-testid={testID} {...p}>{children}</div>,
  Text: ({ children, style, testID, ...p }: any) => <span data-testid={testID} style={style} {...p}>{children}</span>,
  Pressable: ({ children, onPress, testID, ...p }: any) => <button data-testid={testID} onClick={onPress} {...p}>{typeof children === 'function' ? children({ pressed: false }) : children}</button>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

vi.mock('@/theme', () => ({
  useColors: () => ({
    text: '#000', textMuted: '#888', muted: '#ddd', border: '#ccc', card: '#fff',
  }),
}));

vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16 },
  fontSizes: { xs: 12, sm: 14 },
  fontFamily: { body: 'sans-serif' },
}));

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

vi.mock('@/lib/AppModeContext', () => ({
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
    expect(screen.getByTestId('mode-switcher')).toBeTruthy();
    expect(screen.getByText('Practice')).toBeTruthy();
  });

  it('shows org name when in hiring mode', () => {
    mockAppMode = { ...mockAppMode, mode: 'hiring' };
    render(<ModeSwitcher />);
    expect(screen.getByText('Acme Corp')).toBeTruthy();
  });

  it('opens dropdown on click', () => {
    render(<ModeSwitcher />);
    fireEvent.click(screen.getByTestId('mode-switcher'));
    expect(screen.getByTestId('mode-dropdown')).toBeTruthy();
    expect(screen.getByTestId('mode-option-practice')).toBeTruthy();
    expect(screen.getByTestId('mode-option-hiring')).toBeTruthy();
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
    expect(screen.getByTestId('mode-dropdown')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('mode-dropdown')).toBeNull();
  });

  it('closes dropdown when overlay is clicked', () => {
    const { container } = render(<ModeSwitcher />);
    fireEvent.click(screen.getByTestId('mode-switcher'));
    expect(screen.getByTestId('mode-dropdown')).toBeTruthy();
    const overlay = container.querySelector('[accessibilitylabel="Close mode switcher"]') as HTMLElement;
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay);
    expect(screen.queryByTestId('mode-dropdown')).toBeNull();
  });
});
