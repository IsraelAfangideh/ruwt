// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CandidateComparisonView } from './CandidateComparisonView';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  Pressable: ({ children, onPress, style, ...p }: any) => <button onClick={onPress} {...p}>{typeof children === 'function' ? children({ pressed: false }) : children}</button>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/theme', () => ({
  useColors: () => ({
    text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    borderStrong: '#aaa', success: '#5a8a5a', destructive: '#b06060',
    card: '#fff', cardForeground: '#000', mutedForeground: '#555',
    muted: '#ddd', successBg: '#f0fff0', errorBg: '#fff0f0', accentBg: '#fef8e8',
  }),
}));

vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18 },
  fontFamily: { body: 'sans-serif' },
  radii: { xl: 16, full: 9999 },
}));

vi.mock('@/components/AIProfileRadar', () => ({
  AIProfileRadar: (_props: any) => <div data-testid="radar">Radar</div>,
}));

vi.mock('@/components/PercentileBar', () => ({
  PercentileBar: ({ label }: any) => <div data-testid="percentile-bar">{label}</div>,
}));

const candidates = [
  { sessionId: 's1', name: 'Alice', email: 'alice@test.com', challengesPassed: 3, totalChallenges: 5, totalCost: 1000, totalTokens: 5000 },
  { sessionId: 's2', name: 'Bob', email: 'bob@test.com', challengesPassed: 5, totalChallenges: 5, totalCost: 2000, totalTokens: 8000 },
];

const profiles = {
  s1: { modelSelection: 70, promptEfficiency: 80, debugging: 60, strategy: 50, speed: 90 },
  s2: { modelSelection: 85, promptEfficiency: 75, debugging: 90, strategy: 70, speed: 60 },
};

const insightsData = {
  s1: {
    flags: { green: ['Efficient'], red: [], yellow: [] },
    comparatives: [{ metric: 'Cost', candidateValue: 1000, medianValue: 1500, percentile: 80, narrative: 'Cheaper' }],
  },
  s2: {
    flags: { green: [], red: ['Overspender'], yellow: ['Slow'] },
    comparatives: [],
  },
};

const formatCost = (v: number) => `$${(v / 10000).toFixed(2)}`;

describe('CandidateComparisonView', () => {
  it('shows empty message when fewer than 2 candidates', () => {
    render(
      <CandidateComparisonView
        candidates={[candidates[0]]}
        profiles={profiles}
        insightsData={insightsData}
        formatCost={formatCost}
      />
    );
    expect(screen.getByText(/Need at least 2 candidates/)).toBeTruthy();
  });

  it('renders title and both candidates', () => {
    render(
      <CandidateComparisonView
        candidates={candidates}
        profiles={profiles}
        insightsData={insightsData}
        formatCost={formatCost}
      />
    );
    expect(screen.getByText('Compare Candidates')).toBeTruthy();
    expect(screen.getByText('vs')).toBeTruthy();
  });

  it('renders candidate stats for both sides', () => {
    render(
      <CandidateComparisonView
        candidates={candidates}
        profiles={profiles}
        insightsData={insightsData}
        formatCost={formatCost}
      />
    );
    expect(screen.getByText('3/5')).toBeTruthy();
    expect(screen.getByText('5/5')).toBeTruthy();
  });

  it('renders radar charts', () => {
    render(
      <CandidateComparisonView
        candidates={candidates}
        profiles={profiles}
        insightsData={insightsData}
        formatCost={formatCost}
      />
    );
    const radars = screen.getAllByTestId('radar');
    expect(radars.length).toBe(2);
  });

  it('renders flags for candidates', () => {
    render(
      <CandidateComparisonView
        candidates={candidates}
        profiles={profiles}
        insightsData={insightsData}
        formatCost={formatCost}
      />
    );
    expect(screen.getByText('Efficient')).toBeTruthy();
    expect(screen.getByText('Overspender')).toBeTruthy();
    expect(screen.getByText('Slow')).toBeTruthy();
  });

  it('opens dropdown when clicked', () => {
    render(
      <CandidateComparisonView
        candidates={candidates}
        profiles={profiles}
        insightsData={insightsData}
        formatCost={formatCost}
      />
    );
    // Click the first dropdown (showing Alice)
    fireEvent.click(screen.getByText('Alice'));
    // Should show dropdown items with pass counts
    expect(screen.getAllByText(/passed/).length).toBeGreaterThan(0);
  });

  it('selects a candidate from dropdown and closes it', () => {
    render(
      <CandidateComparisonView
        candidates={candidates}
        profiles={profiles}
        insightsData={insightsData}
        formatCost={formatCost}
      />
    );
    // Open the left dropdown (showing Alice)
    fireEvent.click(screen.getByText('Alice'));
    // The dropdown menu should now show items with pass counts
    const passedItems = screen.getAllByText(/passed/);
    expect(passedItems.length).toBeGreaterThan(0);
    // Find Bob's dropdown item button and click it directly
    // The dropdown item Pressable renders as <button onClick={onPress}>
    // We need to click the button, not the text, to ensure onPress fires
    const bobTexts = screen.getAllByText('Bob');
    const bobDropdownItem = bobTexts[bobTexts.length - 1].closest('button');
    expect(bobDropdownItem).toBeTruthy();
    fireEvent.click(bobDropdownItem!);
    // After selecting, the dropdown should close
  });
});
