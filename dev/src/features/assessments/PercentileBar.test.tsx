// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PercentileBar } from './PercentileBar';

vi.mock('react-native', () => ({
  View: ({ children, style, ...p }: any) => <div style={style} {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/shared/theme', () => ({
  useColors: () => ({
    text: '#000',
    textMuted: '#888',
    accent: '#c9a962',
    success: '#5a8a5a',
    destructive: '#b06060',
    muted: '#ddd',
  }),
}));

vi.mock('@/shared/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16 },
  fontSizes: { xs: 12, sm: 14 },
  fontFamily: { body: 'sans-serif' },
}));

describe('PercentileBar', () => {
  it('renders label, percentile value, and narrative', () => {
    render(<PercentileBar label="AI Cost" value={75} narrative="25% cheaper than median" />);
    expect(screen.getByText('AI Cost')).toBeTruthy();
    expect(screen.getByText('P75')).toBeTruthy();
    expect(screen.getByText('25% cheaper than median')).toBeTruthy();
  });

  it('renders displayValue when provided', () => {
    render(<PercentileBar label="Cost" value={80} narrative="Good" displayValue="$0.28" />);
    expect(screen.getByText('$0.28')).toBeTruthy();
  });

  it('does not render displayValue when not provided', () => {
    render(<PercentileBar label="Speed" value={50} narrative="Average" />);
    expect(screen.queryByText('$')).toBeNull();
  });

  it('clamps value to 0 when negative', () => {
    render(<PercentileBar label="Test" value={-10} narrative="Below minimum" />);
    expect(screen.getByText('P0')).toBeTruthy();
  });

  it('clamps value to 100 when above 100', () => {
    render(<PercentileBar label="Test" value={150} narrative="Above maximum" />);
    expect(screen.getByText('P100')).toBeTruthy();
  });

  it('renders P0 for zero percentile', () => {
    render(<PercentileBar label="Bad" value={0} narrative="Lowest" />);
    expect(screen.getByText('P0')).toBeTruthy();
  });
});
