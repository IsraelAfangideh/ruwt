// @vitest-environment jsdom
/**
 * Dark-mode + mobile variant of ArenaScreen tests.
 * Exercises isDark/isMobile branches for styling ternaries.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockReset = vi.fn();
let routeParams: Record<string, string> = { challengeId: 'test-challenge' };

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
  useRoute: () => ({ params: routeParams }),
}));

let authReturn = { user: { id: 'u1', email: 'test@test.com' }, loading: false };
vi.mock('@/shared/hooks/useAuthGuard', () => ({
  useAuthGuard: () => authReturn,
}));

let capturedOnRunCode: any = null;
vi.mock('@/features/arena/ArenaIDE', () => ({
  ArenaIDE: (props: any) => {
    capturedOnRunCode = props.onRunCode || null;
    return (
      <div data-testid="arena-ide">
        <span data-testid="ide-title">{props.challenge?.title || 'IDE'}</span>
        <span data-testid="ide-expired">{String(!!props.isExpired)}</span>
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

vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117', surface: '#161b22', text: '#e6e1d6', textMuted: '#8a847a',
    textSubtle: '#6b665c', accent: '#c9a962', border: '#2a2520',
    error: '#ef4444', success: '#3fb950', accentBg: '#ffe',
  },
}));
let isMobileReturn = true;
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
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockDarkTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens({ mono: true }));

const challengeData: Record<string, any> = {
  id: 'test-challenge', title: 'FizzBuzz Budget', difficulty: 'medium',
  category: 'prompt_efficiency', description: 'Test challenge description that is under 200 chars',
  starterCode: '// start here', testCases: '[{"input":"1","expectedOutput":"1"}]',
  language: 'javascript', maxCost: null, wallClockLimit: null, hiddenTestCount: 0, stats: null,
};

function mockFetchForChallenge(challenge = challengeData) {
  return vi.fn().mockImplementation((url: string, opts?: any) => {
    if (typeof url === 'string' && url.includes('/api/challenges/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(challenge) });
    }
    if (typeof url === 'string' && url === '/api/profile') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ credits: 50000 }) });
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
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, passedTests: 1, totalTests: 1, results: [{ passed: true, input: '1', expectedOutput: '1', actualOutput: '1' }] }) });
    }
    if (typeof url === 'string' && url.includes('/api/leaderboard')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [{ attemptId: 'att-1', totalCost: 100, userId: 'u1' }] }) });
    }
    if (typeof url === 'string' && url === '/api/challenges') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (typeof url === 'string' && url.includes('/api/execute')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ run: { stdout: 'hello', stderr: '', code: 0 } }) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

const { ArenaScreen } = await import('./ArenaScreen');

describe('ArenaScreen (dark mode + mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeParams = { challengeId: 'test-challenge' };
    authReturn = { user: { id: 'u1', email: 'test@test.com' }, loading: false };
    isMobileReturn = true;
    capturedOnRunCode = null;
    globalThis.fetch = mockFetchForChallenge();
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('renders challenge details view in dark mode + mobile', async () => {
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/FizzBuzz Budget/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders difficulty badge in dark mode', async () => {
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });
  });

  it('starts attempt and renders IDE in dark mode', async () => {
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }));
    await waitFor(() => {
      expect(screen.getByTestId('arena-ide')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    const { container } = render(<ArenaScreen />);
    expect(container.innerHTML).not.toBe('');
  });

  it('renders with stats', async () => {
    globalThis.fetch = mockFetchForChallenge({
      ...challengeData,
      stats: { solvers: 5, avgCost: 200, bestCost: 50 },
      hiddenTestCount: 3,
    });
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/FizzBuzz Budget/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles error response', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/challenges/')) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Not found' }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load challenge/i)).toBeInTheDocument();
    });
  });

  it('renders with wall clock limit in dark mode', async () => {
    globalThis.fetch = mockFetchForChallenge({
      ...challengeData,
      wallClockLimit: 600,
      maxCost: 5000,
    });
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/FizzBuzz Budget/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('auto-resumes in-progress attempt in dark mode', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/api/challenges/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(challengeData) });
      }
      if (typeof url === 'string' && url === '/api/profile') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ credits: 50000 }) });
      }
      if (typeof url === 'string' && url.includes('/api/attempts') && !opts?.method) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempts: [{ id: 'att-existing', status: 'in_progress', totalCost: 100, inputTokens: 50, outputTokens: 25, expiresAt: null }],
          }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/attempts') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempt: { id: 'att-existing', totalCost: 100, inputTokens: 50, outputTokens: 25, status: 'in_progress', expiresAt: null },
            isExisting: true,
            challenge: { starterCode: challengeData.starterCode },
          }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    render(<ArenaScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('arena-ide')).toBeInTheDocument();
    });
  });
});
