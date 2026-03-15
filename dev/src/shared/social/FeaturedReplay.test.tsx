// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FeaturedReplay } from './FeaturedReplay';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

vi.mock('@/shared/lib/ai/pricing', () => ({
  getModelById: (id: string) => id === 'test-model' ? { displayName: 'TestModel', tier: 'budget' } : undefined,
  tierColor: () => '#5a8a5a',
  tierLabel: () => 'Budget',
  formatCostFromHundredths: (v: number) => `$${(v / 10000).toFixed(4)}`,
}));

describe('FeaturedReplay', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders fallback content when API fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('fail'));

    render(<FeaturedReplay />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    expect(screen.getByText('EXAMPLE STRATEGY')).toBeInTheDocument();
    expect(screen.getByText(/How a Top Solver Spent/)).toBeInTheDocument();
  });

  it('renders live data when API returns messages', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        solver: { name: 'Alice' },
        stats: { messageCount: 3, modelsUsed: ['test-model'], totalCost: 500 },
        messages: [
          { role: 'user', content: 'Implement debounce', model: null, cost: 0 },
          { role: 'assistant', content: 'Here is the code', model: 'test-model', cost: 500, inputTokens: 50, outputTokens: 100 },
        ],
      }),
    } as Response);

    render(<FeaturedReplay />);
    await waitFor(() => expect(screen.getByText('REAL STRATEGY')).toBeInTheDocument());
  });

  it('renders USER and AI role pills', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('fail'));

    render(<FeaturedReplay />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    expect(screen.getByText('USER')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('renders insight text', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('fail'));

    render(<FeaturedReplay />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    expect(screen.getByText(/Key insight/)).toBeInTheDocument();
  });
});
