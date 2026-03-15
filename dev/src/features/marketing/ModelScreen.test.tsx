// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { mockRouteParams } = vi.hoisted(() => ({
  mockRouteParams: { modelId: 'model-a' },
}));

vi.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}));
vi.mock('@/shared/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens({ mono: true }));
vi.mock('@/shared/lib/ai/pricing', () => ({
  tierColor: (tier: string) => {
    const map: Record<string, string> = { reasoning: '#a78bfa', premium: '#da8ee7', mid: '#f59e0b', budget: '#22c55e', micro: '#94a3b8' };
    return map[tier] || '#ccc';
  },
  tierLabel: (tier: string) => {
    const map: Record<string, string> = { reasoning: 'Reasoning', premium: 'Premium', mid: 'Mid', budget: 'Budget', micro: 'Micro' };
    return map[tier] || tier;
  },
  formatCostFromHundredths: (h: number) => { const d = h / 10000; return d < 0.01 ? `$${d.toFixed(4)}` : `$${d.toFixed(2)}`; },
}));

const mockModelData = {
  model: {
    id: 'model-a',
    displayName: 'Alpha Model',
    tier: 'premium' as const,
    description: 'A premium model for advanced tasks',
    input: 3.0,
    output: 6.0,
  },
  stats: {
    timesUsed: 42,
    totalMessages: 200,
    avgCostPerMessage: 500,
    winRate: 75,
  },
};

function setupFetch(data: any = mockModelData, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  }));
}

const { ModelScreen } = await import('./ModelScreen');

describe('ModelScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouteParams.modelId = 'model-a';
  });

  it('renders loading state initially', () => {
    setupFetch();
    const { container } = render(<ModelScreen />);
    expect(container.querySelector('[data-testid="skeleton-detail"]')).not.toBeNull();
  });

  it('renders model detail after fetch', async () => {
    setupFetch();
    render(<ModelScreen />);
    await waitFor(() => {
      expect(screen.getByText('Alpha Model')).toBeInTheDocument();
    });
    expect(screen.getByText('A premium model for advanced tasks')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
  });

  it('shows pricing info with input and output costs', async () => {
    setupFetch();
    render(<ModelScreen />);
    await waitFor(() => {
      expect(screen.getByText('Pricing')).toBeInTheDocument();
    });
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText('$3.00/M tokens')).toBeInTheDocument();
    expect(screen.getByText('$6.00/M tokens')).toBeInTheDocument();
  });

  it('shows stat cards with correct values', async () => {
    setupFetch();
    render(<ModelScreen />);
    await waitFor(() => {
      expect(screen.getByText('Times Used')).toBeInTheDocument();
    });
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Total Messages')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('Avg Cost / Msg')).toBeInTheDocument();
    expect(screen.getByText('$0.05')).toBeInTheDocument();
    expect(screen.getByText('Win Rate')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('formats very small average cost with 4 decimals', async () => {
    const data = {
      model: { ...mockModelData.model },
      stats: { ...mockModelData.stats, avgCostPerMessage: 50 },
    };
    setupFetch(data);
    render(<ModelScreen />);
    await waitFor(() => {
      expect(screen.getByText('$0.0050')).toBeInTheDocument();
    });
  });

  it('shows error state when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<ModelScreen />);
    await waitFor(() => {
      expect(screen.getByText('Model not found.')).toBeInTheDocument();
    });
  });

  it('shows error state for non-ok response', async () => {
    setupFetch(null, false);
    render(<ModelScreen />);
    await waitFor(() => {
      expect(screen.getByText('Model not found.')).toBeInTheDocument();
    });
  });

  it('shows model ID section', async () => {
    setupFetch();
    render(<ModelScreen />);
    await waitFor(() => {
      expect(screen.getByText('Model ID')).toBeInTheDocument();
    });
    expect(screen.getByText('model-a')).toBeInTheDocument();
  });

  it('shows Usage Stats section title', async () => {
    setupFetch();
    render(<ModelScreen />);
    await waitFor(() => {
      expect(screen.getByText('Usage Stats')).toBeInTheDocument();
    });
  });

  it('does not fetch when modelId is empty', async () => {
    mockRouteParams.modelId = '';
    setupFetch();
    render(<ModelScreen />);
    // Give it time to potentially fetch
    await new Promise((r) => setTimeout(r, 50));
    // Should still be loading since useEffect returns early when modelId is empty
    // Actually loading remains true, but the loading UI renders
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
