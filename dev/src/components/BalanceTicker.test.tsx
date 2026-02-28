// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  afterEach(() => {
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
});
