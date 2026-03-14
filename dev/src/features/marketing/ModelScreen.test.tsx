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
vi.mock('@/shared/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    card: '#fff', background: '#fff', muted: '#f5f5f5',
  }),
}));
vi.mock('@/shared/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, xxl: 24, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif', mono: 'monospace' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));
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
      expect(screen.getByText('Alpha Model')).toBeTruthy();
    });
    expect(screen.getByText('A premium model for advanced tasks')).toBeTruthy();
    expect(screen.getByText('Premium')).toBeTruthy();
  });

  it('shows pricing info with input and output costs', async () => {
    setupFetch();
    render(<ModelScreen />);
    await waitFor(() => {
      expect(screen.getByText('Pricing')).toBeTruthy();
    });
    expect(screen.getByText('Input')).toBeTruthy();
    expect(screen.getByText('Output')).toBeTruthy();
    expect(screen.getByText('$3.00/M tokens')).toBeTruthy();
    expect(screen.getByText('$6.00/M tokens')).toBeTruthy();
  });

  it('shows stat cards with correct values', async () => {
    setupFetch();
    render(<ModelScreen />);
    await waitFor(() => {
      expect(screen.getByText('Times Used')).toBeTruthy();
    });
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('Total Messages')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('Avg Cost / Msg')).toBeTruthy();
    expect(screen.getByText('$0.05')).toBeTruthy();
    expect(screen.getByText('Win Rate')).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
  });

  it('formats very small average cost with 4 decimals', async () => {
    const data = {
      model: { ...mockModelData.model },
      stats: { ...mockModelData.stats, avgCostPerMessage: 50 },
    };
    setupFetch(data);
    render(<ModelScreen />);
    await waitFor(() => {
      expect(screen.getByText('$0.0050')).toBeTruthy();
    });
  });

  it('shows error state when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<ModelScreen />);
    await waitFor(() => {
      expect(screen.getByText('Model not found.')).toBeTruthy();
    });
  });

  it('shows error state for non-ok response', async () => {
    setupFetch(null, false);
    render(<ModelScreen />);
    await waitFor(() => {
      expect(screen.getByText('Model not found.')).toBeTruthy();
    });
  });

  it('shows model ID section', async () => {
    setupFetch();
    render(<ModelScreen />);
    await waitFor(() => {
      expect(screen.getByText('Model ID')).toBeTruthy();
    });
    expect(screen.getByText('model-a')).toBeTruthy();
  });

  it('shows Usage Stats section title', async () => {
    setupFetch();
    render(<ModelScreen />);
    await waitFor(() => {
      expect(screen.getByText('Usage Stats')).toBeTruthy();
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
