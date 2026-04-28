// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

let routeParams: Record<string, unknown> = {};
vi.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: routeParams }),
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/shared/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/shared/ui/ScreenSkeletons', () => ({
  DetailCardSkeleton: () => <div data-testid="skeleton" />,
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const { ScorecardScreen } = await import('./ScorecardScreen');

const ok = (data: any) => ({ ok: true, status: 200, json: () => Promise.resolve(data) });
const fail = (status: number) => ({ ok: false, status, json: () => Promise.resolve({}) });

const sampleScorecard = {
  candidateRef: 'Candidate #ABCD',
  assessmentTitle: 'Senior Engineer Screen',
  completedAt: '2026-04-15T12:00:00Z',
  passRate: 0.8,
  challengesPassed: 4,
  totalChallenges: 5,
  totalCostCents: 12345,
  totalTokens: 999,
  rating: { tier: 'strong', label: 'Strong', summary: 'Passed efficiently.' },
  flags: [
    { type: 'positive', label: 'Efficient solver', detail: 'Concise prompts.' },
    { type: 'caution', label: 'Over-spec model usage', detail: 'Reasoning model on trivial.' },
  ],
  challenges: [
    { title: 'FizzBuzz', difficulty: 'easy', category: 'prompt_efficiency', status: 'passed', passedTests: 3, totalTests: 3, costCents: 100, modelsUsed: ['haiku'] },
    { title: 'Memory Leak Hunt', difficulty: 'hard', category: 'real_world', status: 'failed', passedTests: 1, totalTests: 4, costCents: 8000, modelsUsed: ['sonnet', 'haiku'] },
  ],
};

describe('ScorecardScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeParams = { token: 'tok-1' };
  });

  it('renders skeleton while loading', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<ScorecardScreen />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('renders error when token is missing', async () => {
    routeParams = {};
    vi.stubGlobal('fetch', vi.fn());
    render(<ScorecardScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('scorecard-error')).toBeInTheDocument();
    });
    expect(screen.getByText(/Invalid scorecard link/)).toBeInTheDocument();
    // Critical: no fetch issued without a token
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('renders 404 message when API returns 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(404)));
    render(<ScorecardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Scorecard not found')).toBeInTheDocument();
    });
  });

  it('renders the rating, metrics, flags, and per-challenge breakdown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(sampleScorecard)));
    render(<ScorecardScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('scorecard-screen')).toBeInTheDocument();
    });
    expect(screen.getByTestId('scorecard-tier').textContent).toBe('Strong');
    expect(screen.getByTestId('scorecard-pass-rate').textContent).toBe('80%');
    expect(screen.getByText('Candidate #ABCD')).toBeInTheDocument();
    expect(screen.getByText('Senior Engineer Screen')).toBeInTheDocument();
    expect(screen.getByText('Efficient solver')).toBeInTheDocument();
    expect(screen.getByText('Over-spec model usage')).toBeInTheDocument();
    expect(screen.getByTestId('scorecard-flag-positive')).toBeInTheDocument();
    expect(screen.getByTestId('scorecard-flag-caution')).toBeInTheDocument();
    expect(screen.getByText('FizzBuzz')).toBeInTheDocument();
    expect(screen.getByText('Memory Leak Hunt')).toBeInTheDocument();
    // Models list rendered
    expect(screen.getByText(/Models:.*sonnet/)).toBeInTheDocument();
  });

  it('does not include candidate PII in the rendered DOM', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(sampleScorecard)));
    const { container } = render(<ScorecardScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('scorecard-screen')).toBeInTheDocument();
    });
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain('@'); // no email shapes
    expect(html).not.toMatch(/avatarurl/i);
  });

  it('renders the verified-by-Ruwt trust mark', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(sampleScorecard)));
    render(<ScorecardScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Verified by Ruwt/)).toBeInTheDocument();
    });
  });

  it('renders error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    render(<ScorecardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load scorecard')).toBeInTheDocument();
    });
  });

  it('omits the flags section when there are none', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ ...sampleScorecard, flags: [] })));
    render(<ScorecardScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('scorecard-screen')).toBeInTheDocument();
    });
    expect(screen.queryByText('Behavioral signals')).not.toBeInTheDocument();
  });
});
