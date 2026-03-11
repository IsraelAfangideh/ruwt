// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardNav } from './DashboardNav';

const mockNavigate = vi.fn();

vi.mock('react-native', () => {
  const AnimatedValue = class {
    _value: number;
    constructor(v: number) { this._value = v; }
    setValue(v: number) { this._value = v; }
  };
  return {
    View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
    Text: ({ children, style, ...p }: any) => <span style={style} {...p}>{children}</span>,
    Pressable: ({ children, onPress, ...p }: any) => <button onClick={onPress} {...p}>{typeof children === 'function' ? children({ pressed: false }) : children}</button>,
    Animated: {
      Value: AnimatedValue,
      View: ({ children, style, ...p }: any) => <div style={style} {...p}>{children}</div>,
      timing: (_val: any, _cfg: any) => ({ start: (cb?: () => void) => cb?.() }),
      parallel: (anims: any[]) => ({ start: (cb?: () => void) => { anims.forEach((a: any) => a.start()); cb?.(); } }),
    },
    StyleSheet: { create: (s: any) => s },
  };
});

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ name: 'Problems' }),
}));

vi.mock('@/theme', () => ({
  useColors: () => ({ text: '#000', textMuted: '#888', accent: '#c9a962' }),
}));

vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  fontSizes: { xs: 12, sm: 14 },
  fontFamily: { body: 'sans-serif' },
}));

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

vi.mock('@/lib/AppModeContext', () => ({
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
    expect(screen.getByText('Problems')).toBeTruthy();
    expect(screen.getByText('Discuss')).toBeTruthy();
    expect(screen.getByText('Leaderboard')).toBeTruthy();
    expect(screen.getByText('My Profile')).toBeTruthy();
    expect(screen.getByText('Hiring')).toBeTruthy(); // CTA for non-org users
    expect(screen.queryByText('Assessments')).toBeNull();
  });

  it('hides Hiring CTA for org members in practice mode (plain practice nav)', () => {
    mockAppMode = { ...mockAppMode, isOrgMember: true, orgInfo: { id: 'o', name: 'Org', role: 'admin', subscriptionStatus: 'active', subscriptionPlan: null, subscriptionEndsAt: null, trial: null } };
    render(<DashboardNav />);
    expect(screen.queryByText('Your Team')).toBeNull(); // No team link in practice mode
    expect(screen.queryByText('Hiring')).toBeNull(); // No accent CTA when already in org
    expect(screen.getByText('Problems')).toBeTruthy(); // Still shows practice items
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
    expect(screen.getByText('Assessments')).toBeTruthy();
    expect(screen.getByText('Org Settings')).toBeTruthy();
    expect(screen.getByText('Preview Challenges')).toBeTruthy();
    expect(screen.queryByText('Discuss')).toBeNull();
    expect(screen.queryByText('Leaderboard')).toBeNull();
  });

  it('shows base practice items while loading', () => {
    mockAppMode = { ...mockAppMode, profileLoading: true };
    render(<DashboardNav />);
    expect(screen.getByText('Problems')).toBeTruthy();
    expect(screen.queryByText('Assessments')).toBeNull();
    expect(screen.queryByText('Hiring')).toBeNull();
  });

  it('navigates when a nav item is clicked', () => {
    render(<DashboardNav />);
    fireEvent.click(screen.getByText('Problems'));
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  it('falls back to practice nav if hiring mode but cannot access', () => {
    mockAppMode = { ...mockAppMode, mode: 'hiring', canAccessHiringMode: false };
    render(<DashboardNav />);
    expect(screen.getByText('Problems')).toBeTruthy();
    expect(screen.getByText('Hiring')).toBeTruthy(); // Falls back to individual practice
    expect(screen.queryByText('Org Settings')).toBeNull();
  });
});
