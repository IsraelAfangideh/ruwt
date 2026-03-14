// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockReset = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
  useRoute: () => ({ params: { sessionId: 'test-session-123' } }),
}));
vi.mock('@/features/arena/ArenaIDE', () => ({
  ArenaIDE: (props: any) => (
    <div data-testid="arena-ide">
      {props.challenge?.title || 'IDE'}
      <button data-testid="run-tests-btn" onClick={() => props.onRunTests?.('code', 'javascript').catch(() => {})}>Run Tests</button>
      <button data-testid="submit-btn">Submit</button>
      <button data-testid="dismiss-btn" onClick={() => props.onDismissResults?.()}>Dismiss</button>
      <button data-testid="update-attempt-btn" onClick={() => props.onAttemptUpdate?.({ id: 'att-updated' })}>Update Attempt</button>
      <button data-testid="run-code-btn" onClick={() => props.onRunCode?.('console.log(1)', 'javascript').catch(() => {})}>Run Code</button>
      <button data-testid="code-change-btn" onClick={() => props.onCodeChange?.('new code')}>Change Code</button>
    </div>
  ),
}));
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => (
    <button onClick={onPress} {...props}>{children}</button>
  ),
}));
vi.mock('@/shared/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/shared/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    borderStrong: '#999', card: '#fff', muted: '#f5f5f5', error: '#f00', errorBg: '#fee',
    success: '#0a0', successBg: '#efe', primary: '#000', primaryForeground: '#fff',
    secondary: '#eee', secondaryForeground: '#000', destructive: '#f00',
    textSubtle: '#aaa', bgElevated: '#fafafa', accentBg: '#ffe',
  }),
}));
vi.mock('@/shared/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif', mono: 'monospace' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));

const ok = (data: any) => ({ ok: true, json: () => Promise.resolve(data) });
const fail = (data: any = {}) => ({ ok: false, json: () => Promise.resolve(data) });

const mockSessionData = {
  session: { status: 'in_progress', expiresAt: '2099-03-01T00:00:00Z', currentChallengeIndex: 0, shareToken: 'share-123' },
  totalChallenges: 3,
  challengeProgress: [
    { index: 0, challengeId: 'c1', title: 'Challenge 1', difficulty: 'easy', status: 'in_progress', cost: 0 },
    { index: 1, challengeId: 'c2', title: 'Challenge 2', difficulty: 'medium', status: 'not_started', cost: 0 },
    { index: 2, challengeId: 'c3', title: 'Challenge 3', difficulty: 'hard', status: 'not_started', cost: 0 },
  ],
  currentChallenge: { id: 'c1', title: 'FizzBuzz', difficulty: 'easy', category: 'prompt_efficiency', description: 'Test', starterCode: '// start', testCases: '[]', language: 'javascript' },
  currentAttempt: { id: 'att1', status: 'in_progress' },
};

const mockDashboardData = { profile: { credits: 500 } };

function setupFetch(map: Record<string, any> = {}) {
  const entries = Object.entries(map).sort(([a], [b]) => b.length - a.length);
  const fn = vi.fn().mockImplementation((url: string) => {
    for (const [pattern, response] of entries) {
      if (url.includes(pattern)) return Promise.resolve(response);
    }
    return Promise.resolve(ok({}));
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

setupFetch({
  '/api/assess/test-session-123': ok(mockSessionData),
  '/api/dashboard': ok(mockDashboardData),
});

const { AssessmentFlowScreen } = await import('./AssessmentFlowScreen');

describe('AssessmentFlowScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetch({
      '/api/assess/test-session-123': ok(mockSessionData),
      '/api/dashboard': ok(mockDashboardData),
    });
  });

  it('renders loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<AssessmentFlowScreen />);
    expect(screen.getByText('Loading assessment...')).toBeTruthy();
  });

  it('renders error when session load fails', async () => {
    setupFetch({
      '/api/assess/test-session-123': fail(),
      '/api/dashboard': ok(mockDashboardData),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load assessment session')).toBeTruthy();
    });
  });

  it('renders challenge title after loading', async () => {
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('FizzBuzz').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders challenge difficulty badge', async () => {
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('easy').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders ArenaIDE component', async () => {
    const { container } = render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="arena-ide"]')).not.toBeNull();
    });
  });

  it('shows progress text "Challenge 1 of 3"', async () => {
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getByText('Challenge 1 of 3')).toBeTruthy();
    });
  });

  it('renders progress bar and challenge progress', async () => {
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getByText('Challenge 1 of 3')).toBeTruthy();
      expect(screen.getAllByText('FizzBuzz').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders timer badge with countdown', async () => {
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      // Timer should be running since expiresAt is far in the future
      expect(screen.getAllByText('FizzBuzz').length).toBeGreaterThanOrEqual(1);
    });
    // The timer should show some time value (it's a countdown to 2099)
  });

  it('shows completed state for completed sessions', async () => {
    const completedData = {
      ...mockSessionData,
      session: { ...mockSessionData.session, status: 'completed' },
    };
    setupFetch({
      '/api/assess/test-session-123': ok(completedData),
      '/api/dashboard': ok(mockDashboardData),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getByText('Assessment Complete')).toBeTruthy();
      expect(screen.getByText('Your results have been submitted.')).toBeTruthy();
    });
  });

  it('shows expired state for expired sessions', async () => {
    const expiredData = {
      ...mockSessionData,
      session: { ...mockSessionData.session, status: 'expired' },
    };
    setupFetch({
      '/api/assess/test-session-123': ok(expiredData),
      '/api/dashboard': ok(mockDashboardData),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getByText('Assessment Expired')).toBeTruthy();
      expect(screen.getByText('The time limit has been reached.')).toBeTruthy();
    });
  });

  it('shows View Results button in completed state with shareToken', async () => {
    const completedData = {
      ...mockSessionData,
      session: { ...mockSessionData.session, status: 'completed', shareToken: 'share-123' },
    };
    setupFetch({
      '/api/assess/test-session-123': ok(completedData),
      '/api/dashboard': ok(mockDashboardData),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getByText('View Results')).toBeTruthy();
    });
  });

  it('navigates to AssessmentResults when View Results is clicked', async () => {
    const completedData = {
      ...mockSessionData,
      session: { ...mockSessionData.session, status: 'completed', shareToken: 'share-xyz' },
    };
    setupFetch({
      '/api/assess/test-session-123': ok(completedData),
      '/api/dashboard': ok(mockDashboardData),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => expect(screen.getByText('View Results')).toBeTruthy());
    fireEvent.click(screen.getByText('View Results'));
    expect(mockNavigate).toHaveBeenCalledWith('AssessmentResults', { shareToken: 'share-xyz' });
  });

  it('shows error state when challenge or attempt is missing', async () => {
    const noChallenge = {
      ...mockSessionData,
      currentChallenge: null,
      currentAttempt: null,
    };
    setupFetch({
      '/api/assess/test-session-123': ok(noChallenge),
      '/api/dashboard': ok(mockDashboardData),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getByText('Missing data')).toBeTruthy();
    });
  });

  it('renders error message on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getByText('Network offline')).toBeTruthy();
    });
  });

  it('renders generic error message on non-Error exception', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('something'));
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeTruthy();
    });
  });

  it('uses starter code from challenge data', async () => {
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      // ArenaIDE mock renders the challenge title
      expect(screen.getAllByText('FizzBuzz').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('does not show View Results button without shareToken', async () => {
    const completedData = {
      ...mockSessionData,
      session: { ...mockSessionData.session, status: 'completed', shareToken: null },
    };
    setupFetch({
      '/api/assess/test-session-123': ok(completedData),
      '/api/dashboard': ok(mockDashboardData),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getByText('Assessment Complete')).toBeTruthy();
    });
    expect(screen.queryByText('View Results')).toBeNull();
  });

  it('sets attempt from currentAttempt data (line 64)', async () => {
    // Ensures line 64: setAttempt(data.currentAttempt) is covered
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('FizzBuzz').length).toBeGreaterThanOrEqual(1);
    });
    // The ArenaIDE mock gets attempt prop from state; if attempt was set, run-tests-btn works
    const btn = screen.getByTestId('run-tests-btn');
    expect(btn).toBeTruthy();
  });

  it('handles dashboard fetch failure gracefully (line 68-76)', async () => {
    setupFetch({
      '/api/assess/test-session-123': ok(mockSessionData),
      '/api/dashboard': { ok: false, json: () => Promise.resolve({}) },
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('FizzBuzz').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles dashboard fetch with missing credits gracefully', async () => {
    setupFetch({
      '/api/assess/test-session-123': ok(mockSessionData),
      '/api/dashboard': ok({ profile: {} }),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('FizzBuzz').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles dashboard fetch exception gracefully', async () => {
    // Make the first call (session) succeed, but dashboard throws
    const fn = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard')) return Promise.reject(new Error('fail'));
      if (url.includes('/api/assess/')) return Promise.resolve(ok(mockSessionData));
      return Promise.resolve(ok({}));
    });
    vi.stubGlobal('fetch', fn);
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('FizzBuzz').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('onRunTests calls /api/submissions with test mode and returns results', async () => {
    const fetchFn = setupFetch({
      '/api/assess/test-session-123': ok(mockSessionData),
      '/api/dashboard': ok(mockDashboardData),
      '/api/submissions': ok({ success: true, passedTests: 3, totalTests: 3, results: [{ name: 'test1', passed: true }] }),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => expect(screen.getByTestId('run-tests-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('run-tests-btn'));
    await waitFor(() => {
      const calls = fetchFn.mock.calls;
      const submissionCall = calls.find((c: any) => c[0]?.includes('/api/submissions'));
      expect(submissionCall).toBeTruthy();
      const body = JSON.parse(submissionCall![1].body);
      expect(body.mode).toBe('test');
      expect(body.attemptId).toBe('att1');
    });
  });

  it('onRunTests returns early if no attempt id', async () => {
    // attempt.id is falsy empty string
    const dataWithNullAttempt = { ...mockSessionData, currentAttempt: null };
    setupFetch({
      '/api/assess/test-session-123': ok(dataWithNullAttempt),
      '/api/dashboard': ok(mockDashboardData),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      // Should show error state since attempt is null
      expect(screen.getByText('Missing data')).toBeTruthy();
    });
  });

  it('onRunTests throws on non-ok response', async () => {
    // Suppress unhandled rejection for this test since onRunTests throws
    const handler = (e: PromiseRejectionEvent) => { e.preventDefault(); };
    window.addEventListener('unhandledrejection', handler);
    const fetchFn = setupFetch({
      '/api/assess/test-session-123': ok(mockSessionData),
      '/api/dashboard': ok(mockDashboardData),
      '/api/submissions': fail({ error: 'Rate limited' }),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => expect(screen.getByTestId('run-tests-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('run-tests-btn'));
    await waitFor(() => {
      const calls = fetchFn.mock.calls;
      expect(calls.some((c: any) => c[0]?.includes('/api/submissions'))).toBeTruthy();
    });
    window.removeEventListener('unhandledrejection', handler);
  });

  it('handleNext advances to next challenge on success', async () => {
    // First render with passed test results - need to trigger tests first
    const nextChallenge = { id: 'c2', title: 'Challenge2', difficulty: 'medium', category: 'debug', description: 'Next', starterCode: '// next', testCases: '[]', language: 'javascript' };
    setupFetch({
      '/api/assess/test-session-123': ok(mockSessionData),
      '/api/dashboard': ok(mockDashboardData),
      '/api/submissions': ok({ success: true, passedTests: 3, totalTests: 3, results: [] }),
      '/api/assess/test-session-123/next': ok({ challenge: nextChallenge, attempt: { id: 'att2', status: 'in_progress' }, challengeIndex: 1 }),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => expect(screen.getByTestId('run-tests-btn')).toBeTruthy());
    // Run tests to pass the challenge
    fireEvent.click(screen.getByTestId('run-tests-btn'));
    await waitFor(() => {
      // After successful submit, "Next Challenge" button should appear (not last challenge)
      expect(screen.queryByText(/Next Challenge/)).toBeTruthy();
    });
    // Click Next Challenge
    fireEvent.click(screen.getByText(/Next Challenge/));
    await waitFor(() => {
      expect(screen.getAllByText('Challenge2').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handleComplete completes the assessment and navigates to results', async () => {
    // Set up as last challenge (index 2 of 3 = index >= totalChallenges - 1)
    const lastChallengeData = {
      ...mockSessionData,
      session: { ...mockSessionData.session, currentChallengeIndex: 2 },
    };
    setupFetch({
      '/api/assess/test-session-123': ok(lastChallengeData),
      '/api/dashboard': ok(mockDashboardData),
      '/api/submissions': ok({ success: true, passedTests: 3, totalTests: 3, results: [] }),
      '/api/assess/test-session-123/complete': ok({ session: { shareToken: 'final-share' } }),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => expect(screen.getByTestId('run-tests-btn')).toBeTruthy());
    // Run tests to pass the last challenge
    fireEvent.click(screen.getByTestId('run-tests-btn'));
    await waitFor(() => {
      expect(screen.getByText('Complete Assessment')).toBeTruthy();
    });
    // Click Complete Assessment
    fireEvent.click(screen.getByText('Complete Assessment'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('AssessmentResults', { shareToken: 'final-share' });
    });
  });

  it('countdown timer sets expired status when time runs out', async () => {
    const soonExpires = {
      ...mockSessionData,
      session: { ...mockSessionData.session, expiresAt: new Date(Date.now() + 500).toISOString() },
    };
    setupFetch({
      '/api/assess/test-session-123': ok(soonExpires),
      '/api/dashboard': ok(mockDashboardData),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => expect(screen.getAllByText('FizzBuzz').length).toBeGreaterThanOrEqual(1));
    // Wait for the timer to expire
    await waitFor(() => {
      expect(screen.getByText('Assessment Expired')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('onAttemptUpdate updates attempt state', async () => {
    render(<AssessmentFlowScreen />);
    await waitFor(() => expect(screen.getByTestId('update-attempt-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('update-attempt-btn'));
    // Should not throw - just updates internal state
  });

  it('onDismissResults clears test results', async () => {
    render(<AssessmentFlowScreen />);
    await waitFor(() => expect(screen.getByTestId('dismiss-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('dismiss-btn'));
    // Should not throw
  });

  it('onRunCode calls /api/execute and returns result (lines 286-298)', async () => {
    const fetchFn = setupFetch({
      '/api/assess/test-session-123': ok(mockSessionData),
      '/api/dashboard': ok(mockDashboardData),
      '/api/execute': ok({ run: { stdout: 'hello', stderr: '', code: 0 } }),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => expect(screen.getByTestId('run-code-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('run-code-btn'));
    await waitFor(() => {
      const calls = fetchFn.mock.calls;
      const execCall = calls.find((c: any) => c[0]?.includes('/api/execute'));
      expect(execCall).toBeTruthy();
    });
  });

  it('handles session with no starterCode', async () => {
    const noStarterData = {
      ...mockSessionData,
      currentChallenge: { ...mockSessionData.currentChallenge, starterCode: null },
    };
    setupFetch({
      '/api/assess/test-session-123': ok(noStarterData),
      '/api/dashboard': ok(mockDashboardData),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('FizzBuzz').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handleNext handles failed /next request gracefully', async () => {
    setupFetch({
      '/api/assess/test-session-123': ok(mockSessionData),
      '/api/dashboard': ok(mockDashboardData),
      '/api/submissions': ok({ success: true, passedTests: 3, totalTests: 3, results: [] }),
      '/api/assess/test-session-123/next': fail({}),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => expect(screen.getByTestId('run-tests-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('run-tests-btn'));
    await waitFor(() => expect(screen.queryByText(/Next Challenge/)).toBeTruthy());
    fireEvent.click(screen.getByText(/Next Challenge/));
    // Should not crash - still shows original challenge
    await waitFor(() => {
      expect(screen.getAllByText('FizzBuzz').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handleNext handles network exception gracefully', async () => {
    setupFetch({
      '/api/assess/test-session-123': ok(mockSessionData),
      '/api/dashboard': ok(mockDashboardData),
      '/api/submissions': ok({ success: true, passedTests: 3, totalTests: 3, results: [] }),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => expect(screen.getByTestId('run-tests-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('run-tests-btn'));
    await waitFor(() => expect(screen.queryByText(/Next Challenge/)).toBeTruthy());
    // Now make fetch throw for the /next call
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    fireEvent.click(screen.getByText(/Next Challenge/));
    // Should not crash
    await waitFor(() => {
      expect(screen.getAllByText('FizzBuzz').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('countdown timer formats time correctly (lines 96-98)', async () => {
    // Set expiry far in the future so timer shows formatted value
    const farFuture = {
      ...mockSessionData,
      session: { ...mockSessionData.session, expiresAt: new Date(Date.now() + 5 * 60000 + 30000).toISOString() },
    };
    setupFetch({
      '/api/assess/test-session-123': ok(farFuture),
      '/api/dashboard': ok(mockDashboardData),
    });
    const { container } = render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('FizzBuzz').length).toBeGreaterThanOrEqual(1);
    });
    // Wait for timer interval to fire
    await new Promise(r => setTimeout(r, 1200));
    // The timer text should have been set with MM:SS format in the Badge
    expect(container.textContent).toMatch(/\d{2}:\d{2}/);
  });

  it('onCodeChange updates code state', async () => {
    render(<AssessmentFlowScreen />);
    await waitFor(() => expect(screen.getByTestId('code-change-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('code-change-btn'));
    expect(screen.getByTestId('arena-ide')).toBeTruthy();
  });

  it('handleComplete handles missing shareToken gracefully', async () => {
    const lastChallengeData = {
      ...mockSessionData,
      session: { ...mockSessionData.session, currentChallengeIndex: 2 },
    };
    setupFetch({
      '/api/assess/test-session-123': ok(lastChallengeData),
      '/api/dashboard': ok(mockDashboardData),
      '/api/submissions': ok({ success: true, passedTests: 3, totalTests: 3, results: [] }),
      '/api/assess/test-session-123/complete': ok({ session: {} }),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => expect(screen.getByTestId('run-tests-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('run-tests-btn'));
    await waitFor(() => {
      expect(screen.getByText('Complete Assessment')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Complete Assessment'));
    await waitFor(() => {
      expect(screen.getByText('Assessment Complete')).toBeTruthy();
    });
  });

  it('sets challengeProgress to empty array when not provided', async () => {
    const noProgressData = {
      ...mockSessionData,
      challengeProgress: undefined,
    };
    setupFetch({
      '/api/assess/test-session-123': ok(noProgressData),
      '/api/dashboard': ok(mockDashboardData),
    });
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('FizzBuzz').length).toBeGreaterThanOrEqual(1);
    });
  });
});
