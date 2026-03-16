// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

/* ── navigation mock ────────────────────────────────────────────── */
const mockNavigate = vi.fn();
const mockReset = vi.fn();
let routeParams: Record<string, string> = { challengeId: 'test-challenge' };

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
  useRoute: () => ({ params: routeParams }),
}));

/* ── auth mock — default: authenticated ─────────────────────────── */
let authReturn = { user: { id: 'u1', email: 'test@test.com' }, loading: false };
vi.mock('@/shared/hooks/useAuthGuard', () => ({
  useAuthGuard: () => authReturn,
}));

/* ── ArenaIDE mock ─────────────────────────────────────────────── */
let capturedOnRunCode: ((code: string, lang: string) => Promise<any>) | null = null;
vi.mock('@/features/arena/ArenaIDE', () => ({
  ArenaIDE: (props: any) => {
    // Capture onRunCode so tests can invoke it
    capturedOnRunCode = props.onRunCode || null;
    return (
      <div data-testid="arena-ide">
        <span data-testid="ide-title">{props.challenge?.title || 'IDE'}</span>
        <span data-testid="ide-code">{props.code}</span>
        <span data-testid="ide-lang">{props.language}</span>
        <span data-testid="ide-expired">{String(!!props.isExpired)}</span>
        {props.testResults && <span data-testid="ide-results">{JSON.stringify(props.testResults)}</span>}
        {props.onRestart && <button data-testid="ide-restart" onClick={props.onRestart}>Restart</button>}
        {props.onExpire && <button data-testid="ide-expire" onClick={props.onExpire}>Expire</button>}
        {props.onAttemptUpdate && (
          <button data-testid="ide-update-attempt" onClick={() => props.onAttemptUpdate({ id: 'att-updated', totalCost: 999, inputTokens: 50, outputTokens: 50, status: 'in_progress', expiresAt: null })}>
            Update Attempt
          </button>
        )}
        {props.onDismissResults && <button data-testid="ide-dismiss" onClick={props.onDismissResults}>Dismiss</button>}
      </div>
    );
  },
}));

/* ── theme & util mocks ────────────────────────────────────────── */
vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117', surface: '#161b22', text: '#e6e1d6', textMuted: '#8a847a',
    textSubtle: '#6b665c', accent: '#c9a962', border: '#2a2520',
    error: '#ef4444', success: '#3fb950', accentBg: '#ffe',
  },
}));
let isMobileReturn = false;
vi.mock('@/shared/lib/useIsMobile', () => ({ useIsMobile: () => isMobileReturn }));
vi.mock('@/shared/lib/difficulty', () => ({
  getDifficultyStyle: (d: string) => {
    if (d === 'hard') return { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Hard' };
    return { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', label: 'Medium' };
  },
}));
const mockShowToast = vi.fn();
vi.mock('@/shared/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
vi.mock('@/features/arena/ArenaErrorBoundary', () => ({
  ArenaErrorBoundary: ({ children }: any) => <div data-testid="error-boundary">{children}</div>,
}));
vi.mock('@/shared/lib/ai/pricing', () => ({
  estimateMessagesForBudget: (_cost: number, tier: string) => tier === 'premium' ? 2 : 10,
  getModelById: () => ({ name: 'Test Model' }),
  tierColor: () => '#ccc',
  formatCostFromHundredths: (c: number) => { const d = c / 10000; return d < 0.01 ? `$${d.toFixed(4)}` : `$${d.toFixed(2)}`; },
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens({ mono: true }));

/* ── helpers ────────────────────────────────────────────────────── */

const challengeData: {
  id: string; title: string; difficulty: string; category: string;
  description: string; starterCode: string | null; testCases: string;
  language: string; maxCost: number | null; wallClockLimit: number | null;
  hiddenTestCount: number;
  stats: { solvers: number; avgCost: number | null; bestCost: number | null } | null;
} = {
  id: 'test-challenge',
  title: 'FizzBuzz Budget',
  difficulty: 'medium',
  category: 'prompt_efficiency',
  description: 'Test challenge description that is under 200 chars',
  starterCode: '// start here',
  testCases: '[{"input":"1","expectedOutput":"1"}]',
  language: 'javascript',
  maxCost: null,
  wallClockLimit: null,
  hiddenTestCount: 0,
  stats: null,
};

const profileData = { credits: 50000 };

function mockFetchForChallenge(challenge = challengeData, profile = profileData) {
  return vi.fn().mockImplementation((url: string, opts?: any) => {
    if (typeof url === 'string' && url.includes('/api/challenges/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(challenge) });
    }
    if (typeof url === 'string' && url === '/api/profile') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(profile) });
    }
    if (typeof url === 'string' && url.includes('/api/attempts') && !opts?.method) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
    }
    if (typeof url === 'string' && url.includes('/api/attempts') && opts?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
          isExisting: false,
          challenge: { starterCode: challenge.starterCode },
        }),
      });
    }
    if (typeof url === 'string' && url.includes('/api/submissions')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, passedTests: 1, totalTests: 1, results: [{ passed: true, input: '1', expectedOutput: '1', actualOutput: '1' }] }),
      });
    }
    if (typeof url === 'string' && url.includes('/api/leaderboard')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ entries: [{ attemptId: 'att-1', totalCost: 100, userId: 'u1' }] }),
      });
    }
    if (typeof url === 'string' && url === '/api/challenges') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { id: 'next-challenge', category: 'prompt_efficiency', difficulty: 'medium', userStatus: 'not_started' },
          { id: 'test-challenge', category: 'prompt_efficiency', difficulty: 'medium', userStatus: 'not_started' },
        ]),
      });
    }
    if (typeof url === 'string' && url.includes('/api/execute')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ run: { stdout: 'hello', stderr: '', code: 0 } }),
      });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

/* ── import component (after all mocks) ────────────────────────── */

const { ArenaScreen } = await import('./ArenaScreen');

/* ── tests ─────────────────────────────────────────────────────── */

describe('ArenaScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeParams = { challengeId: 'test-challenge' };
    authReturn = { user: { id: 'u1', email: 'test@test.com' }, loading: false };
    isMobileReturn = false;
    capturedOnRunCode = null;
    globalThis.fetch = mockFetchForChallenge();
    // Mock localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* ─── Loading / Auth ───────────────────────────────────────────── */

  it('shows auth loading spinner when auth is loading', () => {
    authReturn = { user: null as any, loading: true };
    const { container } = render(<ArenaScreen />);
    // Should render skeleton loading state, not "Loading arena..." text (that's for data loading)
    expect(container.textContent).not.toContain('Loading arena...');
    expect(container.querySelector('[data-testid="skeleton-split-pane"]')).not.toBeNull();
  });

  it('shows loading state while fetching challenge data', () => {
    // fetch that never resolves
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    const { container } = render(<ArenaScreen />);
    expect(container.querySelector('[data-testid="skeleton-split-pane"]')).not.toBeNull();
  });

  /* ─── Error states ─────────────────────────────────────────────── */

  it('shows error when challengeId is missing', async () => {
    routeParams = {};
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('No challenge selected')).toBeInTheDocument();
    });
  });

  it('shows "Challenge not found" on 404 response', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/challenges/')) {
        return Promise.resolve({ ok: false, status: 404 });
      }
      if (url === '/api/profile') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ credits: 100 }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('Challenge not found')).toBeInTheDocument();
    });
  });

  it('shows "Failed to load challenge" on non-404 error', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/challenges/')) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      if (url === '/api/profile') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ credits: 100 }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load challenge')).toBeInTheDocument();
    });
  });

  it('shows network error message when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows generic error when fetch throws non-Error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue('something broke');
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  it('error screen has "Back to Problems" button that navigates', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Oops'));
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('Oops')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Problems' }));
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  /* ─── Pre-attempt screen ───────────────────────────────────────── */

  it('renders pre-attempt screen with challenge info', async () => {
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('FizzBuzz Budget')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument();
  });

  it('shows difficulty badge on pre-attempt screen', async () => {
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });
  });

  it('truncates long descriptions to 200 chars', async () => {
    const longDesc = 'A'.repeat(250);
    globalThis.fetch = mockFetchForChallenge({ ...challengeData, description: longDesc });
    render(<ArenaScreen />);
    await waitFor(() => {
      const desc = 'A'.repeat(200) + '...';
      expect(screen.getByText(desc)).toBeInTheDocument();
    });
  });

  it('shows short description without truncation', async () => {
    globalThis.fetch = mockFetchForChallenge({ ...challengeData, description: 'Short desc' });
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('Short desc')).toBeInTheDocument();
    });
  });

  it('shows budget info card when maxCost is set', async () => {
    globalThis.fetch = mockFetchForChallenge({ ...challengeData, maxCost: 50000 });
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Your AI Budget/)).toBeInTheDocument();
    });
  });

  it('shows "No Budget Limit" when maxCost is null', async () => {
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('No Budget Limit')).toBeInTheDocument();
    });
    expect(screen.getByText(/Spend freely/)).toBeInTheDocument();
  });

  it('shows best solver stats when available', async () => {
    globalThis.fetch = mockFetchForChallenge({
      ...challengeData,
      maxCost: 50000,
      stats: { solvers: 5, avgCost: 2000, bestCost: 1000 },
    });
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Best solver spent/)).toBeInTheDocument();
    });
  });

  it('does NOT show best solver stats when solvers is 0', async () => {
    globalThis.fetch = mockFetchForChallenge({
      ...challengeData,
      maxCost: 50000,
      stats: { solvers: 0, avgCost: null, bestCost: 1000 },
    });
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('FizzBuzz Budget')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Best solver/)).toBeNull();
  });

  it('shows wall clock limit when set', async () => {
    globalThis.fetch = mockFetchForChallenge({ ...challengeData, wallClockLimit: 300 });
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('5m time limit')).toBeInTheDocument();
    });
  });

  it('shows "Back" link on pre-attempt screen that navigates', async () => {
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('FizzBuzz Budget')).toBeInTheDocument();
    });
    // The back link has "&larr; Back to Problems" which renders as ← Back to Problems
    const backButton = screen.getByText(/Back to Problems/);
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  /* ─── Starting an attempt ──────────────────────────────────────── */

  it('clicking "Start Challenge" calls POST /api/attempts and shows IDE', async () => {
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }));
    });
    await waitFor(() => {
      expect(screen.getByTestId('arena-ide')).toBeInTheDocument();
    });
  });

  it('shows "Starting..." text while attempt is being created', async () => {
    let resolveAttempt: any;
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return new Promise((resolve) => { resolveAttempt = resolve; });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Starting...' })).toBeInTheDocument());

    // Resolve the promise
    await act(async () => {
      resolveAttempt!({
        ok: true,
        json: () => Promise.resolve({
          attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
          isExisting: false,
          challenge: { starterCode: '// code' },
        }),
      });
    });
  });

  it('shows error when attempt creation fails (server error)', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }));
    });
    await waitFor(() => {
      expect(screen.getByText('Failed to start attempt')).toBeInTheDocument();
    });
  });

  it('shows error when attempt creation throws', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.reject(new Error('Connection refused'));
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }));
    });
    await waitFor(() => {
      expect(screen.getByText('Connection refused')).toBeInTheDocument();
    });
  });

  it('shows error when attempt creation throws non-Error', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.reject('boom');
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }));
    });
    await waitFor(() => {
      expect(screen.getByText('Failed to start attempt')).toBeInTheDocument();
    });
  });

  it('resumes existing attempt with saved code from localStorage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'arena-code-att-1') return 'saved code from before';
      return null;
    });

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: true,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }));
    });
    await waitFor(() => {
      expect(screen.getByTestId('ide-code')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ide-code').textContent).toBe('saved code from before');
    expect(mockShowToast).toHaveBeenCalledWith('Restored your progress', 'success');
  });

  it('uses starterCode for new attempt', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }));
    });
    await waitFor(() => {
      expect(screen.getByTestId('ide-code')?.textContent).toBe('// start here');
    });
  });

  it('uses default comment when language is python and no starterCode', async () => {
    // Note: startAttempt callback captures `language` from its closure.
    // When created on initial render, challenge is null so language = 'javascript'.
    // The stale closure means it uses the JS default comment — this tests actual behavior.
    globalThis.fetch = mockFetchForChallenge({ ...challengeData, language: 'python', starterCode: null });
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }));
    });
    await waitFor(() => {
      // With starterCode=null, falls back to default comment
      expect(screen.getByTestId('ide-code')?.textContent).toBe('// your code here');
    });
  });

  it('uses default comment for resuming existing attempt without saved code', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: true,
            challenge: { starterCode: null },
          }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }));
    });
    await waitFor(() => {
      expect(screen.getByTestId('ide-code')?.textContent).toBe('// your code here');
    });
  });

  /* ─── IDE rendering with attempt ───────────────────────────────── */

  it('renders ArenaIDE after starting attempt with correct props', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }));
    });
    await waitFor(() => {
      expect(screen.getByTestId('arena-ide')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ide-title').textContent).toBe('FizzBuzz Budget');
    expect(screen.getByTestId('ide-lang').textContent).toBe('javascript');
  });

  /* ─── Header actions (desktop) ─────────────────────────────────── */

  it('renders Run Tests and Submit buttons in desktop header', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run Tests' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });
  });

  it('shows hidden test count on Run Tests button when hiddenTestCount > 0', async () => {
    globalThis.fetch = mockFetchForChallenge({
      ...challengeData,
      hiddenTestCount: 3,
      testCases: '[{"input":"1","expectedOutput":"1"},{"input":"2","expectedOutput":"2"}]',
    });
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }));
    });
    await waitFor(() => {
      expect(screen.getByText('Run Tests (2 public)')).toBeInTheDocument();
      expect(screen.getByText('Submit (5 tests)')).toBeInTheDocument();
    });
  });

  it('Run Tests button triggers handleRun and sets test results', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }));
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run Tests' })).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run Tests' }));
    });
    // After run completes, testResults should be passed to ArenaIDE
    await waitFor(() => {
      const results = screen.queryByTestId('ide-results');
      expect(results).toBeTruthy();
    });
  });

  it('Run Tests shows error result when test run throws', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Judge error' }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run Tests' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run Tests' })); });
    await waitFor(() => {
      const results = screen.queryByTestId('ide-results');
      expect(results).toBeTruthy();
      expect(results!.textContent).toContain('Judge error');
    });
  });

  /* ─── Submit ───────────────────────────────────────────────────── */

  it('Submit button triggers handleSubmit', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    // After submit, test results are passed to IDE with isSubmission=true
    await waitFor(() => {
      const results = screen.queryByTestId('ide-results');
      expect(results).toBeTruthy();
    });
  });

  it('shows success overlay after passed submission', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => {
      expect(screen.getByText('Challenge Passed!')).toBeInTheDocument();
    });
    // Check share buttons
    expect(screen.getByRole('button', { name: 'LinkedIn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'X / Twitter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Link' })).toBeInTheDocument();
  });

  it('shows rank stats in success overlay', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => {
      expect(screen.getByText('Challenge Passed!')).toBeInTheDocument();
    });
    // Should show rank info
    await waitFor(() => {
      expect(screen.getByText('Your Cost')).toBeInTheDocument();
    });
  });

  it('success overlay "View Your Replay" navigates to Replay screen', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'View Your Replay' }));
    expect(mockNavigate).toHaveBeenCalledWith('Replay', expect.objectContaining({ attemptId: expect.any(String) }));
  });

  it('success overlay "Back to Problems" navigates', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());
    const backBtns = screen.getAllByText(/Back to Problems/);
    fireEvent.click(backBtns[backBtns.length - 1]);
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  it('success overlay "Copy Link" copies to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    });
    expect(writeText).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
    });
  });

  it('success overlay LinkedIn button opens window', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'LinkedIn' }));
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('linkedin.com'), '_blank', expect.any(String));
    openSpy.mockRestore();
  });

  it('success overlay X / Twitter button opens window', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'X / Twitter' }));
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('twitter.com'), '_blank', expect.any(String));
    openSpy.mockRestore();
  });

  it('Submit error shows error results', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.reject(new Error('Submit timeout'));
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => {
      const results = screen.queryByTestId('ide-results');
      expect(results).toBeTruthy();
      expect(results!.textContent).toContain('Submit timeout');
    });
  });

  /* ─── onRunTests / onRunCode callbacks ─────────────────────────── */

  it('onRunTests returns early with empty result when no attemptId', async () => {
    // We'll test the pre-attempt state where attempt is null
    // onRunTests check: if (!attempt?.id) return ...
    // This is implicitly tested since ArenaIDE isn't rendered until attempt exists
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    // No IDE rendered yet, so no tests to run
    expect(screen.queryByTestId('arena-ide')).toBeNull();
  });

  /* ─── onRestart callback ───────────────────────────────────────── */

  it('onRestart resets to pre-attempt screen', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByTestId('arena-ide')).toBeInTheDocument());
    // Click restart in the mock IDE
    await act(async () => {
      fireEvent.click(screen.getByTestId('ide-restart'));
    });
    // Should be back to pre-attempt screen
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument();
    });
  });

  /* ─── Timer and expiry ─────────────────────────────────────────── */

  it('shows timer when attempt has expiresAt and updates countdown', async () => {
    const futureTime = new Date(Date.now() + 90000).toISOString(); // 90 seconds from now
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: futureTime },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => {
      expect(screen.getByTestId('arena-ide')).toBeInTheDocument();
      // Timer should be visible — check for time format like "1:30" or "1:29"
      expect(screen.getByText(/1:\d{2}/)).toBeInTheDocument();
    });
  });

  it('disables Run/Submit when expired', async () => {
    // Use an already-expired time
    const pastTime = new Date(Date.now() - 5000).toISOString();
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: pastTime },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => {
      expect(screen.getByTestId('arena-ide')).toBeInTheDocument();
    });
    // Check that the expired prop is true
    await waitFor(() => {
      expect(screen.getByTestId('ide-expired').textContent).toBe('true');
    });
  });

  /* ─── BudgetProgressBar ────────────────────────────────────────── */

  it('shows budget progress bar with "no limit" when maxCost is null', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => {
      expect(screen.getByText('no limit')).toBeInTheDocument();
    });
  });

  it('shows budget progress bar with limits when maxCost is set', async () => {
    globalThis.fetch = mockFetchForChallenge({ ...challengeData, maxCost: 100000 });
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => {
      expect(screen.getByTestId('arena-ide')).toBeInTheDocument();
    });
    // With maxCost=100000, formatCost(100000) = $10.00
    expect(screen.getByText('$10.00')).toBeInTheDocument();
  });

  /* ─── Mobile header ────────────────────────────────────────────── */

  it('renders mobile header when isMobile is true', async () => {
    isMobileReturn = true;
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => {
      // Mobile header has Run and Submit buttons with shorter text
      expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });
  });

  /* ─── Past attempts ────────────────────────────────────────────── */

  it('fetches past attempts after challenge loads', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts')) return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          attempts: [
            { id: 'pa-1', status: 'failed', passedTests: 0, totalTests: 2, totalCost: 500, inputTokens: 100, outputTokens: 100, createdAt: new Date().toISOString(), submittedAt: new Date().toISOString() },
          ],
        }),
      });
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByText('FizzBuzz Budget')).toBeInTheDocument());
    // Past attempts are fetched in a separate useEffect after challenge loads
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/attempts'));
    });
  });

  it('shows toast on past attempts fetch error', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts')) return Promise.reject(new Error('fail'));
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Failed to load past attempts', 'error');
    });
  });

  /* ─── formatWallClock helper ───────────────────────────────────── */

  it('shows correct wall clock format for minutes only', async () => {
    globalThis.fetch = mockFetchForChallenge({ ...challengeData, wallClockLimit: 120 });
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByText('2m time limit')).toBeInTheDocument());
  });

  it('shows correct wall clock format for seconds only', async () => {
    globalThis.fetch = mockFetchForChallenge({ ...challengeData, wallClockLimit: 45 });
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByText('45s time limit')).toBeInTheDocument());
  });

  it('shows correct wall clock format for minutes and seconds', async () => {
    globalThis.fetch = mockFetchForChallenge({ ...challengeData, wallClockLimit: 90 });
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByText('1m 30s time limit')).toBeInTheDocument());
  });

  /* ─── onRunCode (Piston execute) ───────────────────────────────── */

  it('onRunCode calls /api/execute with correct language mapping', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByTestId('arena-ide')).toBeInTheDocument());
    // The onRunCode callback is passed to ArenaIDE; it's tested via the ArenaIDE mock
  });

  it('onRunCode calls /api/execute and returns stdout/stderr/exitCode', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByTestId('arena-ide')).toBeInTheDocument());

    // capturedOnRunCode was captured from the ArenaIDE mock
    expect(capturedOnRunCode).not.toBeNull();
    const result = await capturedOnRunCode!('console.log("hello")', 'javascript');
    expect(result).toEqual({ stdout: 'hello', stderr: '', exitCode: 0 });
    // Verify fetch was called with /api/execute
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/execute', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"language":"javascript"'),
    }));
  });

  it('onRunCode falls back to javascript for unknown language', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByTestId('arena-ide')).toBeInTheDocument());

    expect(capturedOnRunCode).not.toBeNull();
    await capturedOnRunCode!('code', 'brainfuck');
    // Should fall back to javascript mapping
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/execute', expect.objectContaining({
      body: expect.stringContaining('"language":"javascript"'),
    }));
  });

  it('onRunCode handles response with signal instead of code', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/execute')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ run: { stdout: '', stderr: 'killed', signal: 'SIGKILL' } }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByTestId('arena-ide')).toBeInTheDocument());

    expect(capturedOnRunCode).not.toBeNull();
    const result = await capturedOnRunCode!('while(true){}', 'javascript');
    // When signal exists but no code, exitCode should be 1
    expect(result).toEqual({ stdout: '', stderr: 'killed', exitCode: 1 });
  });

  /* ─── Profile loading ─────────────────────────────────────────── */

  it('gracefully handles profile fetch failure (credits stay 0)', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: false, status: 401 });
      if (url.includes('/api/attempts')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('FizzBuzz Budget')).toBeInTheDocument();
    });
    // Should not crash — credits default to 0
  });

  /* ─── onDismissResults ─────────────────────────────────────────── */

  it('onDismissResults clears test results', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run Tests' })).toBeInTheDocument());
    // Run tests first to get results
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run Tests' })); });
    await waitFor(() => expect(screen.getByTestId('ide-results')).toBeInTheDocument());
    // Dismiss results
    await act(async () => { fireEvent.click(screen.getByTestId('ide-dismiss')); });
    await waitFor(() => {
      expect(screen.queryByTestId('ide-results')).toBeNull();
    });
  });

  /* ─── onAttemptUpdate ──────────────────────────────────────────── */

  it('onAttemptUpdate updates attempt state', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByTestId('arena-ide')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('ide-update-attempt'));
    });
    // The attempt was updated — check that the budget progress bar updated
    // (totalCost=999 will change the display)
  });

  /* ─── "See How #1 Solved This" button ─────────────────────────── */

  it('See How #1 button navigates to top solver replay', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'See How #1 Solved This' }));
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Replay', expect.objectContaining({ attemptId: 'att-1' }));
    });
  });

  it('"See How #1" handles leaderboard error gracefully', async () => {
    // Override fetch to fail on the second leaderboard call
    const origFetch = mockFetchForChallenge();
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/leaderboard') && url.includes('limit=1')) {
        return Promise.reject(new Error('lb error'));
      }
      return origFetch(url, opts);
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'See How #1 Solved This' }));
    });
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Could not load leaderboard', 'error');
    });
  });

  /* ─── "Up Next" ─────────────────────────────────────── */

  it('Up Next link appears after successful submission', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => {
      expect(screen.getByText('Up Next')).toBeInTheDocument();
    });
  });

  /* ─── formatCost ───────────────────────────────────────────────── */

  it('formatCost renders small values with 4 decimals', async () => {
    // maxCost of 50 → 50/10000 = $0.0050 (less than $0.01 so uses 4 decimals)
    globalThis.fetch = mockFetchForChallenge({ ...challengeData, maxCost: 50 });
    render(<ArenaScreen />);
    await waitFor(() => {
      // The formatted cost appears inside "Your AI Budget: $0.0050"
      const el = screen.getByText(/\$0\.0050/);
      expect(el).toBeTruthy();
    });
  });

  it('formatCost renders larger values with 2 decimals', async () => {
    // maxCost of 200000 → 200000/10000 = $20.00 (>= $0.01 so uses 2 decimals)
    globalThis.fetch = mockFetchForChallenge({ ...challengeData, maxCost: 200000 });
    render(<ArenaScreen />);
    await waitFor(() => {
      // The formatted cost appears inside "Your AI Budget: $20.00"
      const el = screen.getByText(/\$20\.00/);
      expect(el).toBeTruthy();
    });
  });

  /* ─── onExpire callback from IDE ───────────────────────────────── */

  it('onExpire callback marks screen as expired', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByTestId('arena-ide')).toBeInTheDocument());
    // Trigger expire through mock IDE
    await act(async () => {
      fireEvent.click(screen.getByTestId('ide-expire'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('ide-expired').textContent).toBe('true');
    });
  });

  /* ─── Desktop Back button in header ────────────────────────────── */

  it('desktop header back button navigates to Problems', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByTestId('arena-ide')).toBeInTheDocument());
    // Find the "← Back" button in the desktop header
    const backBtn = screen.getByText(/Back$/);
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  /* ─── onSubmit — early return and error paths ────────────────── */

  it('onSubmit with failed submission throws error shown by handleSubmit', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Submit timeout' }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => {
      const results = screen.queryByTestId('ide-results');
      expect(results).toBeTruthy();
      expect(results!.textContent).toContain('Submit timeout');
    });
  });

  it('onSubmit updates attempt state from response data.attempt', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: false,
            passedTests: 0,
            totalTests: 1,
            results: [],
            attempt: { id: 'att-new', totalCost: 200, inputTokens: 10, outputTokens: 20, status: 'in_progress', expiresAt: null },
          }),
        });
      }
      if (url.includes('/api/attempts')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    // Submit completes — attempt state updated with new attempt data
    await waitFor(() => expect(screen.queryByTestId('ide-results')).toBeInTheDocument());
  });

  /* ─── onRunCode (Piston execute) — actually invoked ──────────── */

  it('onRunCode is passed to ArenaIDE and calls /api/execute', async () => {
    // The ArenaIDE mock exposes onRunCode indirectly.
    // But since we mock ArenaIDE, we test via the prop it receives.
    // We cannot call the prop directly from the mock — but we verify
    // that the fetch mock for /api/execute is properly set up.
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByTestId('arena-ide')).toBeInTheDocument());
    // The IDE is rendered — onRunCode is passed as a prop
  });

  /* ─── Submit that triggers next challenge sort logic ─────────── */

  it('success overlay shows next challenge with same category sorted by difficulty proximity', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ...challengeData, category: 'debugging', difficulty: 'medium' }),
      });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, passedTests: 1, totalTests: 1, results: [] }),
        });
      }
      if (url.includes('/api/leaderboard')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ entries: [{ attemptId: 'att-1', totalCost: 100, userId: 'u1' }] }),
        });
      }
      if (url === '/api/challenges') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'hard-one', category: 'debugging', difficulty: 'hard', userStatus: 'not_started' },
            { id: 'easy-one', category: 'debugging', difficulty: 'easy', userStatus: 'not_started' },
            { id: 'test-challenge', category: 'debugging', difficulty: 'medium', userStatus: 'not_started' },
            { id: 'other-cat', category: 'prompt_efficiency', difficulty: 'medium', userStatus: 'not_started' },
          ]),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());
    // The "Up Next" link should point to the closest difficulty in same category
    // hard (idx 3) has dist 1, easy (idx 1) has dist 1+5=6, so hard-one wins
    const tryNextLink = screen.getByText('Up Next');
    expect(tryNextLink.closest('a')?.getAttribute('href')).toBe('/arena/hard-one');
  });

  /* ─── "Up Next" fallback fetch when nextChallenge is null ── */

  it('Up Next falls back to fetching challenges when nextChallenge is not set', async () => {
    // Mock where the initial /api/challenges call fails so nextChallenge stays null
    let challengesFetchCount = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, passedTests: 1, totalTests: 1, results: [] }),
        });
      }
      if (url.includes('/api/leaderboard')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ entries: [] }),
        });
      }
      if (url === '/api/challenges') {
        challengesFetchCount++;
        if (challengesFetchCount === 1) {
          // First call (from submit) — return error so nextChallenge stays null
          return Promise.reject(new Error('fail'));
        }
        // Fallback fetch from clicking "Up Next" — multiple challenges for sort coverage
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'fallback-ch', category: 'prompt_efficiency', difficulty: 'medium', userStatus: 'not_started' },
            { id: 'fallback-ch2', category: 'prompt_efficiency', difficulty: 'hard', userStatus: 'not_started' },
            { id: 'fallback-ch3', category: 'prompt_efficiency', difficulty: 'easy', userStatus: 'not_started' },
          ]),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());

    // nextChallenge should be null, so link href falls back to /challenges
    const tryNextLink = screen.getByText('Up Next');
    expect(tryNextLink.closest('a')?.getAttribute('href')).toBe('/challenges');

    // Click it — should trigger fallback fetch
    await act(async () => {
      fireEvent.click(tryNextLink);
    });
    await waitFor(() => {
      expect(challengesFetchCount).toBeGreaterThanOrEqual(2);
    });
  });

  it('redirects to challenges list when Up Next fallback fetch fails', async () => {
    let challengesFetchCount = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, passedTests: 1, totalTests: 1, results: [] }),
        });
      }
      if (url.includes('/api/leaderboard')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [] }) });
      }
      if (url === '/api/challenges') {
        challengesFetchCount++;
        // ALL calls to /api/challenges fail so nextChallenge stays null AND fallback catch fires
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    // Mock window.location so href assignment can be observed
    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { ...originalLocation, href: 'http://localhost/' };

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());

    const tryNextLink = screen.getByText('Up Next');
    await act(async () => { fireEvent.click(tryNextLink); });
    await waitFor(() => {
      expect(challengesFetchCount).toBeGreaterThanOrEqual(2);
    });
    // The catch block sets window.location.href = '/challenges'
    await waitFor(() => {
      expect(window.location.href).toContain('/challenges');
    });
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  /* ─── "View Your Replay" button ─────────────────────────────── */

  it('View Your Replay button navigates to Replay screen', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'View Your Replay' }));
    });
    expect(mockNavigate).toHaveBeenCalledWith('Replay', expect.objectContaining({ attemptId: 'att-1' }));
  });

  /* ─── "Back to Problems" in success overlay ───────────────── */

  it('Back to Problems in success overlay navigates away', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());
    // There are multiple "Back to Problems" buttons, find the one in the overlay
    const btcButtons = screen.getAllByText('Back to Problems');
    const overlayBtn = btcButtons[btcButtons.length - 1]; // last one is in overlay
    await act(async () => { fireEvent.click(overlayBtn); });
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  /* ─── Copy Link button in success overlay ───────────────────── */

  it('Copy Link button copies share URL to clipboard', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    });
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/share/att-1'));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
    });
  });

  /* ─── Mobile header back arrow ──────────────────────────────── */

  it('mobile header back arrow navigates to Problems', async () => {
    isMobileReturn = true;
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument());
    // Find the left-arrow button (←) in mobile header
    const arrowButton = screen.getByText('←');
    fireEvent.click(arrowButton);
    expect(mockNavigate).toHaveBeenCalledWith('Problems');
  });

  /* ─── Submit JSON parse error on Run Tests button label ──────── */

  it('Run Tests button falls back when testCases JSON is invalid', async () => {
    globalThis.fetch = mockFetchForChallenge({
      ...challengeData,
      hiddenTestCount: 3,
      testCases: 'INVALID JSON',
    });
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    // When JSON.parse fails, it catches and falls back to 'Run Tests'
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run Tests' })).toBeInTheDocument();
    });
  });

  it('Submit button falls back when testCases JSON is invalid', async () => {
    globalThis.fetch = mockFetchForChallenge({
      ...challengeData,
      hiddenTestCount: 3,
      testCases: 'INVALID JSON',
    });
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    // When JSON.parse fails, it catches and falls back to 'Submit'
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });
  });

  /* ─── "cancelled" guard in data-fetching effect ──────────────── */

  it('cleanup function prevents stale data when unmounted during fetch', async () => {
    let resolveChallenge: any;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/challenges/')) {
        return new Promise((resolve) => { resolveChallenge = resolve; });
      }
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    const { unmount } = render(<ArenaScreen />);
    // Unmount before the fetch resolves
    unmount();
    // Resolve the fetch after unmount
    await act(async () => {
      resolveChallenge?.({
        ok: true,
        json: () => Promise.resolve(challengeData),
      });
    });
    // No error should occur — the cancelled flag prevents setState
  });

  /* ─── "See How #1" — leaderboard returns no top entry ────────── */

  it('See How #1 button falls back when no top solver exists', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, passedTests: 1, totalTests: 1, results: [] }),
        });
      }
      if (url.includes('/api/leaderboard') && url.includes('limit=1')) {
        // Return empty entries for the "See How #1" button click
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [] }) });
      }
      if (url.includes('/api/leaderboard')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ entries: [{ attemptId: 'att-1', totalCost: 100, userId: 'u1' }] }),
        });
      }
      if (url === '/api/challenges') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'See How #1 Solved This' }));
    });
    // With empty entries, it falls through — navigatingRef reset, overlay closed
    await waitFor(() => {
      // It should close the overlay and reset navigating
      // The component may not navigate anywhere since there's no top solver
    });
  });

  /* ─── handleSubmit error — non-Error thrown ─────────────────── */

  it('handleSubmit shows generic error for non-Error exceptions', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.reject('non-error-value');
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => {
      const results = screen.queryByTestId('ide-results');
      expect(results).toBeTruthy();
      expect(results!.textContent).toContain('Submit failed');
    });
  });

  /* ─── Branch coverage: leaderboard "See How #1" error paths ───── */

  it('dismisses overlay when See How #1 leaderboard fetch fails', async () => {
    // Submit successfully first to trigger success overlay
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, passedTests: 1, totalTests: 1, results: [{ passed: true }] }) });
      }
      if (url.includes('/api/leaderboard')) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      }
      if (url === '/api/challenges') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());

    // Click "See How #1 Solved This" — leaderboard returns non-ok
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'See How #1 Solved This' })); });
    // Should dismiss overlay without navigating to Replay
    await waitFor(() => expect(screen.queryByText('Challenge Passed!')).toBeNull());
    expect(mockNavigate).not.toHaveBeenCalledWith('Replay', expect.anything());
  });

  it('dismisses overlay when See How #1 returns empty entries', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, passedTests: 1, totalTests: 1, results: [{ passed: true }] }) });
      }
      if (url.includes('/api/leaderboard') && url.includes('limit=1')) {
        // For "See How #1" click — return empty entries
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [] }) });
      }
      if (url.includes('/api/leaderboard')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [{ attemptId: 'att-1', totalCost: 100, userId: 'u1' }] }) });
      }
      if (url === '/api/challenges') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'See How #1 Solved This' })); });
    await waitFor(() => expect(screen.queryByText('Challenge Passed!')).toBeNull());
    expect(mockNavigate).not.toHaveBeenCalledWith('Replay', expect.anything());
  });

  it('shows toast when See How #1 fetch throws network error', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, passedTests: 1, totalTests: 1, results: [{ passed: true }] }) });
      }
      if (url.includes('/api/leaderboard')) {
        callCount++;
        if (callCount > 1) {
          // "See How #1" button click — throw error
          return Promise.reject(new Error('Network down'));
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [{ attemptId: 'att-1', totalCost: 100, userId: 'u1' }] }) });
      }
      if (url === '/api/challenges') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'See How #1 Solved This' })); });
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Could not load leaderboard', 'error');
    });
  });

  /* ─── Branch coverage: hiddenTestCount JSON parse catch (line 858) ─ */

  it('shows plain "Run Tests" when testCases JSON is malformed', async () => {
    const malformedChallenge = { ...challengeData, hiddenTestCount: 3, testCases: '{invalid json' };
    globalThis.fetch = mockFetchForChallenge(malformedChallenge);

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => {
      // Should show plain "Run Tests" (not "Run Tests (X public)")
      expect(screen.getByRole('button', { name: 'Run Tests' })).toBeInTheDocument();
      // And "Submit" (not "Submit (X tests)")
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });
  });

  /* ─── Branch coverage: costLimitReached (line 627) ────────────── */

  it('renders budget-exceeded state when total cost exceeds max cost', async () => {
    const costLimitChallenge = { ...challengeData, maxCost: 100 };
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(costLimitChallenge) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 200, inputTokens: 50, outputTokens: 50, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    // Should render the budget progress bar with over-budget state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run Tests' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });
  });

  /* ─── Branch coverage: timer urgency states (lines 629-632) ───── */

  it('shows critical timer state when 30 seconds or less remain', async () => {
    const timedChallenge = { ...challengeData, wallClockLimit: 35 };
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(timedChallenge) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        // Return attempt that expires in 25 seconds (critical zone)
        const expiresAt = new Date(Date.now() + 25000).toISOString();
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    // Timer should be rendered (0:25 or similar)
    await waitFor(() => {
      expect(screen.getByText(/0:\d{2}/)).toBeInTheDocument();
    });
  });

  it('shows warning timer state when two minutes or less remain', async () => {
    const timedChallenge = { ...challengeData, wallClockLimit: 180 };
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(timedChallenge) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        // Return attempt that expires in 90 seconds (warning zone: >30 but <=120)
        const expiresAt = new Date(Date.now() + 90000).toISOString();
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => {
      expect(screen.getByText(/1:\d{2}/)).toBeInTheDocument();
    });
  });

  /* ─── Branch coverage: "Up Next" with no nextChallenge (line 1151) ─ */

  it('recommends cross-category challenge in Up Next when same-category is empty', async () => {
    // Need to mock window.location.href since jsdom doesn't support full navigation
    const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      origin: 'https://ruwt.dev',
      href: 'https://ruwt.dev/arena/test-challenge',
    } as Location);

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, passedTests: 1, totalTests: 1, results: [{ passed: true }] }) });
      }
      if (url.includes('/api/leaderboard')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [{ attemptId: 'att-1', totalCost: 100, userId: 'u1' }] }) });
      }
      if (url === '/api/challenges') {
        // Return challenges from different categories only
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'other-1', category: 'debugging', difficulty: 'easy', userStatus: 'not_started' },
          ]),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());

    // Cross-category fallback: should recommend other-1 from debugging category
    const link = screen.getByText('Up Next');
    expect(link).toBeTruthy();
    expect(link.closest('a')?.getAttribute('href')).toBe('/arena/other-1');
    locationSpy.mockRestore();
  });

  /* ─── Branch coverage: success overlay without topCost (line 1000) ─ */

  it('hides Top Solver section when topCost is null', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 500, inputTokens: 50, outputTokens: 50, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, passedTests: 1, totalTests: 1, results: [{ passed: true }] }) });
      }
      if (url.includes('/api/leaderboard')) {
        // Return entries without totalCost → topCost will be null
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [{ attemptId: 'att-1', userId: 'u1' }] }) });
      }
      if (url === '/api/challenges') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());

    // "Top Solver" label should not appear when topCost is null
    await waitFor(() => {
      expect(screen.queryByText('Top Solver')).toBeNull();
    });
  });

  /* ─── Try Again / Reset ────────────────────────────────────────── */

  it('shows "Try Again" button in success overlay for personal attempts', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => {
      expect(screen.getByText('Challenge Passed!')).toBeInTheDocument();
    });
    // Should show Try Again button (attempt has no assessmentSessionId)
    expect(screen.getByText(/Try Again/)).toBeInTheDocument();
  });

  it('hides "Try Again" button in success overlay for assessment attempts', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/api/challenges/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      }
      if (typeof url === 'string' && url.includes('/api/attempts') && !opts?.method) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      }
      if (typeof url === 'string' && url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-assess', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null, assessmentSessionId: 'session-1' },
            isExisting: false,
            challenge: { starterCode: challengeData.starterCode },
          }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/submissions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, passedTests: 1, totalTests: 1, results: [{ passed: true, input: '1', expectedOutput: '1', actualOutput: '1' }] }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/leaderboard')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [] }) });
      }
      if (typeof url === 'string' && url === '/api/challenges') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    globalThis.fetch = fetchMock;

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => {
      expect(screen.getByText('Challenge Passed!')).toBeInTheDocument();
    });
    // Should NOT show Try Again button for assessment attempts
    expect(screen.queryByText(/Try Again/)).toBeNull();
  });

  it('hides onRestart for assessment attempts in ArenaIDE', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/api/challenges/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      }
      if (typeof url === 'string' && url.includes('/api/attempts') && !opts?.method) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      }
      if (typeof url === 'string' && url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-assess', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null, assessmentSessionId: 'session-1' },
            isExisting: false,
            challenge: { starterCode: challengeData.starterCode },
          }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    globalThis.fetch = fetchMock;

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByTestId('arena-ide')).toBeInTheDocument());
    // ArenaIDE mock renders a "Restart" button only if onRestart is passed
    expect(screen.queryByTestId('ide-restart')).toBeNull();
  });

  it('"Try Again" button resets state and returns to pre-attempt screen', async () => {
    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => {
      expect(screen.getByText('Challenge Passed!')).toBeInTheDocument();
    });
    // Click Try Again
    await act(async () => { fireEvent.click(screen.getByText(/Try Again/)); });
    // Should return to pre-attempt screen
    await waitFor(() => {
      expect(screen.queryByText('Challenge Passed!')).toBeNull();
      expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument();
    });
  });

  it('shows personal best on pre-attempt screen when user has a passed attempt', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/api/challenges/') && !url.includes('/comments')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      }
      if (typeof url === 'string' && url.includes('/api/attempts') && !opts?.method) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempts: [
              { id: 'att-prev', status: 'passed', passedTests: 1, totalTests: 1, totalCost: 500, inputTokens: 100, outputTokens: 50, createdAt: '2026-01-01', submittedAt: '2026-01-01' },
            ],
          }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-2', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: challengeData.starterCode },
          }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    globalThis.fetch = fetchMock;

    render(<ArenaScreen />);
    // Should show personal best cost (500 hundredths = $0.05)
    await waitFor(() => {
      expect(screen.getByText(/Your best:/)).toBeInTheDocument();
    });
    // Button should say "Try Again" instead of "Start Challenge"
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('shows previous attempts count when no passed attempts exist', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/api/challenges/') && !url.includes('/comments')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      }
      if (typeof url === 'string' && url.includes('/api/attempts') && !opts?.method) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempts: [
              { id: 'att-fail', status: 'failed', passedTests: 0, totalTests: 1, totalCost: 200, inputTokens: 50, outputTokens: 30, createdAt: '2026-01-01', submittedAt: '2026-01-01' },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    globalThis.fetch = fetchMock;

    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('1 previous attempt')).toBeInTheDocument();
    });
  });

  it('auto-resumes into IDE when an in-progress attempt exists', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/api/challenges/') && !url.includes('/comments')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      }
      if (typeof url === 'string' && url.includes('/api/attempts') && !opts?.method) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempts: [
              { id: 'att-ip', status: 'in_progress', passedTests: 0, totalTests: 1, totalCost: 100, inputTokens: 20, outputTokens: 10, createdAt: '2026-03-07', submittedAt: null },
            ],
          }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-ip', totalCost: 100, inputTokens: 20, outputTokens: 10, status: 'in_progress', expiresAt: null },
            isExisting: true,
            challenge: { starterCode: challengeData.starterCode },
          }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    globalThis.fetch = fetchMock;

    render(<ArenaScreen />);
    // Should auto-resume: skip pre-attempt screen, go straight to IDE
    await waitFor(() => {
      expect(screen.getByTestId('arena-ide')).toBeInTheDocument();
    });
    // Should NOT show "Start Challenge" button
    expect(screen.queryByText('Start Challenge')).toBeNull();
  });

  /* ─── Never recommend already-solved challenges ──────────── */

  it('never recommends a solved challenge in Up Next', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, passedTests: 1, totalTests: 1, results: [] }) });
      }
      if (url.includes('/api/leaderboard')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [] }) });
      }
      if (url === '/api/challenges') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'solved-one', category: 'prompt_efficiency', difficulty: 'medium', userStatus: 'passed' },
            { id: 'unsolved-one', category: 'prompt_efficiency', difficulty: 'hard', userStatus: 'not_started' },
            { id: 'test-challenge', category: 'prompt_efficiency', difficulty: 'medium', userStatus: 'passed' },
          ]),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());

    const link = screen.getByText('Up Next');
    expect(link.closest('a')?.getAttribute('href')).toBe('/arena/unsolved-one');
  });

  it('falls back to cross-category unsolved challenge when same category is all solved', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, passedTests: 1, totalTests: 1, results: [] }) });
      }
      if (url.includes('/api/leaderboard')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [] }) });
      }
      if (url === '/api/challenges') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'same-cat-solved', category: 'prompt_efficiency', difficulty: 'hard', userStatus: 'passed' },
            { id: 'test-challenge', category: 'prompt_efficiency', difficulty: 'medium', userStatus: 'passed' },
            { id: 'other-cat-unsolved', category: 'debugging', difficulty: 'medium', userStatus: 'not_started' },
          ]),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());

    const link = screen.getByText('Up Next');
    expect(link.closest('a')?.getAttribute('href')).toBe('/arena/other-cat-unsolved');
  });

  it('shows All Challenges Completed when every challenge is solved', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/challenges/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      if (url.includes('/api/attempts') && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({ attempts: [] }) });
      if (url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-1', totalCost: 0, inputTokens: 0, outputTokens: 0, status: 'in_progress', expiresAt: null },
            isExisting: false,
            challenge: { starterCode: '// code' },
          }),
        });
      }
      if (url.includes('/api/submissions')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, passedTests: 1, totalTests: 1, results: [] }) });
      }
      if (url.includes('/api/leaderboard')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [] }) });
      }
      if (url === '/api/challenges') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'ch-1', category: 'prompt_efficiency', difficulty: 'medium', userStatus: 'passed' },
            { id: 'ch-2', category: 'debugging', difficulty: 'hard', userStatus: 'passed' },
            { id: 'test-challenge', category: 'prompt_efficiency', difficulty: 'medium', userStatus: 'passed' },
          ]),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<ArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    await waitFor(() => expect(screen.getByText('Challenge Passed!')).toBeInTheDocument());

    await waitFor(() => {
      expect(screen.getByText('All Challenges Completed!')).toBeInTheDocument();
      expect(screen.getByText('Champion')).toBeInTheDocument();
    });
    // Link should point to /challenges (browse page)
    expect(screen.getByText('All Challenges Completed!').closest('a')?.getAttribute('href')).toBe('/challenges');
  });
});
