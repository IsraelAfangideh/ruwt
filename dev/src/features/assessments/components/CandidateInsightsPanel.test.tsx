// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CandidateInsightsPanel } from './CandidateInsightsPanel';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

vi.mock('@/features/profile/AIProfileRadar', () => ({
  AIProfileRadar: () => <div data-testid="radar">Radar</div>,
}));

vi.mock('@/features/assessments/components/PercentileBar', () => ({
  PercentileBar: ({ label }: any) => <div data-testid="percentile-bar">{label}</div>,
}));

vi.mock('@/features/assessments/components/HighlightReel', () => ({
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
    expect(screen.getByText('AI Profile')).toBeInTheDocument();
    expect(screen.getByTestId('radar')).toBeInTheDocument();
  });

  it('does not render radar when profile is absent', () => {
    render(<CandidateInsightsPanel {...baseProps} />);
    expect(screen.queryByText('AI Profile')).toBeNull();
  });

  it('renders signal flags', () => {
    const flags = { green: ['Fast learner'], red: ['Overspender'], yellow: ['Inconsistent'] };
    render(<CandidateInsightsPanel {...baseProps} flags={flags} />);
    expect(screen.getByText('Signals')).toBeInTheDocument();
    expect(screen.getByText('Fast learner')).toBeInTheDocument();
    expect(screen.getByText('Overspender')).toBeInTheDocument();
    expect(screen.getByText('Inconsistent')).toBeInTheDocument();
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
    expect(screen.getByText('Behavioral Insights')).toBeInTheDocument();
    expect(screen.getByText('Used budget models efficiently')).toBeInTheDocument();
  });

  it('renders comparative bars', () => {
    const comparatives = [
      { metric: 'AI Cost', candidateValue: 500, medianValue: 1000, percentile: 80, narrative: 'Cheaper than most' },
    ];
    render(<CandidateInsightsPanel {...baseProps} comparatives={comparatives} />);
    expect(screen.getByText('vs. Candidate Pool')).toBeInTheDocument();
    expect(screen.getByText('AI Cost')).toBeInTheDocument();
  });

  it('renders highlight reel when highlights are present', () => {
    const highlights = [{ timestamp: '', type: 'pass' as const, narrative: 'Solved', challengeIndex: 0 }];
    render(<CandidateInsightsPanel {...baseProps} highlights={highlights} />);
    expect(screen.getByTestId('highlight-reel')).toBeInTheDocument();
  });

  it('does not render highlight reel when highlights are empty', () => {
    render(<CandidateInsightsPanel {...baseProps} highlights={[]} />);
    expect(screen.queryByTestId('highlight-reel')).toBeNull();
  });

  it('does not render comparative bars section when comparatives are empty', () => {
    render(<CandidateInsightsPanel {...baseProps} comparatives={[]} />);
    expect(screen.queryByText('vs. Candidate Pool')).toBeNull();
  });

  it('excludes challenge-scoped yellow insights from global panel', () => {
    const insights = [
      { type: 'cost', severity: 'yellow' as const, narrative: 'Challenge-scoped yellow', challengeIndex: 0, timestamp: '' },
      { type: 'cost', severity: 'yellow' as const, narrative: 'Global yellow', challengeIndex: -1, timestamp: '' },
      { type: 'speed', severity: 'red' as const, narrative: 'Red stays regardless', challengeIndex: 2, timestamp: '' },
      { type: 'efficiency', severity: 'green' as const, narrative: 'Green stays regardless', challengeIndex: 1, timestamp: '' },
    ];
    render(<CandidateInsightsPanel {...baseProps} insights={insights} />);
    expect(screen.queryByText('Challenge-scoped yellow')).toBeNull();
    expect(screen.getByText('Global yellow')).toBeInTheDocument();
    expect(screen.getByText('Red stays regardless')).toBeInTheDocument();
    expect(screen.getByText('Green stays regardless')).toBeInTheDocument();
  });

  it('renders yellow severity insight with dot and narrative', () => {
    const insights = [
      { type: 'test', severity: 'yellow' as const, narrative: 'Yellow insight', challengeIndex: -1, timestamp: '' },
    ];
    render(<CandidateInsightsPanel {...baseProps} insights={insights} />);
    expect(screen.getByText('Yellow insight')).toBeInTheDocument();
    expect(screen.getByText('Behavioral Insights')).toBeInTheDocument();
  });

  it('renders red severity insight with dot and narrative', () => {
    const insights = [
      { type: 'cost', severity: 'red' as const, narrative: 'Red insight', challengeIndex: -1, timestamp: '' },
    ];
    render(<CandidateInsightsPanel {...baseProps} insights={insights} />);
    expect(screen.getByText('Red insight')).toBeInTheDocument();
    expect(screen.getByText('Behavioral Insights')).toBeInTheDocument();
  });

  it('displays Token Usage metric with locale-formatted value', () => {
    const comparatives = [
      { metric: 'Token Usage', candidateValue: 5000, medianValue: 4000, percentile: 60, narrative: 'Average tokens' },
    ];
    render(<CandidateInsightsPanel {...baseProps} comparatives={comparatives} />);
    expect(screen.getByText('Token Usage')).toBeInTheDocument();
  });

  it('displays Speed metric formatted in minutes', () => {
    const comparatives = [
      { metric: 'Speed', candidateValue: 180000, medianValue: 120000, percentile: 70, narrative: 'Fast' },
    ];
    render(<CandidateInsightsPanel {...baseProps} comparatives={comparatives} />);
    expect(screen.getByText('Speed')).toBeInTheDocument();
  });

  it('omits display value for Speed when candidate value is zero', () => {
    const comparatives = [
      { metric: 'Speed', candidateValue: 0, medianValue: 100, percentile: 10, narrative: 'Slow' },
    ];
    render(<CandidateInsightsPanel {...baseProps} comparatives={comparatives} />);
    expect(screen.getByText('Speed')).toBeInTheDocument();
  });

  it('omits display value for unknown metric types', () => {
    const comparatives = [
      { metric: 'Unknown Metric', candidateValue: 42, medianValue: 50, percentile: 30, narrative: 'Some metric' },
    ];
    render(<CandidateInsightsPanel {...baseProps} comparatives={comparatives} />);
    expect(screen.getByText('Unknown Metric')).toBeInTheDocument();
  });

  it('limits narrative insights to a maximum of four', () => {
    const insights = Array.from({ length: 6 }, (_, i) => ({
      type: 'cost',
      severity: 'green' as const,
      narrative: `Insight number ${i + 1}`,
      challengeIndex: -1,
      timestamp: '',
    }));
    render(<CandidateInsightsPanel {...baseProps} insights={insights} />);
    expect(screen.getByText('Insight number 1')).toBeInTheDocument();
    expect(screen.getByText('Insight number 4')).toBeInTheDocument();
    expect(screen.queryByText('Insight number 5')).toBeNull();
  });

  it('does not render Behavioral Insights heading when all insights are filtered out', () => {
    const insights = [
      { type: 'cost', severity: 'yellow' as const, narrative: 'Filtered out', challengeIndex: 0, timestamp: '' },
    ];
    render(<CandidateInsightsPanel {...baseProps} insights={insights} />);
    expect(screen.queryByText('Behavioral Insights')).toBeNull();
  });
});
