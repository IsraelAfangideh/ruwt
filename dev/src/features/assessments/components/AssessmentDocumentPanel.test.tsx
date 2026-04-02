// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockChallengeListProps, mockAdvancedProps, mockInviteProps, mockCustomReviewProps } = vi.hoisted(() => ({
  mockChallengeListProps: { current: null as any },
  mockAdvancedProps: { current: null as any },
  mockInviteProps: { current: null as any },
  mockCustomReviewProps: { current: [] as any[] },
}));

vi.mock('./AssessmentChallengeList', () => ({
  AssessmentChallengeList: (props: any) => {
    mockChallengeListProps.current = props;
    return <div data-testid="challenge-list" />;
  },
}));
vi.mock('./AssessmentAdvancedSection', () => ({
  AssessmentAdvancedSection: (props: any) => {
    mockAdvancedProps.current = props;
    return <div data-testid="advanced-section" />;
  },
}));
vi.mock('./AssessmentInviteSection', () => ({
  AssessmentInviteSection: (props: any) => {
    mockInviteProps.current = props;
    return <div data-testid="invite-section" />;
  },
}));
vi.mock('@/features/assessments/components/CustomChallengeReview', () => ({
  CustomChallengeReview: ({ challenge, onApprove, onDelete }: any) => {
    mockCustomReviewProps.current.push({ challenge, onApprove, onDelete });
    return (
      <div data-testid="custom-review">
        <span>{challenge.title}</span>
        <button onClick={() => onApprove(challenge.id)}>Approve</button>
        <button onClick={() => onDelete(challenge.id)}>Delete</button>
      </div>
    );
  },
}));

vi.mock('@/shared/ui/Input', () => ({
  Input: ({ onChangeText, label, value, ...props }: any) => (
    <input aria-label={label} value={value || ''} onChange={(e: any) => onChangeText?.(e.target.value)} {...props} />
  ),
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const { AssessmentDocumentPanel } = await import('./AssessmentDocumentPanel');

const baseProps = {
  title: '',
  description: '',
  setTitle: vi.fn(),
  setDescription: vi.fn(),
  allChallenges: [] as any[],
  selectedChallengeIds: [] as string[],
  customChallenges: [] as any[],
  orgId: null as string | null,
  toggleChallenge: vi.fn(),
  setSelectedChallengeIds: vi.fn(),
  companyName: '',
  companyLogoUrl: '',
  welcomeMessage: '',
  setCompanyName: vi.fn(),
  setCompanyLogoUrl: vi.fn(),
  setWelcomeMessage: vi.fn(),
  weights: { modelSelection: '20', promptEfficiency: '20', debugging: '20', strategy: '20', speed: '20' },
  weightSum: 100,
  setWeights: vi.fn(),
  passThreshold: null,
  setPassThreshold: vi.fn(),
  timeLimitMinutes: '60',
  setTimeLimitMinutes: vi.fn(),
  assessmentId: undefined as string | undefined,
  status: 'draft',
  loadError: null as string | null,
  inviteLink: null as string | null,
  copied: false,
  copyInviteLink: vi.fn(),
  handleGenerateInvite: vi.fn(),
  generatingInvite: false,
  inviteRefreshKey: 0,
  handleInvitesSent: vi.fn(),
  handleApproveCustomChallenge: vi.fn(),
  handleDeleteCustomChallenge: vi.fn(),
  dirty: false,
};

const DRAFT_CUSTOM_CHALLENGE = {
  id: 'cc1', title: 'Draft Custom', status: 'draft', difficulty: 'easy', category: 'test',
  description: '', skillTested: null, language: 'js', starterCode: null, testCases: '',
  hiddenTestCases: null, testHarness: null, aiGenerated: 1, tags: null,
};

describe('AssessmentDocumentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChallengeListProps.current = null;
    mockAdvancedProps.current = null;
    mockInviteProps.current = null;
    mockCustomReviewProps.current = [];
  });

  it('renders empty state when no title and no challenges selected', () => {
    render(<AssessmentDocumentPanel {...baseProps} />);
    expect(screen.getByText('Your assessment will appear here')).toBeInTheDocument();
    expect(screen.getByText(/Use the AI chat/)).toBeInTheDocument();
  });

  it('does not render empty state when title is set', () => {
    render(<AssessmentDocumentPanel {...baseProps} title="My Assessment" />);
    expect(screen.queryByText('Your assessment will appear here')).toBeNull();
  });

  it('does not render empty state when challenges are selected', () => {
    render(<AssessmentDocumentPanel {...baseProps} selectedChallengeIds={['ch1']} />);
    expect(screen.queryByText('Your assessment will appear here')).toBeNull();
  });

  it('renders title input', () => {
    render(<AssessmentDocumentPanel {...baseProps} />);
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
  });

  it('shows "Title required" when title is empty and form is dirty', () => {
    render(<AssessmentDocumentPanel {...baseProps} title="" dirty={true} />);
    expect(screen.getByText('Title required')).toBeInTheDocument();
  });

  it('hides "Title required" when title is empty but form is not dirty', () => {
    render(<AssessmentDocumentPanel {...baseProps} title="" dirty={false} />);
    expect(screen.queryByText('Title required')).toBeNull();
  });

  it('hides "Title required" when title is set', () => {
    render(<AssessmentDocumentPanel {...baseProps} title="My Assessment" />);
    expect(screen.queryByText('Title required')).toBeNull();
  });

  it('renders description input', () => {
    render(<AssessmentDocumentPanel {...baseProps} />);
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
  });

  it('calls setTitle when title input changes', () => {
    const setTitle = vi.fn();
    render(<AssessmentDocumentPanel {...baseProps} setTitle={setTitle} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Title' } });
    expect(setTitle).toHaveBeenCalledWith('New Title');
  });

  it('calls setDescription when description input changes', () => {
    const setDescription = vi.fn();
    render(<AssessmentDocumentPanel {...baseProps} setDescription={setDescription} />);
    fireEvent.change(screen.getByLabelText('Description (optional)'), { target: { value: 'Desc' } });
    expect(setDescription).toHaveBeenCalledWith('Desc');
  });

  it('renders AssessmentChallengeList', () => {
    render(<AssessmentDocumentPanel {...baseProps} />);
    expect(screen.getByTestId('challenge-list')).toBeInTheDocument();
  });

  it('passes correct props to AssessmentChallengeList', () => {
    const challenges = [{ id: 'ch1', title: 'T', difficulty: 'easy', category: null, skillTested: null }];
    render(<AssessmentDocumentPanel {...baseProps} allChallenges={challenges} selectedChallengeIds={['ch1']} />);
    expect(mockChallengeListProps.current.allChallenges).toEqual(challenges);
    expect(mockChallengeListProps.current.selectedChallengeIds).toEqual(['ch1']);
  });

  it('renders AssessmentAdvancedSection', () => {
    render(<AssessmentDocumentPanel {...baseProps} />);
    expect(screen.getByTestId('advanced-section')).toBeInTheDocument();
  });

  it('passes branding props to AssessmentAdvancedSection', () => {
    render(<AssessmentDocumentPanel {...baseProps} companyName="Acme" />);
    expect(mockAdvancedProps.current.companyName).toBe('Acme');
  });

  it('does not render InviteSection when not active', () => {
    render(<AssessmentDocumentPanel {...baseProps} assessmentId="a1" status="draft" />);
    expect(screen.queryByTestId('invite-section')).toBeNull();
  });

  it('renders InviteSection when assessment is active', () => {
    render(<AssessmentDocumentPanel {...baseProps} assessmentId="a1" status="active" />);
    expect(screen.getByTestId('invite-section')).toBeInTheDocument();
  });

  it('does not render InviteSection when assessmentId is undefined', () => {
    render(<AssessmentDocumentPanel {...baseProps} assessmentId={undefined} status="active" />);
    expect(screen.queryByTestId('invite-section')).toBeNull();
  });

  it('passes invite props to InviteSection', () => {
    render(<AssessmentDocumentPanel {...baseProps} assessmentId="a1" status="active" inviteLink="https://link" copied={true} />);
    expect(mockInviteProps.current.inviteLink).toBe('https://link');
    expect(mockInviteProps.current.copied).toBe(true);
  });

  it('does not render custom challenge review when no draft custom challenges', () => {
    render(<AssessmentDocumentPanel {...baseProps} customChallenges={[]} orgId="org1" />);
    expect(screen.queryByTestId('custom-review')).toBeNull();
  });

  it('renders custom challenge review for draft custom challenges', () => {
    render(<AssessmentDocumentPanel {...baseProps} customChallenges={[DRAFT_CUSTOM_CHALLENGE]} orgId="org1" />);
    expect(screen.getByText('Draft Custom')).toBeInTheDocument();
    expect(screen.getByText(/pending review/)).toBeInTheDocument();
  });

  it('does not render custom challenge review when orgId is null', () => {
    render(<AssessmentDocumentPanel {...baseProps} customChallenges={[DRAFT_CUSTOM_CHALLENGE]} orgId={null} />);
    expect(screen.queryByTestId('custom-review')).toBeNull();
  });

  it('filters out active custom challenges from review section', () => {
    render(<AssessmentDocumentPanel {...baseProps} customChallenges={[
      { ...DRAFT_CUSTOM_CHALLENGE, title: 'Active Custom', status: 'active' },
    ]} orgId="org1" />);
    expect(screen.queryByTestId('custom-review')).toBeNull();
  });

  it('calls handleApproveCustomChallenge when Approve is clicked', () => {
    const handleApprove = vi.fn();
    render(<AssessmentDocumentPanel {...baseProps} handleApproveCustomChallenge={handleApprove} customChallenges={[
      { ...DRAFT_CUSTOM_CHALLENGE, title: 'Draft' },
    ]} orgId="org1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(handleApprove).toHaveBeenCalledWith('cc1');
  });

  it('calls handleDeleteCustomChallenge when Delete is clicked', () => {
    const handleDelete = vi.fn();
    render(<AssessmentDocumentPanel {...baseProps} handleDeleteCustomChallenge={handleDelete} customChallenges={[
      { ...DRAFT_CUSTOM_CHALLENGE, title: 'Draft' },
    ]} orgId="org1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(handleDelete).toHaveBeenCalledWith('cc1');
  });

  it('onSelectAll callback merges new IDs with existing selected IDs', () => {
    const setSelectedChallengeIds = vi.fn();
    render(<AssessmentDocumentPanel {...baseProps} setSelectedChallengeIds={setSelectedChallengeIds} selectedChallengeIds={['ch1']} />);
    // Invoke onSelectAll via the captured props
    expect(mockChallengeListProps.current.onSelectAll).toBeDefined();
    mockChallengeListProps.current.onSelectAll(['ch2', 'ch3']);
    expect(setSelectedChallengeIds).toHaveBeenCalled();
    // The callback passes a function updater; call it to verify behavior
    const updater = setSelectedChallengeIds.mock.calls[0][0];
    const result = updater(['ch1']);
    expect(result).toEqual(expect.arrayContaining(['ch1', 'ch2', 'ch3']));
  });

  it('onClearAll callback clears all selected challenge IDs', () => {
    const setSelectedChallengeIds = vi.fn();
    render(<AssessmentDocumentPanel {...baseProps} setSelectedChallengeIds={setSelectedChallengeIds} selectedChallengeIds={['ch1']} />);
    expect(mockChallengeListProps.current.onClearAll).toBeDefined();
    mockChallengeListProps.current.onClearAll();
    expect(setSelectedChallengeIds).toHaveBeenCalledWith([]);
  });

  it('passes loadError to AssessmentChallengeList', () => {
    render(<AssessmentDocumentPanel {...baseProps} loadError="Failed to load" />);
    expect(mockChallengeListProps.current.loadError).toBe('Failed to load');
  });
});
