// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CandidateInsightsPanel } from './CandidateInsightsPanel';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/theme', () => ({
  useColors: () => ({
    text: '#000', textMuted: '#888', accent: '#c9a962',
    border: '#ccc', borderStrong: '#aaa', card: '#fff',
    success: '#5a8a5a', destructive: '#b06060',
    cardForeground: '#000', mutedForeground: '#555',
    muted: '#ddd', successBg: '#f0fff0', errorBg: '#fff0f0', accentBg: '#fef8e8',
  }),
}));

vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  fontSizes: { xs: 12, sm: 14, md: 16 },
  fontFamily: { body: 'sans-serif' },
  radii: { xl: 16, full: 9999 },
}));

vi.mock('@/components/AIProfileRadar', () => ({
  AIProfileRadar: () => <div data-testid="radar">Radar</div>,
}));

vi.mock('@/components/PercentileBar', () => ({
  PercentileBar: ({ label }: any) => <div data-testid="percentile-bar">{label}</div>,
}));

vi.mock('@/components/HighlightReel', () => ({
  HighlightReel: () => <div data-testid="highlight-reel">Highlights</div>,
}));

const baseProps = {
  insights: [],
  comparatives: [],
  flags: { green: [], red: [], yellow: [] },
  highlights: [],
  formatCost: (v: number) => `$${(v / 10000).toFixed(2)}`,
};

describe('CandidateInsightsPanel', () => {
  it('renders without crashing when given minimal props', () => {
    const { container } = render(<CandidateInsightsPanel {...baseProps} />);
    expect(container.innerHTML).not.toBe('');
  });

  it('renders radar chart when profile is provided', () => {
    const profile = { modelSelection: 80, promptEfficiency: 60, debugging: 90, strategy: 50, speed: 70 };
    render(<CandidateInsightsPanel {...baseProps} profile={profile} />);
    expect(screen.getByText('AI Profile')).toBeTruthy();
    expect(screen.getByTestId('radar')).toBeTruthy();
  });

  it('does not render radar when profile is absent', () => {
    render(<CandidateInsightsPanel {...baseProps} />);
    expect(screen.queryByText('AI Profile')).toBeNull();
  });

  it('renders signal flags', () => {
    const flags = { green: ['Fast learner'], red: ['Overspender'], yellow: ['Inconsistent'] };
    render(<CandidateInsightsPanel {...baseProps} flags={flags} />);
    expect(screen.getByText('Signals')).toBeTruthy();
    expect(screen.getByText('Fast learner')).toBeTruthy();
    expect(screen.getByText('Overspender')).toBeTruthy();
    expect(screen.getByText('Inconsistent')).toBeTruthy();
  });

  it('does not render Signals heading when no flags', () => {
    render(<CandidateInsightsPanel {...baseProps} />);
    expect(screen.queryByText('Signals')).toBeNull();
  });

  it('renders behavioral insights', () => {
    const insights = [
      { type: 'cost', severity: 'green' as const, narrative: 'Used budget models efficiently', challengeIndex: -1, timestamp: '' },
    ];
    render(<CandidateInsightsPanel {...baseProps} insights={insights} />);
    expect(screen.getByText('Behavioral Insights')).toBeTruthy();
    expect(screen.getByText('Used budget models efficiently')).toBeTruthy();
  });

  it('renders comparative bars', () => {
    const comparatives = [
      { metric: 'AI Cost', candidateValue: 500, medianValue: 1000, percentile: 80, narrative: 'Cheaper than most' },
    ];
    render(<CandidateInsightsPanel {...baseProps} comparatives={comparatives} />);
    expect(screen.getByText('vs. Candidate Pool')).toBeTruthy();
    expect(screen.getByText('AI Cost')).toBeTruthy();
  });

  it('renders highlight reel when highlights are present', () => {
    const highlights = [{ timestamp: '', type: 'pass' as const, narrative: 'Solved', challengeIndex: 0 }];
    render(<CandidateInsightsPanel {...baseProps} highlights={highlights} />);
    expect(screen.getByTestId('highlight-reel')).toBeTruthy();
  });
});
