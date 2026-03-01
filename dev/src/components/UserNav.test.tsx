// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
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

// Mock the Avatar component
vi.mock('@/components/ui/Avatar', () => ({
  Avatar: ({ fallback }: any) => <span data-testid="avatar">{fallback}</span>,
}));

const mockUser = {
  id: 'user-1',
  email: 'test@ruwt.dev',
  user_metadata: { name: 'Test User', avatar_url: null },
} as any;

describe('UserNav', () => {
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
    // Open the menu
    fireEvent.click(screen.getByTestId('avatar'));
    expect(screen.getByText('Profile')).toBeTruthy();
    // The overlay is a Pressable (button) with accessibilitylabel attribute for "Close account menu"
    const overlayBtn = container.querySelector('[accessibilitylabel="Close account menu"]') as HTMLElement;
    expect(overlayBtn).not.toBeNull();
    fireEvent.click(overlayBtn);
    // Menu items should no longer be visible
    expect(screen.queryByText('Profile')).toBeNull();
  });

  it('closes menu on Escape key press (line 21)', () => {
    render(<UserNav user={mockUser} />);
    fireEvent.click(screen.getByTestId('avatar'));
    expect(screen.getByText('Profile')).toBeTruthy();
    // Press Escape to close the menu
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Profile')).toBeNull();
  });

  it('ignores Escape key when menu is closed (line 21 false branch)', () => {
    render(<UserNav user={mockUser} />);
    // Menu is closed — pressing Escape should do nothing
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Profile')).toBeNull();
  });
});
