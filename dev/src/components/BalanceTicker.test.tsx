// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BalanceTicker } from './BalanceTicker';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/theme', () => ({
  useColors: () => ({
    muted: '#ddd',
    border: '#ccc',
    primary: '#000',
    text: '#111',
  }),
}));

vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16 },
  fontSizes: { xs: 12, sm: 14 },
  fontFamily: { body: 'sans-serif' },
}));

describe('BalanceTicker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the "Credits" label', () => {
    render(<BalanceTicker />);
    expect(screen.getByText('Credits')).toBeTruthy();
  });

  it('renders the initial balance value', () => {
    render(<BalanceTicker />);
    expect(screen.getByText('12450')).toBeTruthy();
  });

  it('updates balance after interval fires', () => {
    // Fix Math.random to produce a deterministic result
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    render(<BalanceTicker />);
    expect(screen.getByText('12450')).toBeTruthy();

    // Advance timer by 3000ms to trigger the interval callback
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // With Math.random() = 0.5, the delta is (0.5 - 0.4) * 10 = 1
    // New balance = 12450 + 1 = 12451
    expect(screen.getByText('12451')).toBeTruthy();
  });
});
