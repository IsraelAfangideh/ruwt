// @vitest-environment jsdom
/**
 * Dark-mode variant of ReplayScreen tests.
 * Exercises isDark branches for styling ternaries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { attemptId: 'test-attempt-123' } }),
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/hooks/useWindowWidth', () => ({ useIsDesktop: () => false, useWindowWidth: () => 400 }));
vi.mock('@/features/shared-ide/lib/monaco-init', () => ({}));
vi.mock('@/shared/lib/ai/pricing', () => ({
  getModelById: (id: string) => id ? ({ name: 'Test Model', displayName: 'Test Model', tier: 'free' }) : undefined,
  tierColor: () => '#ccc',
  formatCostFromHundredths: (c: number) => `$${(c / 10000).toFixed(4)}`,
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockDarkTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens({ mono: true }));

const mockReplayData = {
  attempt: { id: 'test-attempt-123', status: 'passed', totalCost: 5000, inputTokens: 1000, outputTokens: 500, submittedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z' },
  challenge: { title: 'FizzBuzz Budget', difficulty: 'medium', category: 'prompt_efficiency' },
  solver: { name: 'TestUser', avatarUrl: null },
  messages: [
    { role: 'user', content: 'Help me solve this', model: undefined, createdAt: '2026-01-01T00:00:00Z' },
    { role: 'assistant', content: 'Here is the solution', model: 'llama-3.3-70b', inputTokens: 100, outputTokens: 50, cost: 500, createdAt: '2026-01-01T00:00:01Z' },
  ],
  stats: { messageCount: 2, modelsUsed: ['llama-3.3-70b'], totalCost: 5000 },
};

describe('ReplayScreen (dark mode + mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/replay/test-attempt-123');
  });

  it('renders loading state initially', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const { ReplayScreen } = await import('./ReplayScreen');
    const { container } = render(<ReplayScreen />);
    expect(container.querySelector('[data-testid="skeleton-split-pane"]')).toBeInTheDocument();
  });

  it('renders replay data in dark mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReplayData),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/FizzBuzz Budget/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders error when replay not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Not found' }),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getByText(/not found|error/i)).toBeInTheDocument();
    });
  });

  it('renders with failed attempt status in dark mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...mockReplayData,
        attempt: { ...mockReplayData.attempt, status: 'failed' },
      }),
    }));
    const { ReplayScreen } = await import('./ReplayScreen');
    render(<ReplayScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/FizzBuzz Budget/).length).toBeGreaterThanOrEqual(1);
    });
  });
});
