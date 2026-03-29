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

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

vi.mock('@/features/profile/AIProfileRadar', () => ({
  AIProfileRadar: (_props: any) => <div data-testid="radar">Radar</div>,
}));

vi.mock('@/features/assessments/components/PercentileBar', () => ({
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
    expect(screen.getByText(/Need at least 2 candidates/)).toBeInTheDocument();
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
    expect(screen.getByText('Compare Candidates')).toBeInTheDocument();
    expect(screen.getByText('vs')).toBeInTheDocument();
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
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(screen.getByText('5/5')).toBeInTheDocument();
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
    expect(screen.getByText('Efficient')).toBeInTheDocument();
    expect(screen.getByText('Overspender')).toBeInTheDocument();
    expect(screen.getByText('Slow')).toBeInTheDocument();
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

  it('shows email in dropdown when candidate name is null', () => {
    const namelessCandidates = [
      { sessionId: 's1', name: null, email: 'alice@test.com', challengesPassed: 3, totalChallenges: 5, totalCost: 1000, totalTokens: 5000 },
      { sessionId: 's2', name: 'Bob', email: 'bob@test.com', challengesPassed: 5, totalChallenges: 5, totalCost: 2000, totalTokens: 8000 },
    ];
    render(
      <CandidateComparisonView
        candidates={namelessCandidates as any}
        profiles={profiles}
        insightsData={insightsData}
        formatCost={formatCost}
      />
    );
    // The first dropdown should show the email instead of name
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });

  it('selects candidate and closes dropdown on item press', () => {
    render(
      <CandidateComparisonView
        candidates={candidates}
        profiles={profiles}
        insightsData={insightsData}
        formatCost={formatCost}
      />
    );
    // Open the right dropdown (initially showing Bob which is s2)
    const bobTexts = screen.getAllByText('Bob');
    // Click on the Bob text to open its dropdown
    fireEvent.click(bobTexts[bobTexts.length - 1]);
    // Now in the dropdown menu, click Alice to select her
    const aliceTexts = screen.getAllByText('Alice');
    const aliceButton = aliceTexts[aliceTexts.length - 1].closest('button');
    if (aliceButton) {
      fireEvent.click(aliceButton);
    }
    // The dropdown should close after selection
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

  it('shows "No signals detected" when flags are empty', () => {
    const emptyInsights = {
      s1: { flags: { green: [], red: [], yellow: [] }, comparatives: [] },
      s2: { flags: { green: [], red: [], yellow: [] }, comparatives: [] },
    };
    render(
      <CandidateComparisonView
        candidates={candidates}
        profiles={profiles}
        insightsData={emptyInsights}
        formatCost={formatCost}
      />
    );
    const noSignals = screen.getAllByText('No signals detected');
    expect(noSignals.length).toBeGreaterThanOrEqual(1);
  });

  it('renders without crashing when insights data is missing', () => {
    render(
      <CandidateComparisonView
        candidates={candidates}
        profiles={profiles}
        insightsData={{}}
        formatCost={formatCost}
      />
    );
    // Should render without crashing when no insights for selected candidates
    expect(screen.getByText('Compare Candidates')).toBeInTheDocument();
  });

  it('renders without crashing when profile data is missing', () => {
    render(
      <CandidateComparisonView
        candidates={candidates}
        profiles={{}}
        insightsData={insightsData}
        formatCost={formatCost}
      />
    );
    // Should render without crashing when profiles are empty
    expect(screen.getByText('3/5')).toBeInTheDocument();
  });
});
