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
vi.mock('@/shared/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    card: '#fff', background: '#fff', muted: '#f5f5f5',
  }),
}));
vi.mock('@/shared/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, xxl: 24, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif' },
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
      expect(screen.getByText('Alpha Model')).toBeTruthy();
    });
    expect(screen.getByText('Beta Model')).toBeTruthy();
    expect(screen.getByText('Gamma Model')).toBeTruthy();
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
      expect(screen.getByText('$$$')).toBeTruthy();
    });
    expect(screen.getByText('$')).toBeTruthy();
    expect(screen.getByText('$$$$$')).toBeTruthy();
  });

  it('shows stats (uses, msgs) on model cards', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText('800')).toBeTruthy();
  });

  it('filters by tier when filter chip is clicked', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Alpha Model')).toBeTruthy();
    });
    // Click the Budget filter chip
    const budgetChips = screen.getAllByText('Budget');
    // First one is the filter chip, others may be tier badges
    fireEvent.click(budgetChips[0]);
    await waitFor(() => {
      expect(screen.getByText('Beta Model')).toBeTruthy();
    });
    expect(screen.queryByText('Alpha Model')).toBeNull();
    expect(screen.queryByText('Gamma Model')).toBeNull();
  });

  it('shows all models when All filter is clicked after filtering', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Alpha Model')).toBeTruthy();
    });
    // Filter by budget
    fireEvent.click(screen.getAllByText('Budget')[0]);
    await waitFor(() => {
      expect(screen.queryByText('Alpha Model')).toBeNull();
    });
    // Click All to reset
    fireEvent.click(screen.getByText('All'));
    await waitFor(() => {
      expect(screen.getByText('Alpha Model')).toBeTruthy();
    });
    expect(screen.getByText('Beta Model')).toBeTruthy();
    expect(screen.getByText('Gamma Model')).toBeTruthy();
  });

  it('navigates to model detail on card click', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Alpha Model')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('model-card-Alpha Model'));
    expect(mockNavigate).toHaveBeenCalledWith('ModelDetail', { modelId: 'model-a' });
  });

  it('shows empty state when no models match filter', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Alpha Model')).toBeTruthy();
    });
    // Filter by micro - none of the mock models are micro tier
    fireEvent.click(screen.getByText('Micro'));
    await waitFor(() => {
      expect(screen.getByText('No models found.')).toBeTruthy();
    });
  });

  it('shows empty state when fetch returns empty array', async () => {
    setupFetch([]);
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('No models found.')).toBeTruthy();
    });
  });

  it('handles fetch error gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('No models found.')).toBeTruthy();
    });
  });

  it('handles non-ok response gracefully', async () => {
    setupFetch([], false);
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('No models found.')).toBeTruthy();
    });
  });

  it('renders page title and subtitle', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('AI Models')).toBeTruthy();
    });
    expect(screen.getByText('Browse the models powering ruwt.dev challenges')).toBeTruthy();
  });

  it('renders all tier filter chips', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('All')).toBeTruthy();
    });
    expect(screen.getAllByText('Reasoning').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Premium').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Mid').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Budget').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Micro')).toBeTruthy();
  });

  it('renders model descriptions', async () => {
    setupFetch();
    render(<ModelsScreen />);
    await waitFor(() => {
      expect(screen.getByText('A premium model')).toBeTruthy();
    });
    expect(screen.getByText('A budget model')).toBeTruthy();
    expect(screen.getByText('A reasoning model')).toBeTruthy();
  });
});
