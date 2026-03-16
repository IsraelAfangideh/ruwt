// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardNav } from './DashboardNav';

const mockNavigate = vi.fn();

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, style, ...p }: any) => <span style={style} {...p}>{children}</span>,
  Pressable: ({ children, onPress, ...p }: any) => <button onClick={onPress} {...p}>{typeof children === 'function' ? children({ pressed: false }) : children}</button>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ name: 'Problems' }),
}));

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

// Default mock: practice mode, individual
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

describe('DashboardNav', () => {
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

  it('renders base nav items for individual accounts in practice mode', () => {
    render(<DashboardNav />);
    expect(screen.getByRole('button', { name: 'Problems' })).toBeInTheDocument();
    expect(screen.getByText('Discuss')).toBeInTheDocument();
    expect(screen.getByText('Leaderboard')).toBeInTheDocument();
    expect(screen.queryByText('My Profile')).toBeNull(); // Moved to profile menu
    expect(screen.queryByText('Bookmarks')).toBeNull(); // Moved to profile menu
    expect(screen.getByText('Hiring')).toBeInTheDocument(); // CTA for non-org users
    expect(screen.queryByText('Assessments')).toBeNull();
  });

  it('hides Hiring CTA for org members in practice mode (plain practice nav)', () => {
    mockAppMode = { ...mockAppMode, isOrgMember: true, orgInfo: { id: 'o', name: 'Org', role: 'admin', subscriptionStatus: 'active', subscriptionPlan: null, subscriptionEndsAt: null, trial: null } };
    render(<DashboardNav />);
    expect(screen.queryByText('Your Team')).toBeNull(); // No team link in practice mode
    expect(screen.queryByText('Hiring')).toBeNull(); // No accent CTA when already in org
    expect(screen.getByRole('button', { name: 'Problems' })).toBeInTheDocument(); // Still shows practice items
  });

  it('shows hiring nav items when in hiring mode', () => {
    mockAppMode = {
      ...mockAppMode,
      mode: 'hiring',
      isOrgMember: true,
      canAccessHiringMode: true,
      orgInfo: { id: 'o', name: 'Org', role: 'admin', subscriptionStatus: 'active', subscriptionPlan: null, subscriptionEndsAt: null, trial: null },
    };
    render(<DashboardNav />);
    expect(screen.getByText('Assessments')).toBeInTheDocument();
    expect(screen.getByText('Org Settings')).toBeInTheDocument();
    expect(screen.getByText('Preview Challenges')).toBeInTheDocument();
    expect(screen.queryByText('Discuss')).toBeNull();
    expect(screen.queryByText('Leaderboard')).toBeNull();
  });

  it('shows base practice items while loading', () => {
    mockAppMode = { ...mockAppMode, profileLoading: true };
    render(<DashboardNav />);
    expect(screen.getByRole('button', { name: 'Problems' })).toBeInTheDocument();
    expect(screen.queryByText('Assessments')).toBeNull();
    expect(screen.queryByText('Hiring')).toBeNull();
  });

  it('navigates when a nav item is clicked', () => {
    render(<DashboardNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Problems' }));
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  it('falls back to practice nav if hiring mode but cannot access', () => {
    mockAppMode = { ...mockAppMode, mode: 'hiring', canAccessHiringMode: false };
    render(<DashboardNav />);
    expect(screen.getByRole('button', { name: 'Problems' })).toBeInTheDocument();
    expect(screen.getByText('Hiring')).toBeInTheDocument(); // Falls back to individual practice
    expect(screen.queryByText('Org Settings')).toBeNull();
  });
});
