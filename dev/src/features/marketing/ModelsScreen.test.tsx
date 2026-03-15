// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
vi.mock('@/shared/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());
vi.mock('@/shared/lib/ai/pricing', () => ({
  tierColor: (tier: string) => {
    const map: Record<string, string> = { reasoning: '#a78bfa', premium: '#da8ee7', mid: '#f59e0b', budget: '#22c55e', micro: '#94a3b8' };
    return map[tier] || '#ccc';
  },
  tierLabel: (tier: string) => {
    const map: Record<string, string> = { reasoning: 'Reasoning', premium: 'Premium', mid: 'Mid', budget: 'Budget', micro: 'Micro' };
    return map[tier] || tier;
  },
}));

const mockModels = [
  { id: 'model-a', displayName: 'Alpha Model', tier: 'premium', description: 'A premium model', costIndicator: '$$$', input: 3.0, output: 6.0, stats: { timesUsed: 42, totalMessages: 200, avgCost: 500 } },
  { id: 'model-b', displayName: 'Beta Model', tier: 'budget', description: 'A budget model', costIndicator: '$', input: 0.1, output: 0.2, stats: { timesUsed: 100, totalMessages: 800, avgCost: 50 } },
  { id: 'model-c', displayName: 'Gamma Model', tier: 'reasoning', description: 'A reasoning model', costIndicator: '$$$$$', input: 0.5, output: 1.0, stats: { timesUsed: 10, totalMessages: 30, avgCost: 2000 } },
];

function setupFetch(models: any[] = mockModels, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(models),
  }));
}

const { ModelsScreen } = await import('./ModelsScreen');

describe('ModelsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    setupFetch();
    const { container } = render(<ModelsScreen />);
    expect(container.querySelector('[data-testid="skeleton-card-grid"]')).not.toBeNull();
  });

  it('renders models after fetch', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Alpha Model')).toBeInTheDocument();
    });
    expect(screen.getByText('Beta Model')).toBeInTheDocument();
    expect(screen.getByText('Gamma Model')).toBeInTheDocument();
  });

  it('shows tier badges on model cards', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      // Each tier text appears in both filter chips and card badges
      expect(screen.getAllByText('Premium').length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getAllByText('Budget').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Reasoning').length).toBeGreaterThanOrEqual(2);
  });

  it('shows cost indicator on model cards', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('$$$')).toBeInTheDocument();
    });
    expect(screen.getByText('$')).toBeInTheDocument();
    expect(screen.getByText('$$$$$')).toBeInTheDocument();
  });

  it('shows stats (uses, msgs) on model cards', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('800')).toBeInTheDocument();
  });

  it('filters by tier when filter chip is clicked', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Alpha Model')).toBeInTheDocument();
    });
    // Click the Budget filter chip
    const budgetChips = screen.getAllByText('Budget');
    // First one is the filter chip, others may be tier badges
    fireEvent.click(budgetChips[0]);
    await waitFor(() => {
      expect(screen.getByText('Beta Model')).toBeInTheDocument();
    });
    expect(screen.queryByText('Alpha Model')).toBeNull();
    expect(screen.queryByText('Gamma Model')).toBeNull();
  });

  it('shows all models when All filter is clicked after filtering', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Alpha Model')).toBeInTheDocument();
    });
    // Filter by budget
    fireEvent.click(screen.getAllByText('Budget')[0]);
    await waitFor(() => {
      expect(screen.queryByText('Alpha Model')).toBeNull();
    });
    // Click All to reset
    fireEvent.click(screen.getByText('All'));
    await waitFor(() => {
      expect(screen.getByText('Alpha Model')).toBeInTheDocument();
    });
    expect(screen.getByText('Beta Model')).toBeInTheDocument();
    expect(screen.getByText('Gamma Model')).toBeInTheDocument();
  });

  it('navigates to model detail on card click', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Alpha Model')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('model-card-Alpha Model'));
    expect(mockNavigate).toHaveBeenCalledWith('ModelDetail', { modelId: 'model-a' });
  });

  it('shows empty state when no models match filter', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Alpha Model')).toBeInTheDocument();
    });
    // Filter by micro - none of the mock models are micro tier
    fireEvent.click(screen.getByText('Micro'));
    await waitFor(() => {
      expect(screen.getByText('No models found.')).toBeInTheDocument();
    });
  });

  it('shows empty state when fetch returns empty array', async () => {
    setupFetch([]);
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('No models found.')).toBeInTheDocument();
    });
  });

  it('handles fetch error gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('No models found.')).toBeInTheDocument();
    });
  });

  it('handles non-ok response gracefully', async () => {
    setupFetch([], false);
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('No models found.')).toBeInTheDocument();
    });
  });

  it('renders page title and subtitle', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('AI Models')).toBeInTheDocument();
    });
    expect(screen.getByText('Browse the models powering ruwt.dev challenges')).toBeInTheDocument();
  });

  it('renders all tier filter chips', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Reasoning').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Premium').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Mid').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Budget').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Micro')).toBeInTheDocument();
  });

  it('renders model descriptions', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('A premium model')).toBeInTheDocument();
    });
    expect(screen.getByText('A budget model')).toBeInTheDocument();
    expect(screen.getByText('A reasoning model')).toBeInTheDocument();
  });
});
