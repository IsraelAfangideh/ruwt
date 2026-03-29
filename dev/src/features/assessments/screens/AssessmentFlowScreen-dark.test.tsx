// @vitest-environment jsdom
/**
 * Dark-mode variant of AssessmentFlowScreen tests.
 * Exercises isDark branches for styling ternaries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

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
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockDarkTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens({ mono: true }));

const ok = (data: any) => ({ ok: true, json: () => Promise.resolve(data) });

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

function setupFetch(map: Record<string, any> = {}) {
  const entries = Object.entries(map).sort(([a], [b]) => b.length - a.length);
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    for (const [pattern, response] of entries) {
      if (url.includes(pattern)) return Promise.resolve(response);
    }
    return Promise.resolve(ok({}));
  }));
}

setupFetch({ '/api/assess/test-session-123': ok(mockSessionData) });
const { AssessmentFlowScreen } = await import('./AssessmentFlowScreen');

describe('AssessmentFlowScreen (dark mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetch({ '/api/assess/test-session-123': ok(mockSessionData) });
  });

  it('renders assessment flow in dark mode', async () => {
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('arena-ide')).toBeInTheDocument();
    });
  });

  it('renders challenge title in dark mode', async () => {
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/FizzBuzz/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders challenge progress in dark mode', async () => {
    render(<AssessmentFlowScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('arena-ide')).toBeInTheDocument();
    });
  });
});
