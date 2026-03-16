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

vi.mock('@/shared/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signOut: mockSignOut },
  }),
}));

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

vi.mock('@/shared/ui/Avatar', () => ({
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

vi.mock('@/shared/lib/AppModeContext', () => ({
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
    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  it('uses first letter of email when no name', () => {
    const emailUser = { id: '2', email: 'alice@ruwt.dev', user_metadata: {} } as any;
    render(<UserNav user={emailUser} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('falls back to ? when no email', () => {
    const noEmailUser = { id: '3', user_metadata: {} } as any;
    render(<UserNav user={noEmailUser} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('opens dropdown menu on click', () => {
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@ruwt.dev')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bookmarks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('hides mode indicator and org settings for org members in practice mode', () => {
    mockAppMode = {
      ...mockAppMode,
      isOrgMember: true,
      orgInfo: { id: 'o', name: 'Acme Corp', role: 'admin', subscriptionStatus: 'active', subscriptionPlan: null, subscriptionEndsAt: null, trial: null },
    };
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    expect(screen.queryByText('Practice Mode')).toBeNull();
    expect(screen.queryByText('Org Settings')).toBeNull();
  });

  it('shows org name and org settings in hiring mode', () => {
    mockAppMode = {
      ...mockAppMode,
      mode: 'hiring',
      isOrgMember: true,
      orgInfo: { id: 'o', name: 'Acme Corp', role: 'admin', subscriptionStatus: 'active', subscriptionPlan: null, subscriptionEndsAt: null, trial: null },
    };
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Org Settings' })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    expect(mockNavigate).toHaveBeenCalledWith('Profile');
  });

  it('navigates to Bookmarks when clicked', () => {
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    fireEvent.click(screen.getByRole('button', { name: 'Bookmarks' }));
    expect(mockNavigate).toHaveBeenCalledWith('Bookmarks');
  });

  it('navigates to Settings when clicked', () => {
    mockNavigate.mockClear();
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(mockNavigate).toHaveBeenCalledWith('Settings');
  });

  it('signs out and resets navigation when Sign out is clicked', async () => {
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('closes menu when overlay is clicked', () => {
    const { container } = render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
    const overlayBtn = container.querySelector('[accessibilitylabel="Close account menu"]') as HTMLElement;
    expect(overlayBtn).not.toBeNull();
    fireEvent.click(overlayBtn);
    expect(screen.queryByText('Profile')).toBeNull();
  });

  it('closes menu on Escape key press', () => {
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Profile')).toBeNull();
  });

  it('ignores Escape key when menu is already closed', () => {
    render(<UserNav user={mockUser} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Profile')).toBeNull();
  });

  it('navigates to OrgManagement when Org Settings is clicked in hiring mode', () => {
    mockAppMode = {
      ...mockAppMode,
      mode: 'hiring',
      isOrgMember: true,
      orgInfo: { id: 'o', name: 'Acme Corp', role: 'admin', subscriptionStatus: 'active', subscriptionPlan: null, subscriptionEndsAt: null, trial: null },
    };
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    mockNavigate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Org Settings' }));
    expect(mockNavigate).toHaveBeenCalledWith('OrgManagement', {});
  });

  it('shows "User" fallback when user_metadata.name is missing', () => {
    const noNameUser = { id: 'user-1', email: 'test@ruwt.dev', user_metadata: {} } as any;
    render(<UserNav user={noNameUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    expect(screen.getByText('User')).toBeInTheDocument();
  });
});
