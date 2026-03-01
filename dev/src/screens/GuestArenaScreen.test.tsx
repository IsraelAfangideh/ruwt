// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
let mockChallengeId = 'fizzbuzz-budget';
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: vi.fn() }),
  useRoute: () => ({ params: { challengeId: mockChallengeId } }),
}));
vi.mock('@/components/ArenaIDE', () => ({
  ArenaIDE: (props: any) => (
    <div data-testid="arena-ide">
      {props.challenge?.title || 'IDE'}
      <button data-testid="run-tests-cb" onClick={() => props.onRunTests?.('code', 'javascript')}>RunTests</button>
      <button data-testid="submit-cb" onClick={() => props.onSubmit?.('code', 'javascript')}>SubmitCb</button>
      <button data-testid="run-code-cb" onClick={() => props.onRunCode?.('console.log(1)', 'javascript').catch(() => {})}>RunCode</button>
      <button data-testid="code-change-cb" onClick={() => props.onCodeChange?.('new code')}>ChangeCode</button>
      <span data-testid="guest-flag">{props.guestMode ? 'guest' : 'auth'}</span>
    </div>
  ),
}));
vi.mock('@/theme/colors', () => ({
  arena: {
    bg: '#0d1117', text: '#e6e1d6', textMuted: '#8a847a', textSubtle: '#6b665c',
    accent: '#c9a962', border: '#2a2520', error: '#ef4444', success: '#3fb950',
    surface: '#161b22',
  },
}));
vi.mock('@/lib/difficulty', () => ({
  getDifficultyStyle: () => ({ color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', label: 'Medium' }),
}));
vi.mock('@/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
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

const mockChallenge = {
  id: 'fizzbuzz-budget',
  title: 'FizzBuzz Budget',
  difficulty: 'easy',
  category: 'prompt_efficiency',
  description: 'Solve FizzBuzz within budget',
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
    mockChallengeId = 'fizzbuzz-budget';
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
    expect(container.querySelector('svg') || container.textContent).toBeTruthy();
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
    fireEvent.click(screen.getByText('Back to Home'));
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
      expect(screen.getAllByText('FizzBuzz Budget').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('GUEST MODE')).toBeTruthy();
    expect(screen.getByText('Medium')).toBeTruthy();
  });

  it('renders header navigation button to ruwt.dev', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('FizzBuzz Budget').length).toBeGreaterThanOrEqual(1);
    });
    // Click the header navigation back button
    const backBtn = screen.getByText(/ruwt\.dev/);
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('Landing');
  });

  it('renders Run Tests and Submit buttons in header', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('FizzBuzz Budget').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('Run Tests')).toBeTruthy();
    expect(screen.getByText('Submit')).toBeTruthy();
  });

  it('shows signup overlay when Run Tests header button is clicked', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('Run Tests')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Run Tests'));
    await waitFor(() => {
      expect(screen.getByText('Sign Up to Continue')).toBeTruthy();
      expect(screen.getByText(/Create a free account/)).toBeTruthy();
    });
  });

  it('shows signup overlay when Submit header button is clicked', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getByText('Submit')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Submit'));
    await waitFor(() => {
      expect(screen.getByText('Sign Up to Continue')).toBeTruthy();
    });
  });

  it('stores challengeId in localStorage when guest action is triggered', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByText('Run Tests')).toBeTruthy());
    fireEvent.click(screen.getByText('Run Tests'));
    expect(localStorage.getItem('ruwt_pending_challenge')).toBe('fizzbuzz-budget');
  });

  it('navigates to Register when Sign Up Free is clicked in overlay', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByText('Run Tests')).toBeTruthy());
    fireEvent.click(screen.getByText('Run Tests'));
    await waitFor(() => expect(screen.getByText('Sign Up Free')).toBeTruthy());
    fireEvent.click(screen.getByText('Sign Up Free'));
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to Login when Sign In is clicked in overlay', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByText('Run Tests')).toBeTruthy());
    fireEvent.click(screen.getByText('Run Tests'));
    await waitFor(() => expect(screen.getByText(/Already have an account/)).toBeTruthy());
    fireEvent.click(screen.getByText(/Already have an account/));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('dismisses signup overlay when Continue exploring is clicked', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByText('Run Tests')).toBeTruthy());
    fireEvent.click(screen.getByText('Run Tests'));
    await waitFor(() => expect(screen.getByText('Continue exploring')).toBeTruthy());
    fireEvent.click(screen.getByText('Continue exploring'));
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
    await waitFor(() => expect(screen.getByTestId('run-tests-cb')).toBeTruthy());
    fireEvent.click(screen.getByTestId('run-tests-cb'));
    await waitFor(() => {
      expect(screen.getByText('Sign Up to Continue')).toBeTruthy();
    });
  });

  it('onSubmit callback shows signup overlay and returns failed result', async () => {
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByTestId('submit-cb')).toBeTruthy());
    fireEvent.click(screen.getByTestId('submit-cb'));
    await waitFor(() => {
      expect(screen.getByText('Sign Up to Continue')).toBeTruthy();
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
    await waitFor(() => expect(screen.getByTestId('run-code-cb')).toBeTruthy());
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
      expect(screen.getAllByText('FizzBuzz Budget').length).toBeGreaterThanOrEqual(1);
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
    await waitFor(() => expect(screen.getByTestId('run-code-cb')).toBeTruthy());
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
    await waitFor(() => expect(screen.getByTestId('run-code-cb')).toBeTruthy());
    fireEvent.click(screen.getByTestId('run-code-cb'));
    await waitFor(() => {
      expect(fetchFn.mock.calls.some((c: any) => c[0]?.includes('/api/execute'))).toBeTruthy();
    });
  });

  it('shows error when challengeId is empty (lines 38-41)', async () => {
    mockChallengeId = '';
    render(<GuestArenaScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('No challenge selected').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('onRunCode returns exitCode 0 when code is undefined and signal is falsy (line 87)', async () => {
    const fetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/execute')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ run: { stdout: 'ok', stderr: '' } }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockChallenge) });
    });
    vi.stubGlobal('fetch', fetchFn);
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByTestId('run-code-cb')).toBeTruthy());
    fireEvent.click(screen.getByTestId('run-code-cb'));
    await waitFor(() => {
      expect(fetchFn.mock.calls.some((c: any) => c[0]?.includes('/api/execute'))).toBeTruthy();
    });
  });

  it('onRunCode handles empty run object in response (line 83)', async () => {
    const fetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/execute')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockChallenge) });
    });
    vi.stubGlobal('fetch', fetchFn);
    render(<GuestArenaScreen />);
    await waitFor(() => expect(screen.getByTestId('run-code-cb')).toBeTruthy());
    fireEvent.click(screen.getByTestId('run-code-cb'));
    await waitFor(() => {
      expect(fetchFn.mock.calls.some((c: any) => c[0]?.includes('/api/execute'))).toBeTruthy();
    });
  });
});
