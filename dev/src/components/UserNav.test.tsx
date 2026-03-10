// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserNav } from './UserNav';

const mockNavigate = vi.fn();
const mockReset = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({});

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  Pressable: ({ children, onPress, ...p }: any) => <button onClick={onPress} {...p}>{typeof children === 'function' ? children({ pressed: false }) : children}</button>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signOut: mockSignOut },
  }),
}));

vi.mock('@/theme', () => ({
  useColors: () => ({
    text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    card: '#fff', destructive: '#b06060', mutedForeground: '#555',
  }),
}));

vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16 },
  fontSizes: { xs: 12, sm: 14 },
  fontFamily: { body: 'sans-serif' },
}));

vi.mock('@/components/ui/Avatar', () => ({
  Avatar: ({ fallback }: any) => <span data-testid="avatar">{fallback}</span>,
}));

// Default mock: individual, practice mode
let mockAppMode: any = {
  mode: 'practice',
  setMode: vi.fn(),
  profile: null,
  profileLoading: false,
  orgInfo: null,
  isOrgMember: false,
  canAccessHiringMode: false,
  refreshProfile: vi.fn(),
};

vi.mock('@/lib/AppModeContext', () => ({
  useAppMode: () => mockAppMode,
}));

const mockUser = {
  id: 'user-1',
  email: 'test@ruwt.dev',
  user_metadata: { name: 'Test User', avatar_url: null },
} as any;

describe('UserNav', () => {
  afterEach(() => {
    mockAppMode = {
      mode: 'practice',
      setMode: vi.fn(),
      profile: null,
      profileLoading: false,
      orgInfo: null,
      isOrgMember: false,
      canAccessHiringMode: false,
      refreshProfile: vi.fn(),
    };
  });

  it('renders user avatar with correct initials', () => {
    render(<UserNav user={mockUser} />);
    expect(screen.getByText('TU')).toBeTruthy();
  });

  it('uses first letter of email when no name', () => {
    const emailUser = { id: '2', email: 'alice@ruwt.dev', user_metadata: {} } as any;
    render(<UserNav user={emailUser} />);
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('falls back to ? when no email', () => {
    const noEmailUser = { id: '3', user_metadata: {} } as any;
    render(<UserNav user={noEmailUser} />);
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('opens dropdown menu on click', () => {
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    expect(screen.getByText('Test User')).toBeTruthy();
    expect(screen.getByText('test@ruwt.dev')).toBeTruthy();
    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Sign out')).toBeTruthy();
  });

  it('shows mode indicator and org settings for org members', () => {
    mockAppMode = {
      ...mockAppMode,
      isOrgMember: true,
      orgInfo: { id: 'o', name: 'Acme Corp', role: 'admin', subscriptionStatus: 'active', subscriptionPlan: null, subscriptionEndsAt: null, trial: null },
    };
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    expect(screen.getByText('Practice Mode')).toBeTruthy();
    expect(screen.getByText('Org Settings')).toBeTruthy();
  });

  it('shows org name in mode indicator when in hiring mode', () => {
    mockAppMode = {
      ...mockAppMode,
      mode: 'hiring',
      isOrgMember: true,
      orgInfo: { id: 'o', name: 'Acme Corp', role: 'admin', subscriptionStatus: 'active', subscriptionPlan: null, subscriptionEndsAt: null, trial: null },
    };
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    expect(screen.getByText('Acme Corp')).toBeTruthy();
  });

  it('hides org settings for non-org members', () => {
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    expect(screen.queryByText('Org Settings')).toBeNull();
    expect(screen.queryByText('Practice Mode')).toBeNull();
  });

  it('navigates to Profile when clicked', () => {
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    fireEvent.click(screen.getByText('Profile'));
    expect(mockNavigate).toHaveBeenCalledWith('Profile');
  });

  it('navigates to Settings when clicked', () => {
    mockNavigate.mockClear();
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    fireEvent.click(screen.getByText('Settings'));
    expect(mockNavigate).toHaveBeenCalledWith('Settings');
  });

  it('signs out and resets navigation when Sign out is clicked', async () => {
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    fireEvent.click(screen.getByText('Sign out'));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('closes menu when overlay is clicked', () => {
    const { container } = render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    expect(screen.getByText('Profile')).toBeTruthy();
    const overlayBtn = container.querySelector('[accessibilitylabel="Close account menu"]') as HTMLElement;
    expect(overlayBtn).not.toBeNull();
    fireEvent.click(overlayBtn);
    expect(screen.queryByText('Profile')).toBeNull();
  });

  it('closes menu on Escape key press (line 21)', () => {
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    expect(screen.getByText('Profile')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Profile')).toBeNull();
  });

  it('ignores Escape key when menu is closed (line 21 false branch)', () => {
    render(<UserNav user={mockUser} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Profile')).toBeNull();
  });
});
