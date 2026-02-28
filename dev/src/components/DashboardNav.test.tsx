// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
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
  useRoute: () => ({ name: 'Dashboard' }),
}));

vi.mock('@/theme', () => ({
  useColors: () => ({ text: '#000', textMuted: '#888' }),
}));

vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  fontSizes: { sm: 14 },
  fontFamily: { body: 'sans-serif' },
}));

describe('DashboardNav', () => {
  it('renders base nav items for individual accounts', () => {
    render(<DashboardNav />);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Challenges')).toBeTruthy();
    expect(screen.getByText('Daily')).toBeTruthy();
    expect(screen.getByText('Leaderboard')).toBeTruthy();
    expect(screen.queryByText('Assessments')).toBeNull();
  });

  it('includes Assessments link for team accounts', () => {
    render(<DashboardNav accountType="team" />);
    expect(screen.getByText('Assessments')).toBeTruthy();
  });

  it('navigates when a nav item is clicked', () => {
    render(<DashboardNav />);
    fireEvent.click(screen.getByText('Challenges'));
    expect(mockNavigate).toHaveBeenCalledWith('Challenges');
  });
});
