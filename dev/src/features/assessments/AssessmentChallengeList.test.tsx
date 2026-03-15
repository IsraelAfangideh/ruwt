// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/shared/ui/Badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));
vi.mock('@/shared/ui/Input', () => ({
  Input: ({ onChangeText, label, placeholder, value, ...props }: any) => (
    <input
      aria-label={label}
      placeholder={placeholder}
      value={value || ''}
      onChange={(e: any) => onChangeText?.(e.target.value)}
      {...props}
    />
  ),
}));
vi.mock('@/shared/lib/difficulty', () => ({
  getDifficultyStyle: (d: string) => ({ color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', label: d.charAt(0).toUpperCase() + d.slice(1) }),
  DIFFICULTIES: [
    { key: 'all', label: 'All Levels' },
    { key: 'sprint', label: 'Sprint' },
    { key: 'easy', label: 'Easy' },
    { key: 'medium', label: 'Medium' },
    { key: 'hard', label: 'Hard' },
    { key: 'impossible', label: 'Impossible' },
  ],
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const { AssessmentChallengeList } = await import('./AssessmentChallengeList');

const CHALLENGES = [
  { id: 'ch1', title: 'String Formatter', difficulty: 'easy', category: 'model_selection', skillTested: 'Strings' },
  { id: 'ch2', title: 'Event Emitter', difficulty: 'medium', category: 'prompt_efficiency', skillTested: 'Events' },
  { id: 'ch3', title: 'Data Pipeline', difficulty: 'hard', category: 'iterative_debugging', skillTested: 'Data' },
];

const CUSTOM_CHALLENGES = [
  { id: 'cc1', title: 'Custom Test', difficulty: 'easy', category: 'model_selection', skillTested: 'Custom', status: 'active', description: '', language: 'js', starterCode: null, testCases: '', hiddenTestCases: null, testHarness: null, aiGenerated: 0, tags: null },
  { id: 'cc2', title: 'Draft Custom', difficulty: 'medium', category: 'prompt_efficiency', skillTested: 'Draft', status: 'draft', description: '', language: 'js', starterCode: null, testCases: '', hiddenTestCases: null, testHarness: null, aiGenerated: 0, tags: null },
];

const baseProps = {
  allChallenges: CHALLENGES,
  customChallenges: [] as any[],
  selectedChallengeIds: [] as string[],
  onToggle: vi.fn(),
  onSelectAll: vi.fn(),
  onClearAll: vi.fn(),
  loadError: null as string | null,
};

describe('AssessmentChallengeList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the section label with selected count', () => {
    render(<AssessmentChallengeList {...baseProps} selectedChallengeIds={['ch1']} />);
    expect(screen.getByText('Challenges (1 selected)')).toBeInTheDocument();
  });

  it('renders all challenges', () => {
    render(<AssessmentChallengeList {...baseProps} />);
    expect(screen.getByText('String Formatter')).toBeInTheDocument();
    expect(screen.getByText('Event Emitter')).toBeInTheDocument();
    expect(screen.getByText('Data Pipeline')).toBeInTheDocument();
  });

  it('shows total count of shown challenges', () => {
    render(<AssessmentChallengeList {...baseProps} />);
    expect(screen.getByText('3 challenges shown')).toBeInTheDocument();
  });

  it('calls onToggle when a challenge row is clicked', () => {
    const onToggle = vi.fn();
    render(<AssessmentChallengeList {...baseProps} onToggle={onToggle} />);
    fireEvent.click(screen.getByText('String Formatter'));
    expect(onToggle).toHaveBeenCalledWith('ch1');
  });

  it('shows checkmark for selected challenges', () => {
    render(<AssessmentChallengeList {...baseProps} selectedChallengeIds={['ch1']} />);
    // ch1 is selected, should have checkmark character
    const checks = screen.getAllByText('\u2713');
    expect(checks.length).toBeGreaterThan(0);
  });

  it('shows circle for unselected challenges', () => {
    render(<AssessmentChallengeList {...baseProps} selectedChallengeIds={[]} />);
    const circles = screen.getAllByText('\u25CB');
    expect(circles.length).toBe(3);
  });

  it('renders search input', () => {
    render(<AssessmentChallengeList {...baseProps} />);
    expect(screen.getByPlaceholderText('Search challenges...')).toBeInTheDocument();
  });

  it('filters challenges by search text', () => {
    render(<AssessmentChallengeList {...baseProps} />);
    fireEvent.change(screen.getByPlaceholderText('Search challenges...'), { target: { value: 'String' } });
    expect(screen.getByText('String Formatter')).toBeInTheDocument();
    expect(screen.queryByText('Event Emitter')).toBeNull();
    expect(screen.queryByText('Data Pipeline')).toBeNull();
    expect(screen.getByText('1 challenges shown')).toBeInTheDocument();
  });

  it('filters challenges by skill tested', () => {
    render(<AssessmentChallengeList {...baseProps} />);
    fireEvent.change(screen.getByPlaceholderText('Search challenges...'), { target: { value: 'Events' } });
    expect(screen.getByText('Event Emitter')).toBeInTheDocument();
    expect(screen.queryByText('String Formatter')).toBeNull();
  });

  it('renders difficulty filter pills', () => {
    render(<AssessmentChallengeList {...baseProps} />);
    expect(screen.getByText('All Levels')).toBeInTheDocument();
    expect(screen.getByText('Sprint')).toBeInTheDocument();
    // 'Easy' appears in both the filter pill and the difficulty badge on ch1
    expect(screen.getAllByText('Easy').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Medium').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Hard').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Impossible')).toBeInTheDocument();
  });

  it('filters by difficulty when pill is clicked', () => {
    render(<AssessmentChallengeList {...baseProps} />);
    // 'Easy' appears in filter pill and badge; click the first one (the filter pill)
    fireEvent.click(screen.getAllByText('Easy')[0]);
    expect(screen.getByText('String Formatter')).toBeInTheDocument();
    expect(screen.queryByText('Event Emitter')).toBeNull();
    expect(screen.queryByText('Data Pipeline')).toBeNull();
  });

  it('renders category filter pills', () => {
    render(<AssessmentChallengeList {...baseProps} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    // 'Model Selection' appears in filter pill and as category label on challenge row
    expect(screen.getAllByText('Model Selection').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Prompt Efficiency').length).toBeGreaterThanOrEqual(1);
  });

  it('filters by category when pill is clicked', () => {
    render(<AssessmentChallengeList {...baseProps} />);
    // Click the first 'Model Selection' (the filter pill)
    fireEvent.click(screen.getAllByText('Model Selection')[0]);
    expect(screen.getByText('String Formatter')).toBeInTheDocument();
    expect(screen.queryByText('Event Emitter')).toBeNull();
    expect(screen.queryByText('Data Pipeline')).toBeNull();
  });

  it('shows Select All Visible button', () => {
    render(<AssessmentChallengeList {...baseProps} />);
    expect(screen.getByText('Select All Visible')).toBeInTheDocument();
  });

  it('calls onSelectAll with visible challenge IDs', () => {
    const onSelectAll = vi.fn();
    render(<AssessmentChallengeList {...baseProps} onSelectAll={onSelectAll} />);
    fireEvent.click(screen.getByText('Select All Visible'));
    expect(onSelectAll).toHaveBeenCalledWith(['ch1', 'ch2', 'ch3']);
  });

  it('shows Clear All button when challenges are selected', () => {
    render(<AssessmentChallengeList {...baseProps} selectedChallengeIds={['ch1']} />);
    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('does not show Clear All button when nothing is selected', () => {
    render(<AssessmentChallengeList {...baseProps} selectedChallengeIds={[]} />);
    expect(screen.queryByText('Clear All')).toBeNull();
  });

  it('calls onClearAll when Clear All is clicked', () => {
    const onClearAll = vi.fn();
    render(<AssessmentChallengeList {...baseProps} selectedChallengeIds={['ch1']} onClearAll={onClearAll} />);
    fireEvent.click(screen.getByText('Clear All'));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('renders loadError when present', () => {
    render(<AssessmentChallengeList {...baseProps} loadError="Failed to load" />);
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('shows empty filter state when no challenges match filters', () => {
    render(<AssessmentChallengeList {...baseProps} />);
    fireEvent.change(screen.getByPlaceholderText('Search challenges...'), { target: { value: 'zzzzzzz' } });
    expect(screen.getByText('No challenges match your filters')).toBeInTheDocument();
  });

  it('shows Clear filters button when no results', () => {
    render(<AssessmentChallengeList {...baseProps} />);
    fireEvent.change(screen.getByPlaceholderText('Search challenges...'), { target: { value: 'zzzzzzz' } });
    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('resets filters on Clear filters click', () => {
    render(<AssessmentChallengeList {...baseProps} />);
    fireEvent.change(screen.getByPlaceholderText('Search challenges...'), { target: { value: 'zzzzzzz' } });
    fireEvent.click(screen.getByText('Clear filters'));
    expect(screen.getByText('String Formatter')).toBeInTheDocument();
    expect(screen.getByText('3 challenges shown')).toBeInTheDocument();
  });

  it('renders active custom challenges', () => {
    render(<AssessmentChallengeList {...baseProps} customChallenges={CUSTOM_CHALLENGES} />);
    expect(screen.getByText('Custom Test')).toBeInTheDocument();
    // Draft custom should not appear
    expect(screen.queryByText('Draft Custom')).toBeNull();
  });

  it('shows Custom badge for custom challenges', () => {
    render(<AssessmentChallengeList {...baseProps} customChallenges={CUSTOM_CHALLENGES} />);
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('shows Custom Challenges divider when both normal and custom challenges are visible', () => {
    render(<AssessmentChallengeList {...baseProps} customChallenges={CUSTOM_CHALLENGES} />);
    expect(screen.getByText('Custom Challenges')).toBeInTheDocument();
  });

  it('does not show Custom Challenges divider when no custom challenges match', () => {
    render(<AssessmentChallengeList {...baseProps} customChallenges={[]} />);
    expect(screen.queryByText('Custom Challenges')).toBeNull();
  });

  it('calls onToggle for custom challenges', () => {
    const onToggle = vi.fn();
    render(<AssessmentChallengeList {...baseProps} customChallenges={CUSTOM_CHALLENGES} onToggle={onToggle} />);
    fireEvent.click(screen.getByText('Custom Test'));
    expect(onToggle).toHaveBeenCalledWith('cc1');
  });

  it('includes custom challenges in Select All Visible', () => {
    const onSelectAll = vi.fn();
    render(<AssessmentChallengeList {...baseProps} customChallenges={CUSTOM_CHALLENGES} onSelectAll={onSelectAll} />);
    fireEvent.click(screen.getByText('Select All Visible'));
    expect(onSelectAll).toHaveBeenCalledWith(['ch1', 'ch2', 'ch3', 'cc1']);
  });

  it('difficulty badge renders correctly for each challenge', () => {
    render(<AssessmentChallengeList {...baseProps} />);
    // getDifficultyStyle mock returns label based on difficulty string capitalized
    // 'Easy' appears in both filter pill and badge
    expect(screen.getAllByText('Easy').length).toBeGreaterThanOrEqual(2);
  });

  // ─── Selected filter pill ────────────────────────────────────────────

  it('does not render Selected pill when no challenges are selected', () => {
    render(<AssessmentChallengeList {...baseProps} selectedChallengeIds={[]} />);
    expect(screen.queryByText(/^Selected \(/)).toBeNull();
  });

  it('renders Selected pill with count when challenges are selected', () => {
    render(<AssessmentChallengeList {...baseProps} selectedChallengeIds={['ch1', 'ch2']} />);
    expect(screen.getByText('Selected (2)')).toBeInTheDocument();
  });

  it('clicking Selected pill filters to only selected challenges', () => {
    render(<AssessmentChallengeList {...baseProps} selectedChallengeIds={['ch1']} />);
    fireEvent.click(screen.getByText('Selected (1)'));
    expect(screen.getByText('String Formatter')).toBeInTheDocument();
    expect(screen.queryByText('Event Emitter')).toBeNull();
    expect(screen.queryByText('Data Pipeline')).toBeNull();
    expect(screen.getByText('1 challenges shown')).toBeInTheDocument();
  });

  it('toggling Selected pill off shows all challenges again', () => {
    render(<AssessmentChallengeList {...baseProps} selectedChallengeIds={['ch1']} />);
    fireEvent.click(screen.getByText('Selected (1)'));
    expect(screen.queryByText('Event Emitter')).toBeNull();
    // Toggle off
    fireEvent.click(screen.getByText('Selected (1)'));
    expect(screen.getByText('Event Emitter')).toBeInTheDocument();
    expect(screen.getByText('3 challenges shown')).toBeInTheDocument();
  });

  it('Selected filter combines with difficulty filter', () => {
    render(<AssessmentChallengeList {...baseProps} selectedChallengeIds={['ch1', 'ch3']} />);
    // Activate Selected filter
    fireEvent.click(screen.getByText('Selected (2)'));
    expect(screen.getByText('String Formatter')).toBeInTheDocument();
    expect(screen.getByText('Data Pipeline')).toBeInTheDocument();
    expect(screen.queryByText('Event Emitter')).toBeNull();
    // Now also filter by Hard difficulty
    fireEvent.click(screen.getAllByText('Hard')[0]);
    expect(screen.queryByText('String Formatter')).toBeNull();
    expect(screen.getByText('Data Pipeline')).toBeInTheDocument();
  });

  it('Clear filters resets Selected filter', () => {
    render(<AssessmentChallengeList {...baseProps} selectedChallengeIds={['ch1']} />);
    // Activate Selected filter and search to get zero results
    fireEvent.click(screen.getByText('Selected (1)'));
    fireEvent.change(screen.getByPlaceholderText('Search challenges...'), { target: { value: 'zzzzzzz' } });
    expect(screen.getByText('No challenges match your filters')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Clear filters'));
    // All 3 challenges should be back
    expect(screen.getByText('3 challenges shown')).toBeInTheDocument();
  });
});
