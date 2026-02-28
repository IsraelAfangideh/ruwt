// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FeaturedReplay } from './FeaturedReplay';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/theme', () => ({
  useColors: () => ({
    text: '#000', textMuted: '#888', accent: '#c9a962', success: '#5a8a5a',
    card: '#fff', border: '#ccc', borderStrong: '#aaa', muted: '#ddd',
    cardForeground: '#000', mutedForeground: '#555',
  }),
}));

vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18 },
  fontFamily: { body: 'sans-serif' },
  radii: { xl: 16 },
}));

vi.mock('@/lib/ai/pricing', () => ({
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

    expect(screen.getByText('EXAMPLE STRATEGY')).toBeTruthy();
    expect(screen.getByText(/How a Top Solver Spent/)).toBeTruthy();
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
    await waitFor(() => expect(screen.getByText('REAL STRATEGY')).toBeTruthy());
  });

  it('renders USER and AI role pills', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('fail'));

    render(<FeaturedReplay />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    expect(screen.getByText('USER')).toBeTruthy();
    expect(screen.getByText('AI')).toBeTruthy();
  });

  it('renders insight text', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('fail'));

    render(<FeaturedReplay />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    expect(screen.getByText(/Key insight/)).toBeTruthy();
  });
});
