// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { shareToken: 'test-share-token' } }),
}));
vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/shared/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/profile/AIProfileRadar', () => ({
  AIProfileRadar: () => <div data-testid="ai-radar" />,
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const ok = (data: any) => ({ ok: true, json: () => Promise.resolve(data) });
const fail = () => ({ ok: false, json: () => Promise.resolve({}) });

const mockResultsData = {
  assessment: { title: 'Frontend Assessment', description: 'Eval AI skills', companyName: 'TestCorp', companyLogoUrl: null },
  candidate: { name: 'TestUser', avatarUrl: null },
  session: { status: 'completed', totalCost: 5000, totalTokens: 1500, startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:30:00Z' },
  summary: { challengesPassed: 4, totalChallenges: 5, totalCost: 5000, totalTokens: 1500 },
  challengeResults: [],
};

const mockChallengeResult = {
  challenge: { id: 'c1', title: 'FizzBuzz Pro', difficulty: 'easy', category: 'prompt_efficiency', skillTested: 'prompting' },
  status: 'passed',
  cost: 2500,
  inputTokens: 800,
  outputTokens: 500,
  passedTests: 3,
  totalTests: 3,
  modelUsage: {
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast': { calls: 2, cost: 2000, tokens: 1000 },
    '@cf/meta/llama-3.1-8b-instruct-fast': { calls: 1, cost: 500, tokens: 300 },
  },
};

vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(mockResultsData)));

const { AssessmentResultsScreen } = await import('./AssessmentResultsScreen');

describe('AssessmentResultsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(mockResultsData)));
  });

  it('renders loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const { container } = render(<AssessmentResultsScreen />);
    expect(container.querySelector('[data-testid="skeleton-detail"]')).not.toBeNull();
  });

  it('renders results data after loading', async () => {
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Frontend Assessment/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders error when results not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail()));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Results not found').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders candidate name and summary', async () => {
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/TestUser/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders "Assessment Results" title', async () => {
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Assessment Results')).toBeInTheDocument();
    });
  });

  it('shows company name when companyName is set and no logo', async () => {
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('TestCorp')).toBeInTheDocument();
    });
  });

  it('shows Ruwt logo when no company branding', async () => {
    const noCompanyData = {
      ...mockResultsData,
      assessment: { ...mockResultsData.assessment, companyName: null, companyLogoUrl: null },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(noCompanyData)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Ruwt')).toBeInTheDocument();
    });
  });

  it('renders company logo when companyLogoUrl is set', async () => {
    const withLogoData = {
      ...mockResultsData,
      assessment: { ...mockResultsData.assessment, companyLogoUrl: 'https://example.com/logo.png' },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withLogoData)));
    const { container } = render(<AssessmentResultsScreen />);
    await waitFor(() => {
      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toBe('https://example.com/logo.png');
    });
  });

  it('renders summary cards: challenges passed, cost, tokens', async () => {
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('4/5')).toBeInTheDocument();
      expect(screen.getByText('Challenges Passed')).toBeInTheDocument();
      expect(screen.getByText('Total AI Cost')).toBeInTheDocument();
      expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    });
  });

  it('formats cost correctly for small amounts', async () => {
    const smallCostData = {
      ...mockResultsData,
      summary: { ...mockResultsData.summary, totalCost: 50 },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(smallCostData)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      // 50 / 10000 = 0.005 which is < 0.01 so uses 4 decimal places
      expect(screen.getByText('$0.0050')).toBeInTheDocument();
    });
  });

  it('formats cost correctly for larger amounts', async () => {
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      // 5000 / 10000 = 0.50 which is >= 0.01 so uses 2 decimal places
      expect(screen.getByText('$0.50')).toBeInTheDocument();
    });
  });

  it('renders token count formatted with commas', async () => {
    const bigTokenData = {
      ...mockResultsData,
      summary: { ...mockResultsData.summary, totalTokens: 12345 },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(bigTokenData)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('12,345')).toBeInTheDocument();
    });
  });

  it('shows "Candidate" when candidate name is null', async () => {
    const nullNameData = {
      ...mockResultsData,
      candidate: { name: null, avatarUrl: null },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(nullNameData)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Candidate')).toBeInTheDocument();
    });
  });

  it('renders Challenge Breakdown heading', async () => {
    const withChallenge = {
      ...mockResultsData,
      challengeResults: [mockChallengeResult],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withChallenge)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Challenge Breakdown')).toBeInTheDocument();
    });
  });

  it('renders challenge title and difficulty', async () => {
    const withChallenge = {
      ...mockResultsData,
      challengeResults: [mockChallengeResult],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withChallenge)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('FizzBuzz Pro')).toBeInTheDocument();
      expect(screen.getByText('easy')).toBeInTheDocument();
    });
  });

  it('renders category label for prompt_efficiency', async () => {
    const withChallenge = {
      ...mockResultsData,
      challengeResults: [mockChallengeResult],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withChallenge)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Prompt Efficiency')).toBeInTheDocument();
    });
  });

  it('renders category label for model_selection', async () => {
    const withChallenge = {
      ...mockResultsData,
      challengeResults: [{ ...mockChallengeResult, challenge: { ...mockChallengeResult.challenge, category: 'model_selection' } }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withChallenge)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Model Selection')).toBeInTheDocument();
    });
  });

  it('renders category label for iterative_debugging', async () => {
    const withChallenge = {
      ...mockResultsData,
      challengeResults: [{ ...mockChallengeResult, challenge: { ...mockChallengeResult.challenge, category: 'iterative_debugging' } }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withChallenge)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Iterative Debugging')).toBeInTheDocument();
    });
  });

  it('renders "Practice" for unknown category', async () => {
    const withChallenge = {
      ...mockResultsData,
      challengeResults: [{ ...mockChallengeResult, challenge: { ...mockChallengeResult.challenge, category: null } }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withChallenge)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Practice')).toBeInTheDocument();
    });
  });

  it('renders PASSED status badge for passed challenge', async () => {
    const withChallenge = {
      ...mockResultsData,
      challengeResults: [mockChallengeResult],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withChallenge)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('PASSED')).toBeInTheDocument();
    });
  });

  it('renders FAILED status badge for failed challenge', async () => {
    const withChallenge = {
      ...mockResultsData,
      challengeResults: [{ ...mockChallengeResult, status: 'failed' }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withChallenge)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('FAILED')).toBeInTheDocument();
    });
  });

  it('renders uppercased status for non-passed/failed statuses', async () => {
    const withChallenge = {
      ...mockResultsData,
      challengeResults: [{ ...mockChallengeResult, status: 'skipped' }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withChallenge)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('SKIPPED')).toBeInTheDocument();
    });
  });

  it('renders per-challenge test stats', async () => {
    const withChallenge = {
      ...mockResultsData,
      challengeResults: [mockChallengeResult],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withChallenge)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('3/3')).toBeInTheDocument();
      expect(screen.getByText('Tests')).toBeInTheDocument();
      expect(screen.getByText('Cost')).toBeInTheDocument();
      expect(screen.getByText('Tokens')).toBeInTheDocument();
    });
  });

  it('renders model usage section for challenge with models', async () => {
    const withChallenge = {
      ...mockResultsData,
      challengeResults: [mockChallengeResult],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withChallenge)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Models Used:')).toBeInTheDocument();
      // Model names get stripped of @cf/meta/ prefix
      expect(screen.getByText(/llama-3.3-70b/)).toBeInTheDocument();
      expect(screen.getByText(/llama-3.1-8b/)).toBeInTheDocument();
    });
  });

  it('renders AI Profile section when challenge results exist', async () => {
    const withChallenge = {
      ...mockResultsData,
      challengeResults: [mockChallengeResult],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withChallenge)));
    const { container } = render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('AI Fluency Profile')).toBeInTheDocument();
      expect(container.querySelector('[data-testid="ai-radar"]')).not.toBeNull();
    });
  });

  it('shows "Powered by Ruwt" footer when company name exists', async () => {
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Powered by Ruwt/)).toBeInTheDocument();
    });
  });

  it('shows plain "Ruwt" footer when no company name', async () => {
    const noCompanyData = {
      ...mockResultsData,
      assessment: { ...mockResultsData.assessment, companyName: null },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(noCompanyData)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/AI-Efficiency Assessment/)).toBeInTheDocument();
    });
  });

  it('renders error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('renders generic error on non-Error exception', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('string error'));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load results')).toBeInTheDocument();
    });
  });

  it('renders "No data" when data is null after loading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(null) }));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      expect(screen.getByText('No data')).toBeInTheDocument();
    });
  });

  it('renders model usage call counts with correct pluralization', async () => {
    const singleCallResult = {
      ...mockChallengeResult,
      modelUsage: {
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast': { calls: 1, cost: 2000, tokens: 1000 },
      },
    };
    const withChallenge = {
      ...mockResultsData,
      challengeResults: [singleCallResult],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withChallenge)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      // "1 call" (singular) vs "2 calls" (plural)
      expect(screen.getByText(/1 call \u00B7/)).toBeInTheDocument();
    });
  });

  it('classifies unrecognized model names as micro tier', async () => {
    const microTierResult = {
      ...mockChallengeResult,
      modelUsage: {
        '@cf/qwen/qwen1.5-0.5b-chat': { calls: 1, cost: 100, tokens: 200 },
      },
    };
    const withMicroTier = {
      ...mockResultsData,
      challengeResults: [microTierResult],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withMicroTier)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      // The micro tier model should appear in model usage section
      expect(screen.getByText(/qwen1.5-0.5b/)).toBeInTheDocument();
    });
  });

  it('renders total token count in per-challenge stats', async () => {
    const withChallenge = {
      ...mockResultsData,
      challengeResults: [mockChallengeResult],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(withChallenge)));
    render(<AssessmentResultsScreen />);
    await waitFor(() => {
      // inputTokens (800) + outputTokens (500) = 1300 → 1,300
      expect(screen.getByText('1,300')).toBeInTheDocument();
    });
  });
});
