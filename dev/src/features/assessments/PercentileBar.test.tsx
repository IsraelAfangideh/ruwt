// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PercentileBar } from './PercentileBar';

vi.mock('react-native', () => ({
  View: ({ children, style, ...p }: any) => <div style={style} {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

describe('PercentileBar', () => {
  it('renders label, percentile value, and narrative', () => {
    render(<PercentileBar label="AI Cost" value={75} narrative="25% cheaper than median" />);
    expect(screen.getByText('AI Cost')).toBeInTheDocument();
    expect(screen.getByText('P75')).toBeInTheDocument();
    expect(screen.getByText('25% cheaper than median')).toBeInTheDocument();
  });

  it('renders displayValue when provided', () => {
    render(<PercentileBar label="Cost" value={80} narrative="Good" displayValue="$0.28" />);
    expect(screen.getByText('$0.28')).toBeInTheDocument();
  });

  it('does not render displayValue when not provided', () => {
    render(<PercentileBar label="Speed" value={50} narrative="Average" />);
    expect(screen.queryByText('$')).toBeNull();
  });

  it('clamps value to 0 when negative', () => {
    render(<PercentileBar label="Test" value={-10} narrative="Below minimum" />);
    expect(screen.getByText('P0')).toBeInTheDocument();
  });

  it('clamps value to 100 when above 100', () => {
    render(<PercentileBar label="Test" value={150} narrative="Above maximum" />);
    expect(screen.getByText('P100')).toBeInTheDocument();
  });

  it('renders P0 for zero percentile', () => {
    render(<PercentileBar label="Bad" value={0} narrative="Lowest" />);
    expect(screen.getByText('P0')).toBeInTheDocument();
  });
});
