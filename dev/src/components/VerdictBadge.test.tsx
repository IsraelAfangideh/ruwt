// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { VerdictBadge, computeVerdict, type Verdict } from './VerdictBadge';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/theme', () => ({
  useColors: () => ({
    success: '#5a8a5a',
    destructive: '#b06060',
    accent: '#c9a962',
  }),
}));

vi.mock('@/theme/tokens', () => ({
  fontSizes: { xs: 12 },
  spacing: { xs: 4, sm: 8 },
}));

describe('VerdictBadge', () => {
  afterEach(() => cleanup());

  it('renders null when verdict is null', () => {
    const { container } = render(<VerdictBadge verdict={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders PASS label for pass verdict', () => {
    render(<VerdictBadge verdict="pass" />);
    expect(screen.getByText('PASS')).toBeTruthy();
  });

  it('renders FAIL label for fail verdict', () => {
    render(<VerdictBadge verdict="fail" />);
    expect(screen.getByText('FAIL')).toBeTruthy();
  });

  it('renders REVIEW label for review verdict', () => {
    render(<VerdictBadge verdict="review" />);
    expect(screen.getByText('REVIEW')).toBeTruthy();
  });

  it('supports sm size variant', () => {
    render(<VerdictBadge verdict="pass" size="sm" />);
    expect(screen.getByText('PASS')).toBeTruthy();
  });

  it('defaults to md size', () => {
    render(<VerdictBadge verdict="fail" />);
    expect(screen.getByText('FAIL')).toBeTruthy();
  });
});

describe('computeVerdict', () => {
  const allAbove = { modelSelection: 60, promptEfficiency: 60, debugging: 60, strategy: 60, speed: 60 };
  const allBelow = { modelSelection: 20, promptEfficiency: 20, debugging: 20, strategy: 20, speed: 20 };
  const mixedReview = { modelSelection: 45, promptEfficiency: 60, debugging: 60, strategy: 60, speed: 60 };

  it('returns null when threshold is null', () => {
    expect(computeVerdict(allAbove, null)).toBe(null);
  });

  it('returns null when threshold is disabled', () => {
    const threshold = { enabled: false, mode: 'all_dimensions' as const, dimensions: {} };
    expect(computeVerdict(allAbove, threshold)).toBe(null);
  });

  describe('all_dimensions mode', () => {
    const threshold = {
      enabled: true,
      mode: 'all_dimensions' as const,
      dimensions: { modelSelection: 50, promptEfficiency: 50, debugging: 50, strategy: 50, speed: 50 },
    };

    it('returns pass when all dimensions meet threshold', () => {
      expect(computeVerdict(allAbove, threshold)).toBe('pass');
    });

    it('returns fail when any dimension is 20+ points below threshold', () => {
      expect(computeVerdict(allBelow, threshold)).toBe('fail');
    });

    it('returns review when below threshold but not by 20+ points', () => {
      expect(computeVerdict(mixedReview, threshold)).toBe('review');
    });
  });

  describe('weighted_average mode', () => {
    const threshold = {
      enabled: true,
      mode: 'weighted_average' as const,
      minOverall: 60,
      dimensions: { modelSelection: 50, promptEfficiency: 50, debugging: 50, strategy: 50, speed: 50 },
    };

    it('returns pass when weighted average meets minOverall', () => {
      const scores = { modelSelection: 70, promptEfficiency: 70, debugging: 70, strategy: 70, speed: 70 };
      expect(computeVerdict(scores, threshold)).toBe('pass');
    });

    it('returns fail when weighted average is 20+ below minOverall', () => {
      const scores = { modelSelection: 30, promptEfficiency: 30, debugging: 30, strategy: 30, speed: 30 };
      expect(computeVerdict(scores, threshold)).toBe('fail');
    });

    it('returns review when weighted average is slightly below minOverall', () => {
      const scores = { modelSelection: 50, promptEfficiency: 50, debugging: 50, strategy: 50, speed: 50 };
      expect(computeVerdict(scores, threshold)).toBe('review');
    });

    it('uses default weights when none provided', () => {
      const scores = { modelSelection: 60, promptEfficiency: 60, debugging: 60, strategy: 60, speed: 60 };
      expect(computeVerdict(scores, threshold)).toBe('pass');
    });

    it('uses default minOverall of 60 when not specified', () => {
      const noMin = { ...threshold, minOverall: undefined };
      const scores = { modelSelection: 60, promptEfficiency: 60, debugging: 60, strategy: 60, speed: 60 };
      expect(computeVerdict(scores, noMin)).toBe('pass');
    });
  });
});
