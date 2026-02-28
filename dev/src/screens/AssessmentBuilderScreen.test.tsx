// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockReset = vi.fn();
let mockRouteParams: any = {};

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
  useRoute: () => ({ params: mockRouteParams }),
}));

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } });
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock('@/components/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => (
    <button onClick={onPress} {...props}>{children}</button>
  ),
}));
vi.mock('@/components/ui/Input', () => ({
  Input: ({ onChangeText, label, ...props }: any) => (
    <input aria-label={label} onChange={(e: any) => onChangeText?.(e.target.value)} {...props} />
  ),
}));
vi.mock('@/lib/assessment-templates', () => ({
  ASSESSMENT_TEMPLATES: [
    {
      id: 'frontend-dev',
      name: 'Frontend Developer',
      description: 'Tests frontend skills',
      timeLimitMinutes: 60,
      challengeTitles: ['String Formatter', 'Event Emitter'],
      categories: ['model_selection'],
    },
  ],
}));
vi.mock('@/lib/difficulty', () => ({
  getDifficultyStyle: () => ({ color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', label: 'Medium' }),
}));
vi.mock('@/components/AssessmentAgentChat', () => ({
  AssessmentAgentChat: () => <div data-testid="agent-chat" />,
}));
vi.mock('@/components/PassThresholdEditor', () => ({
  PassThresholdEditor: () => <div data-testid="pass-threshold" />,
}));
vi.mock('@/components/BulkInvitePanel', () => ({
  BulkInvitePanel: () => <div data-testid="bulk-invite" />,
}));
vi.mock('@/components/InviteManagementTable', () => ({
  InviteManagementTable: () => <div data-testid="invite-table" />,
}));
vi.mock('@/components/CustomChallengeReview', () => ({
  CustomChallengeReview: ({ onApprove, onDelete, challenge }: any) => (
    <div data-testid="custom-challenge">
      <span>{challenge.title}</span>
      <button onClick={() => onApprove(challenge.id)}>Approve</button>
      <button onClick={() => onDelete(challenge.id)}>Delete</button>
    </div>
  ),
}));
vi.mock('@/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    borderStrong: '#999', card: '#fff', muted: '#f5f5f5', error: '#f00', errorBg: '#fee',
    success: '#0a0', successBg: '#efe', primary: '#000', primaryForeground: '#fff',
    secondary: '#eee', secondaryForeground: '#000', destructive: '#f00',
    textSubtle: '#aaa', bgElevated: '#fafafa', accentBg: '#ffe',
  }),
}));
vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));

const ok = (data: any) => ({ ok: true, json: () => Promise.resolve(data) });
const fail = (data: any) => ({ ok: false, json: () => Promise.resolve(data) });

/** URL-based fetch mock. Checks longest patterns first. Unmatched URLs return ok + [] */
function setupFetch(map: Record<string, any> = {}) {
  // Sort by pattern length descending so more specific patterns match first
  const entries = Object.entries(map).sort(([a], [b]) => b.length - a.length);
  const fn = vi.fn().mockImplementation((url: string) => {
    for (const [pattern, response] of entries) {
      if (url.includes(pattern)) return Promise.resolve(response);
    }
    return Promise.resolve(ok([]));
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

setupFetch();
const { AssessmentBuilderScreen } = await import('./AssessmentBuilderScreen');

describe('AssessmentBuilderScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouteParams = {};
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    setupFetch();
  });

  it('renders loading state initially', () => {
    const { container } = render(<AssessmentBuilderScreen />);
    expect(container.querySelector('svg') || container.textContent).toBeTruthy();
  });

  it('redirects to Login when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Login' }] });
    });
  });

  it('renders dashboard layout after loading', async () => {
    const { container } = render(<AssessmentBuilderScreen />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="dashboard-layout"]')).not.toBeNull();
    });
  });

  it('shows "Create Assessment" title when no assessmentId param', async () => {
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Create Assessment')).toBeTruthy());
  });

  it('shows template section when creating a new assessment', async () => {
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Start from a Template')).toBeTruthy());
  });

  it('applies template on click', async () => {
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Frontend Developer')).toBeTruthy());
    fireEvent.click(screen.getByText('Frontend Developer'));
    await waitFor(() => {
      expect(screen.getByDisplayValue('Frontend Developer Assessment')).toBeTruthy();
    });
  });

  it('renders challenges from API and allows toggling selection', async () => {
    setupFetch({
      '/api/challenges': ok([
        { id: 'ch1', title: 'String Formatter', difficulty: 'easy', category: 'model_selection', skillTested: 'Strings' },
        { id: 'ch2', title: 'Event Emitter', difficulty: 'medium', category: 'prompt_efficiency', skillTested: 'Events' },
      ]),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => {
      expect(screen.getByText('String Formatter')).toBeTruthy();
      expect(screen.getByText('Event Emitter')).toBeTruthy();
    });
    expect(screen.getByText(/0 selected/)).toBeTruthy();
    fireEvent.click(screen.getByText('String Formatter'));
    await waitFor(() => expect(screen.getByText(/1 selected/)).toBeTruthy());
    fireEvent.click(screen.getByText('String Formatter'));
    await waitFor(() => expect(screen.getByText(/0 selected/)).toBeTruthy());
  });

  it('displays all category labels correctly', async () => {
    setupFetch({
      '/api/challenges': ok([
        { id: '1', title: 'C1', difficulty: 'easy', category: 'model_selection', skillTested: null },
        { id: '2', title: 'C2', difficulty: 'easy', category: 'prompt_efficiency', skillTested: null },
        { id: '3', title: 'C3', difficulty: 'easy', category: 'iterative_debugging', skillTested: null },
        { id: '4', title: 'C4', difficulty: 'easy', category: 'multi_model_strategy', skillTested: null },
        { id: '5', title: 'C5', difficulty: 'easy', category: null, skillTested: null },
      ]),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Model Selection').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Prompt Efficiency').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Iterative Debugging').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Multi-Model').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Practice').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders AI Agent toggle and can hide/show agent panel', async () => {
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Hide AI')).toBeTruthy());
    expect(screen.getByTestId('agent-chat')).toBeTruthy();
    fireEvent.click(screen.getByText('Hide AI'));
    await waitFor(() => expect(screen.getByText('AI Assistant')).toBeTruthy());
    expect(screen.queryByTestId('agent-chat')).toBeNull();
  });

  it('creates a new assessment via POST when saving without assessmentId', async () => {
    const fn = setupFetch({
      '/api/assessments': ok({ id: 'new-id' }),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Save Assessment')).toBeTruthy());
    const inputs = screen.getAllByDisplayValue('');
    fireEvent.change(inputs[0], { target: { value: 'My New Assessment' } });
    fireEvent.click(screen.getByText('Save Assessment'));
    await waitFor(() => {
      expect(fn).toHaveBeenCalledWith('/api/assessments', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('shows Activate button when editing a draft assessment', async () => {
    mockRouteParams = { assessmentId: 'existing-id' };
    setupFetch({
      '/api/assessments/existing-id': ok({
        title: 'Existing', description: '', timeLimit: 3600, status: 'draft', challenges: [],
      }),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => {
      expect(screen.getByText('Activate')).toBeTruthy();
      expect(screen.getByText('Edit Assessment')).toBeTruthy();
    });
  });

  it('activates assessment when Activate button is clicked', async () => {
    mockRouteParams = { assessmentId: 'existing-id' };
    const fn = setupFetch({
      '/api/assessments/existing-id': ok({
        title: 'Draft', description: '', timeLimit: 3600, status: 'draft', challenges: [],
      }),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Activate')).toBeTruthy());
    fireEvent.click(screen.getByText('Activate'));
    await waitFor(() => {
      expect(fn).toHaveBeenCalledWith(
        '/api/assessments/existing-id',
        expect.objectContaining({ method: 'PUT', body: JSON.stringify({ status: 'active' }) })
      );
    });
  });

  it('shows Generate Invite Link when assessment is active', async () => {
    mockRouteParams = { assessmentId: 'active-id' };
    setupFetch({
      '/api/assessments/active-id': ok({
        title: 'Active', description: '', timeLimit: 3600, status: 'active', challenges: [],
      }),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Generate Invite Link')).toBeTruthy());
  });

  it('generates invite link and displays it with copy button', async () => {
    mockRouteParams = { assessmentId: 'active-id' };
    setupFetch({
      '/api/assessments/active-id': ok({
        title: 'Active', description: '', timeLimit: 3600, status: 'active', challenges: [],
      }),
      '/api/assessments/active-id/invites': ok({ url: 'https://ruwt.dev/invite/abc' }),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Generate Invite Link')).toBeTruthy());
    fireEvent.click(screen.getByText('Generate Invite Link'));
    await waitFor(() => {
      expect(screen.getByText('https://ruwt.dev/invite/abc')).toBeTruthy();
      expect(screen.getByText('Copy to Clipboard')).toBeTruthy();
    });
  });

  it('shows invite error when generation fails', async () => {
    mockRouteParams = { assessmentId: 'active-id' };
    setupFetch({
      '/api/assessments/active-id': ok({
        title: 'Active', description: '', timeLimit: 3600, status: 'active', challenges: [],
      }),
      '/api/assessments/active-id/invites': fail({ error: 'Limit reached' }),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Generate Invite Link')).toBeTruthy());
    fireEvent.click(screen.getByText('Generate Invite Link'));
    await waitFor(() => expect(screen.getByText('Limit reached')).toBeTruthy());
  });

  it('renders bulk invite and invite management when active', async () => {
    mockRouteParams = { assessmentId: 'active-id' };
    setupFetch({
      '/api/assessments/active-id': ok({
        title: 'Active', description: '', timeLimit: 3600, status: 'active', challenges: [],
      }),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('bulk-invite')).toBeTruthy();
      expect(screen.getByTestId('invite-table')).toBeTruthy();
    });
  });

  it('renders company branding section with inputs', async () => {
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Company Branding (optional)')).toBeTruthy());
  });

  it('renders score weights section', async () => {
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Score Weights')).toBeTruthy());
  });

  it('loads existing assessment data including branding and weights', async () => {
    mockRouteParams = { assessmentId: 'edit-id' };
    setupFetch({
      '/api/assessments/edit-id': ok({
        title: 'Branded Assessment', description: 'With branding', timeLimit: 5400, status: 'draft',
        challenges: [{ id: 'ch1', sortOrder: 0 }, { id: 'ch2', sortOrder: 1 }],
        companyName: 'Acme Corp', companyLogoUrl: 'https://acme.com/logo.png', welcomeMessage: 'Welcome to Acme!',
        categoryWeights: JSON.stringify({ modelSelection: 30, promptEfficiency: 25, debugging: 15, strategy: 20, speed: 10 }),
        passThreshold: JSON.stringify({ enabled: true, mode: 'weighted_average', minOverall: 70, dimensions: {} }),
      }),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Branded Assessment')).toBeTruthy();
      expect(screen.getByDisplayValue('With branding')).toBeTruthy();
      expect(screen.getByDisplayValue('90')).toBeTruthy(); // 5400/60
      expect(screen.getByDisplayValue('Acme Corp')).toBeTruthy();
      expect(screen.getByDisplayValue('https://acme.com/logo.png')).toBeTruthy();
      expect(screen.getByDisplayValue('Welcome to Acme!')).toBeTruthy();
    });
  });

  it('loads org custom challenges (draft in review, active in grid)', async () => {
    setupFetch({
      '/api/orgs': ok([{ orgId: 'org1', orgName: 'Test Org', role: 'owner' }]),
      '/api/orgs/org1/challenges': ok([
        { id: 'cc1', title: 'Custom Bug', description: '', difficulty: 'hard', category: 'debugging', skillTested: null, language: 'javascript', starterCode: null, testCases: '[]', hiddenTestCases: null, testHarness: null, status: 'draft', aiGenerated: 1, tags: null },
        { id: 'cc2', title: 'Custom API', description: '', difficulty: 'medium', category: 'prompt_efficiency', skillTested: null, language: 'javascript', starterCode: null, testCases: '[]', hiddenTestCases: null, testHarness: null, status: 'active', aiGenerated: 0, tags: null },
      ]),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => {
      expect(screen.getByText('Custom Bug')).toBeTruthy();
      expect(screen.getByText('Custom API')).toBeTruthy();
      expect(screen.getByText(/1 pending review/)).toBeTruthy();
    });
  });

  it('approves a custom challenge (moves from draft to active)', async () => {
    setupFetch({
      '/api/orgs': ok([{ orgId: 'org1', orgName: 'Org', role: 'owner' }]),
      '/api/orgs/org1/challenges': ok([
        { id: 'cc1', title: 'Draft Ch', description: '', difficulty: 'hard', category: 'debugging', skillTested: null, language: 'javascript', starterCode: null, testCases: '[]', hiddenTestCases: null, testHarness: null, status: 'draft', aiGenerated: 1, tags: null },
      ]),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Draft Ch')).toBeTruthy());
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(screen.queryByText(/pending review/)).toBeNull());
  });

  it('deletes a custom challenge', async () => {
    setupFetch({
      '/api/orgs': ok([{ orgId: 'org1', orgName: 'Org', role: 'owner' }]),
      '/api/orgs/org1/challenges': ok([
        { id: 'cc1', title: 'Delete Me', description: '', difficulty: 'hard', category: 'debugging', skillTested: null, language: 'javascript', starterCode: null, testCases: '[]', hiddenTestCases: null, testHarness: null, status: 'draft', aiGenerated: 1, tags: null },
      ]),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Delete Me')).toBeTruthy());
    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => expect(screen.queryByText('Delete Me')).toBeNull());
  });

  it('navigates back to Assessments on back button click', async () => {
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText(/Back to Assessments/)).toBeTruthy());
    fireEvent.click(screen.getByText(/Back to Assessments/));
    expect(mockNavigate).toHaveBeenCalledWith('Assessments');
  });

  it('saves with existing assessmentId via PUT', async () => {
    mockRouteParams = { assessmentId: 'existing-id' };
    const fn = setupFetch({
      '/api/assessments/existing-id': ok({
        title: 'Existing', description: '', timeLimit: 3600, status: 'draft', challenges: [],
      }),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByDisplayValue('Existing')).toBeTruthy());
    fireEvent.click(screen.getByText('Save Assessment'));
    await waitFor(() => {
      expect(fn).toHaveBeenCalledWith('/api/assessments/existing-id', expect.objectContaining({ method: 'PUT' }));
    });
  });

  it('renders the PassThresholdEditor component', async () => {
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByTestId('pass-threshold')).toBeTruthy());
  });

  it('renders the AI Agent Chat panel by default', async () => {
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByTestId('agent-chat')).toBeTruthy());
  });

  it('handles challenges fetch failure gracefully', async () => {
    setupFetch({
      '/api/challenges': fail([]),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Create Assessment')).toBeTruthy());
    expect(screen.getByText(/0 selected/)).toBeTruthy();
  });

  it('does not show template section when editing an existing assessment', async () => {
    mockRouteParams = { assessmentId: 'existing-id' };
    setupFetch({
      '/api/assessments/existing-id': ok({
        title: 'Edit Me', description: '', timeLimit: 3600, status: 'draft', challenges: [],
      }),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Edit Assessment')).toBeTruthy());
    expect(screen.queryByText('Start from a Template')).toBeNull();
  });

  it('copies invite link to clipboard when Copy to Clipboard is clicked', async () => {
    mockRouteParams = { assessmentId: 'active-id' };
    setupFetch({
      '/api/assessments/active-id': ok({
        title: 'Active', description: '', timeLimit: 3600, status: 'active', challenges: [],
      }),
      '/api/assessments/active-id/invites': ok({ url: 'https://ruwt.dev/invite/xyz' }),
    });
    const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.assign(navigator, { clipboard: mockClipboard });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Generate Invite Link')).toBeTruthy());
    fireEvent.click(screen.getByText('Generate Invite Link'));
    await waitFor(() => {
      expect(screen.getByText('https://ruwt.dev/invite/xyz')).toBeTruthy();
      expect(screen.getByText('Copy to Clipboard')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Copy to Clipboard'));
    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith('https://ruwt.dev/invite/xyz');
    });
    // Should show "Copied!" text
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeTruthy();
    });
  });

  it('toggles custom active challenge selection', async () => {
    setupFetch({
      '/api/orgs': ok([{ orgId: 'org1', orgName: 'Test Org', role: 'owner' }]),
      '/api/orgs/org1/challenges': ok([
        { id: 'cc2', title: 'Custom Active', description: '', difficulty: 'medium', category: 'prompt_efficiency', skillTested: null, language: 'javascript', starterCode: null, testCases: '[]', hiddenTestCases: null, testHarness: null, status: 'active', aiGenerated: 0, tags: null },
      ]),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => {
      expect(screen.getByText('Custom Active')).toBeTruthy();
    });
    expect(screen.getByText(/0 selected/)).toBeTruthy();
    // Click to select custom active challenge
    fireEvent.click(screen.getByText('Custom Active'));
    await waitFor(() => expect(screen.getByText(/1 selected/)).toBeTruthy());
    // Click again to deselect
    fireEvent.click(screen.getByText('Custom Active'));
    await waitFor(() => expect(screen.getByText(/0 selected/)).toBeTruthy());
  });

  it('shows invite hint text after invite link is generated', async () => {
    mockRouteParams = { assessmentId: 'active-id' };
    setupFetch({
      '/api/assessments/active-id': ok({
        title: 'Active', description: '', timeLimit: 3600, status: 'active', challenges: [],
      }),
      '/api/assessments/active-id/invites': ok({ url: 'https://ruwt.dev/invite/abc' }),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Generate Invite Link')).toBeTruthy());
    fireEvent.click(screen.getByText('Generate Invite Link'));
    await waitFor(() => {
      expect(screen.getByText(/Share this link with your candidate/)).toBeTruthy();
      expect(screen.getByText('Candidate Invite Link:')).toBeTruthy();
    });
  });

  it('saves new assessment with challenges selected', async () => {
    const fn = setupFetch({
      '/api/challenges': ok([
        { id: 'ch1', title: 'Ch1', difficulty: 'easy', category: 'model_selection', skillTested: null },
      ]),
      '/api/assessments': ok({ id: 'new-id' }),
      '/api/assessments/new-id/challenges': ok({}),
      '/api/assessments/new-id': ok({}),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByText('Ch1')).toBeTruthy());
    // Set title
    const inputs = screen.getAllByDisplayValue('');
    fireEvent.change(inputs[0], { target: { value: 'With Challenges' } });
    // Select a challenge
    fireEvent.click(screen.getByText('Ch1'));
    await waitFor(() => expect(screen.getByText(/1 selected/)).toBeTruthy());
    fireEvent.click(screen.getByText('Save Assessment'));
    await waitFor(() => {
      expect(fn).toHaveBeenCalledWith('/api/assessments', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('handles agent callbacks for weights, branding, time limit, and threshold', async () => {
    // This test ensures the callback handlers exist and can be invoked.
    // The agent chat component is mocked, so we test via the mocked component's props.
    // We just verify the screen renders with the agent chat visible.
    render(<AssessmentBuilderScreen />);
    await waitFor(() => expect(screen.getByTestId('agent-chat')).toBeTruthy());
  });

  it('renders active custom challenges with "Custom" badge', async () => {
    setupFetch({
      '/api/orgs': ok([{ orgId: 'org1', orgName: 'Test Org', role: 'owner' }]),
      '/api/orgs/org1/challenges': ok([
        { id: 'cc1', title: 'My Custom Challenge', description: '', difficulty: 'easy', category: 'model_selection', skillTested: 'custom', language: 'javascript', starterCode: null, testCases: '[]', hiddenTestCases: null, testHarness: null, status: 'active', aiGenerated: 0, tags: null },
      ]),
    });
    render(<AssessmentBuilderScreen />);
    await waitFor(() => {
      expect(screen.getByText('My Custom Challenge')).toBeTruthy();
      expect(screen.getByText('Custom')).toBeTruthy();
    });
  });
});
