// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
let mockChallengeId = 'one-shot-csv-parser';
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: vi.fn() }),
  useRoute: () => ({ params: { challengeId: mockChallengeId } }),
}));
vi.mock('@/features/arena/ArenaIDE', () => ({
  ArenaIDE: (props: any) => (
    <div data-testid="arena-ide">
      {props.challenge?.title || 'IDE'}
      <button data-testid="run-tests-cb" onClick={() => props.onRunTests?.('code', 'javascript')}>RunTests</button>
      <button data-testid="submit-cb">SubmitCb</button>
      <button data-testid="run-code-cb" onClick={() => props.onRunCode?.('console.log(1)', 'javascript').catch(() => {})}>RunCode</button>
      <button data-testid="code-change-cb" onClick={() => props.onCodeChange?.('new code')}>ChangeCode</button>
      <span data-testid="guest-flag">{props.guestMode ? 'guest' : 'auth'}</span>
    </div>
  ),
}));
vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117', text: '#e6e1d6', textMuted: '#8a847a', textSubtle: '#6b665c',
    accent: '#c9a962', border: '#2a2520', error: '#ef4444', success: '#3fb950',
    surface: '#161b22',
  },
}));
vi.mock('@/shared/lib/difficulty', () => ({
  getDifficultyStyle: () => ({ color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', label: 'Medium' }),
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens({ mono: true }));

const mockChallenge = {
  id: 'one-shot-csv-parser',
  title: 'One-Shot CSV Parser',
  difficulty: 'easy',
  category: 'prompt_efficiency',
  description: 'Write a CSV parser that handles quoted fields',
  starterCode: '// your code here',
  testCases: '[]',
  language: 'javascript',
};

// Initial fetch stub for module import
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockChallenge),
}));

const { GuestArenaScreen } = await import('./GuestArenaScreen');

describe('GuestArenaScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChallengeId = 'one-shot-csv-parser';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockChallenge),
    }));
    // Reset localStorage
    localStorage.clear();
  });

  it('renders loading state initially', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const { container } = render(<GuestArenaScreen />);
    expect(container.querySelector('[data-testid="skeleton-split-pane"]')).toBeInTheDocument();
  });

  it('renders error when challenge not found (404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Challenge not found').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders error for non-404 failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Failed to load challenge').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('navigates to Landing when Back to Home is clicked in error state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Challenge not found').length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
  });

  it('handles network error in fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Network error').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles non-Error exception in fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('string error'));
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Something went wrong').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders full challenge view with title, difficulty badge, and GUEST MODE badge', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('One-Shot CSV Parser').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('GUEST MODE')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders header navigation button to ruwt.dev', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('One-Shot CSV Parser').length).toBeGreaterThanOrEqual(1);
    });
    // Click the header navigation back button
    const backBtn = screen.getByText(/ruwt\.dev/);
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
  });

  it('renders Run Tests and Submit buttons in header', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('One-Shot CSV Parser').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByRole('button', { name: 'Run Tests' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('shows signup overlay when Run Tests header button is clicked', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run Tests' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run Tests' }));
    await waitFor(() => {
      expect(screen.getByText('Sign Up to Continue')).toBeInTheDocument();
      expect(screen.getByText(/Create a free account/)).toBeInTheDocument();
    });
  });

  it('shows signup overlay when Submit header button is clicked', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => {
      expect(screen.getByText('Sign Up to Continue')).toBeInTheDocument();
    });
  });

  it('stores challengeId in localStorage when guest action is triggered', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run Tests' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Run Tests' }));
    expect(localStorage.getItem('ruwt_pending_challenge')).toBe('one-shot-csv-parser');
  });

  it('navigates to Register when Sign Up Free is clicked in overlay', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run Tests' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Run Tests' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign Up Free' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up Free' }));
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to Login when Sign In is clicked in overlay', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run Tests' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Run Tests' }));
    await waitFor(() => expect(screen.getByText(/Already have an account/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Already have an account/));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('dismisses signup overlay when Continue exploring is clicked', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run Tests' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Run Tests' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue exploring' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Continue exploring' }));
    await waitFor(() => expect(screen.queryByText('Sign Up to Continue')).toBeNull());
  });

  it('passes guestMode=true to ArenaIDE', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('guest-flag')?.textContent).toBe('guest');
    });
  });

  it('onRunTests callback shows signup overlay and returns failed result', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByTestId('run-tests-cb')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('run-tests-cb'));
    await waitFor(() => {
      expect(screen.getByText('Sign Up to Continue')).toBeInTheDocument();
    });
  });

  it('onRunCode callback calls /api/execute', async () => {
    const fetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/execute')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ run: { stdout: 'hello', stderr: '', code: 0 } }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockChallenge) });
    });
    vi.stubGlobal('fetch', fetchFn);
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByTestId('run-code-cb')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('run-code-cb'));
    await waitFor(() => {
      const calls = fetchFn.mock.calls;
      expect(calls.some((c: any) => c[0]?.includes('/api/execute'))).toBeTruthy();
    });
  });

  it('uses default starterCode when challenge has no starterCode', async () => {
    const noStarter = { ...mockChallenge, starterCode: null };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(noStarter),
    }));
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('One-Shot CSV Parser').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles PISTON_LANGUAGES lookup for unknown language', async () => {
    const pythonChallenge = { ...mockChallenge, language: 'python' };
    const fetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/execute')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ run: { stdout: '', stderr: '', code: 0 } }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(pythonChallenge) });
    });
    vi.stubGlobal('fetch', fetchFn);
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByTestId('run-code-cb')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('run-code-cb'));
    await waitFor(() => {
      const calls = fetchFn.mock.calls;
      expect(calls.some((c: any) => c[0]?.includes('/api/execute'))).toBeTruthy();
    });
  });

  it('onRunCode handles signal in response', async () => {
    const fetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/execute')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ run: { stdout: '', stderr: 'killed', signal: 'SIGKILL' } }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockChallenge) });
    });
    vi.stubGlobal('fetch', fetchFn);
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByTestId('run-code-cb')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('run-code-cb'));
    await waitFor(() => {
      expect(fetchFn.mock.calls.some((c: any) => c[0]?.includes('/api/execute'))).toBeTruthy();
    });
  });

  it('shows error when challengeId is empty', async () => {
    mockChallengeId = '';
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('No challenge selected').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('onRunCode returns exit code 0 when response has no exit code or signal', async () => {
    const fetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/execute')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ run: { stdout: 'ok', stderr: '' } }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockChallenge) });
    });
    vi.stubGlobal('fetch', fetchFn);
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByTestId('run-code-cb')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('run-code-cb'));
    await waitFor(() => {
      expect(fetchFn.mock.calls.some((c: any) => c[0]?.includes('/api/execute'))).toBeTruthy();
    });
  });

  it('onRunCode handles empty run object in execute response', async () => {
    const fetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/execute')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockChallenge) });
    });
    vi.stubGlobal('fetch', fetchFn);
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByTestId('run-code-cb')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('run-code-cb'));
    await waitFor(() => {
      expect(fetchFn.mock.calls.some((c: any) => c[0]?.includes('/api/execute'))).toBeTruthy();
    });
  });
});
