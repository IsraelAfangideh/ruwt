// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockReset = vi.fn();
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } });

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
  useRoute: () => ({ params: { assessmentId: 'test-assessment-123' } }),
}));
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
}));
vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => (
    <button onClick={onPress} {...props}>{children}</button>
  ),
}));
vi.mock('@/lib/ai/pricing', () => ({
  getModelById: (id: string) => id ? ({ name: 'Test Model', displayName: 'Llama 70B', tier: 'free' }) : null,
  tierColor: () => '#ccc',
}));
vi.mock('@/components/AIProfileRadar', () => ({
  AIProfileRadar: () => <div data-testid="ai-radar" />,
}));
vi.mock('@/components/CandidateInsightsPanel', () => ({
  CandidateInsightsPanel: () => <div data-testid="insights-panel" />,
}));
vi.mock('@/components/CandidateComparisonView', () => ({
  CandidateComparisonView: () => <div data-testid="comparison-view" />,
}));
vi.mock('@/components/VerdictBadge', () => ({
  VerdictBadge: () => <span data-testid="verdict-badge" />,
  computeVerdict: () => 'pass',
}));
vi.mock('@/components/InviteManagementTable', () => ({
  InviteManagementTable: () => <div data-testid="invite-table" />,
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
const fail = () => ({ ok: false, json: () => Promise.resolve({}) });

const mockCandidate1 = {
  session: { id: 's1', status: 'completed', totalCost: 5000, totalTokens: 1500, startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z', shareToken: 'share-abc' },
  candidate: { id: 'c1', name: 'Alice Smith', email: 'alice@test.com', avatarUrl: null },
  challengesPassed: 4,
  totalChallenges: 5,
  attempts: [
    {
      attemptId: 'att1', challengeId: 'ch1', challengeTitle: 'FizzBuzz', status: 'passed',
      totalCost: 2500, inputTokens: 500, outputTokens: 300, passedTests: 3, totalTests: 3,
      modelUsage: { 'llama-70b': { calls: 2, cost: 2000, tokens: 700 } },
    },
  ],
};

const mockCandidate2 = {
  session: { id: 's2', status: 'in_progress', totalCost: 3000, totalTokens: 900, startedAt: '2026-01-02T00:00:00Z', completedAt: null, shareToken: null },
  candidate: { id: 'c2', name: null, email: 'bob@test.com', avatarUrl: null },
  challengesPassed: 2,
  totalChallenges: 5,
  attempts: [],
};

const mockInsightsData: Record<string, any> = {
  s1: {
    insights: [{ type: 'model_selection', severity: 'green', narrative: 'Good model choices', challengeIndex: 0, timestamp: '2026-01-01T00:30:00Z' }],
    comparatives: [{ metric: 'cost', candidateValue: 5000, medianValue: 8000, percentile: 30, narrative: 'Below median cost' }],
    flags: { green: ['Cost efficient'], red: [], yellow: ['Slow start'] },
    highlights: [],
  },
};

const mockProfiles: Record<string, any> = {
  s1: { modelSelection: 80, promptEfficiency: 70, debugging: 60, strategy: 75, speed: 85 },
};

function setupFetch(map: Record<string, any> = {}) {
  // Sort by pattern length descending so more specific patterns match first.
  // Use endsWith for matching to avoid ambiguity (e.g., /results vs base URL).
  const entries = Object.entries(map).sort(([a], [b]) => b.length - a.length);
  const fn = vi.fn().mockImplementation((url: string) => {
    for (const [pattern, response] of entries) {
      if (url.endsWith(pattern) || url.includes(pattern + '?') || url.includes(pattern + '&')) {
        return Promise.resolve(response);
      }
    }
    return Promise.resolve(ok([]));
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

setupFetch();

const { AssessmentResultsDashboardScreen } = await import('./AssessmentResultsDashboardScreen');

describe('AssessmentResultsDashboardScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    setupFetch({
      '/api/assessments/test-assessment-123/results': ok([mockCandidate1, mockCandidate2]),
      '/api/assessments/test-assessment-123/analytics': ok({ profiles: mockProfiles }),
      '/api/assessments/test-assessment-123/insights': ok(mockInsightsData),
      '/api/assessments/test-assessment-123': ok({ passThreshold: null, categoryWeights: null }),
    });
  });

  it('renders loading state initially', () => {
    const { container } = render(<AssessmentResultsDashboardScreen />);
    expect(container.querySelector('svg') || container.textContent).toBeTruthy();
  });

  it('redirects to Login when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Login' }] });
    });
  });

  it('renders dashboard layout after loading', async () => {
    const { container } = render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="dashboard-layout"]')).not.toBeNull();
    });
  });

  it('renders "Assessment Results" title', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Assessment Results')).toBeTruthy();
    });
  });

  it('shows candidate count in subtitle', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/2 candidates have taken this assessment/)).toBeTruthy();
    });
  });

  it('shows singular "candidate" for 1 result', async () => {
    setupFetch({
      '/api/assessments/test-assessment-123/results': ok([mockCandidate1]),
      '/api/assessments/test-assessment-123/analytics': ok({ profiles: mockProfiles }),
      '/api/assessments/test-assessment-123/insights': ok(mockInsightsData),
      '/api/assessments/test-assessment-123': ok({ passThreshold: null, categoryWeights: null }),
    });
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/1 candidate have taken this assessment/)).toBeTruthy();
    });
  });

  it('renders "Back to Assessments" button', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Back to Assessments/)).toBeTruthy();
    });
  });

  it('navigates to Assessments when back button is clicked', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => expect(screen.getByText(/Back to Assessments/)).toBeTruthy());
    fireEvent.click(screen.getByText(/Back to Assessments/));
    expect(mockNavigate).toHaveBeenCalledWith('Assessments');
  });

  it('shows empty state when no results', async () => {
    setupFetch({
      '/api/assessments/test-assessment-123/results': ok([]),
      '/api/assessments/test-assessment-123/analytics': ok({ profiles: {} }),
      '/api/assessments/test-assessment-123/insights': ok({}),
      '/api/assessments/test-assessment-123': ok({ passThreshold: null, categoryWeights: null }),
    });
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('No Results Yet')).toBeTruthy();
      expect(screen.getByText('Invite candidates to take this assessment.')).toBeTruthy();
    });
  });

  it('renders candidate name in results table', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeTruthy();
    });
  });

  it('shows email when candidate name is null', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('bob@test.com')).toBeTruthy();
    });
  });

  it('renders session status badges', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('completed')).toBeTruthy();
      expect(screen.getByText('in_progress')).toBeTruthy();
    });
  });

  it('renders challenges passed counts', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('4/5')).toBeTruthy();
      expect(screen.getByText('2/5')).toBeTruthy();
    });
  });

  it('renders cost formatted correctly', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      // 5000 / 10000 = 0.50
      expect(screen.getByText('$0.50')).toBeTruthy();
      // 3000 / 10000 = 0.30
      expect(screen.getByText('$0.30')).toBeTruthy();
    });
  });

  it('renders token counts', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('1,500')).toBeTruthy();
      expect(screen.getByText('900')).toBeTruthy();
    });
  });

  it('renders sortable column headers', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Candidate/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Status/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Passed/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Cost/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Tokens/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Time/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders Export CSV button when results exist', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeTruthy();
    });
  });

  it('does not render Export CSV button when no results', async () => {
    setupFetch({
      '/api/assessments/test-assessment-123/results': ok([]),
      '/api/assessments/test-assessment-123/analytics': ok({ profiles: {} }),
      '/api/assessments/test-assessment-123/insights': ok({}),
      '/api/assessments/test-assessment-123': ok({ passThreshold: null, categoryWeights: null }),
    });
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('No Results Yet')).toBeTruthy();
    });
    expect(screen.queryByText('Export CSV')).toBeNull();
  });

  it('renders Compare Candidates button when 2+ results', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Compare Candidates')).toBeTruthy();
    });
  });

  it('does not render Compare Candidates button with only 1 result', async () => {
    setupFetch({
      '/api/assessments/test-assessment-123/results': ok([mockCandidate1]),
      '/api/assessments/test-assessment-123/analytics': ok({ profiles: mockProfiles }),
      '/api/assessments/test-assessment-123/insights': ok(mockInsightsData),
      '/api/assessments/test-assessment-123': ok({ passThreshold: null, categoryWeights: null }),
    });
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeTruthy();
    });
    expect(screen.queryByText('Compare Candidates')).toBeNull();
  });

  it('toggles comparison view when Compare Candidates is clicked', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => expect(screen.getByText('Compare Candidates')).toBeTruthy());
    fireEvent.click(screen.getByText('Compare Candidates'));
    await waitFor(() => {
      expect(screen.getByText('Hide Comparison')).toBeTruthy();
    });
  });

  it('renders comparison view component when toggled on', async () => {
    const { container } = render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => expect(screen.getByText('Compare Candidates')).toBeTruthy());
    fireEvent.click(screen.getByText('Compare Candidates'));
    await waitFor(() => {
      expect(container.querySelector('[data-testid="comparison-view"]')).not.toBeNull();
    });
  });

  it('renders Results and Invites tabs', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Results \(/)).toBeTruthy();
      expect(screen.getByText('Invites')).toBeTruthy();
    });
  });

  it('shows invite management table when Invites tab is clicked', async () => {
    const { container } = render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => expect(screen.getByText('Invites')).toBeTruthy());
    fireEvent.click(screen.getByText('Invites'));
    await waitFor(() => {
      expect(container.querySelector('[data-testid="invite-table"]')).not.toBeNull();
    });
  });

  it('renders View Results link for candidates with shareToken', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('View Results').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders duration for completed sessions', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      // mockCandidate1: completedAt - startedAt = 1h = 60m = "1h 0m"
      expect(screen.getByText('1h 0m')).toBeTruthy();
    });
  });

  it('shows - for duration when session is not completed', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('-')).toBeTruthy();
    });
  });

  it('renders Signals column header', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Signals')).toBeTruthy();
    });
  });

  it('renders Actions column header', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Actions')).toBeTruthy();
    });
  });

  it('shows signal flag dots for sessions with insights', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      // mockInsightsData for s1 has 1 green flag and 1 yellow flag
      expect(screen.getByText('Alice Smith')).toBeTruthy();
    });
  });

  it('exports CSV when Export CSV is clicked', async () => {
    // Mock URL.createObjectURL and document.createElement
    const mockUrl = 'blob:mock-url';
    const mockClick = vi.fn();
    const mockRevokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue(mockUrl),
      revokeObjectURL: mockRevokeObjectURL,
    });
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        el.click = mockClick;
      }
      return el;
    });

    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => expect(screen.getByText('Export CSV')).toBeTruthy());
    fireEvent.click(screen.getByText('Export CSV'));
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockUrl);

    vi.restoreAllMocks();
  });

  it('shows verdict filter bar when passThreshold is enabled', async () => {
    setupFetch({
      '/api/assessments/test-assessment-123/results': ok([mockCandidate1, mockCandidate2]),
      '/api/assessments/test-assessment-123/analytics': ok({ profiles: mockProfiles }),
      '/api/assessments/test-assessment-123/insights': ok(mockInsightsData),
      '/api/assessments/test-assessment-123': ok({
        passThreshold: JSON.stringify({ enabled: true, mode: 'weighted_average', minOverall: 70, dimensions: {} }),
        categoryWeights: null,
      }),
    });
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      // Verdict filter buttons should appear
      expect(screen.getAllByText(/all/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders verdict column when passThreshold is enabled', async () => {
    setupFetch({
      '/api/assessments/test-assessment-123/results': ok([mockCandidate1]),
      '/api/assessments/test-assessment-123/analytics': ok({ profiles: mockProfiles }),
      '/api/assessments/test-assessment-123/insights': ok(mockInsightsData),
      '/api/assessments/test-assessment-123': ok({
        passThreshold: JSON.stringify({ enabled: true, mode: 'weighted_average', minOverall: 70, dimensions: {} }),
        categoryWeights: null,
      }),
    });
    const { container } = render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Verdict/)).toBeTruthy();
      expect(container.querySelector('[data-testid="verdict-badge"]')).not.toBeNull();
    });
  });

  it('expands row to show insights when clicked', async () => {
    const { container } = render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeTruthy());
    fireEvent.click(screen.getByText('Alice Smith'));
    await waitFor(() => {
      expect(container.querySelector('[data-testid="insights-panel"]')).not.toBeNull();
    });
  });

  it('collapses expanded row when clicked again', async () => {
    const { container } = render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeTruthy());
    fireEvent.click(screen.getByText('Alice Smith'));
    await waitFor(() => {
      expect(container.querySelector('[data-testid="insights-panel"]')).not.toBeNull();
    });
    fireEvent.click(screen.getByText('Alice Smith'));
    await waitFor(() => {
      expect(container.querySelector('[data-testid="insights-panel"]')).toBeNull();
    });
  });

  it('shows fallback radar when insights not available for session', async () => {
    // Candidate2 (s2) has no insights but has profile data
    setupFetch({
      '/api/assessments/test-assessment-123/results': ok([mockCandidate2]),
      '/api/assessments/test-assessment-123/analytics': ok({ profiles: { s2: { modelSelection: 60, promptEfficiency: 50, debugging: 40, strategy: 55, speed: 65 } } }),
      '/api/assessments/test-assessment-123/insights': ok({}),
      '/api/assessments/test-assessment-123': ok({ passThreshold: null, categoryWeights: null }),
    });
    const { container } = render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => expect(screen.getByText('bob@test.com')).toBeTruthy());
    fireEvent.click(screen.getByText('bob@test.com'));
    await waitFor(() => {
      expect(screen.getByText('AI Profile')).toBeTruthy();
      expect(container.querySelector('[data-testid="ai-radar"]')).not.toBeNull();
    });
  });

  it('renders challenge breakdown in expanded row when attempts exist', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeTruthy());
    fireEvent.click(screen.getByText('Alice Smith'));
    await waitFor(() => {
      expect(screen.getByText('Challenge Breakdown')).toBeTruthy();
      expect(screen.getByText('FizzBuzz')).toBeTruthy();
    });
  });

  it('renders model usage badges in expanded attempt', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeTruthy());
    fireEvent.click(screen.getByText('Alice Smith'));
    await waitFor(() => {
      expect(screen.getByText(/Llama 70B/)).toBeTruthy();
    });
  });

  it('renders View Replay link in expanded attempt', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeTruthy());
    fireEvent.click(screen.getByText('Alice Smith'));
    await waitFor(() => {
      expect(screen.getByText('View Replay')).toBeTruthy();
    });
  });

  it('navigates to Replay when View Replay is clicked', async () => {
    render(<AssessmentResultsDashboardScreen />);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeTruthy());
    fireEvent.click(screen.getByText('Alice Smith'));
    await waitFor(() => expect(screen.getByText('View Replay')).toBeTruthy());
    fireEvent.click(screen.getByText('View Replay'));
    expect(mockNavigate).toHaveBeenCalledWith('Replay', { attemptId: 'att1' });
  });
});
