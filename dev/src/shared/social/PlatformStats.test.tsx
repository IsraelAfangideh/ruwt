// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PlatformStats } from './PlatformStats';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/shared/theme', () => ({
  useColors: () => ({
    accent: '#c9a962',
    textMuted: '#888',
    card: '#fff',
    border: '#ccc',
    borderStrong: '#aaa',
  }),
}));

vi.mock('@/shared/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  fontSizes: { xs: 12, sm: 14, md: 16, '2xl': 24 },
  fontFamily: { body: 'sans-serif' },
  radii: { xl: 16 },
}));

vi.mock('@/shared/lib/ai/pricing', () => ({
  formatCostFromHundredths: (v: number) => `$${(v / 10000).toFixed(2)}`,
}));

describe('PlatformStats', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when stats have not loaded', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => null,
    } as Response);

    const { container } = render(<PlatformStats />);
    // Initially null render
    expect(container.innerHTML).toBe('');
  });

  it('renders three stat cards when API returns data', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        users: 50,
        challenges: 60,
        solves: 200,
        totalSpend: 5000,
        avgSolveCost: 1200,
      }),
    } as Response);

    render(<PlatformStats />);
    await waitFor(() => expect(screen.getByText('60+')).toBeTruthy());
    expect(screen.getByText('Challenges')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('Challenges Solved')).toBeTruthy();
    expect(screen.getByText('Avg Solve Cost')).toBeTruthy();
  });

  it('shows "Challenge Solved" (singular) when only 1 solve', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        users: 1,
        challenges: 10,
        solves: 1,
        totalSpend: 100,
        avgSolveCost: 100,
      }),
    } as Response);

    render(<PlatformStats />);
    await waitFor(() => expect(screen.getByText('Challenge Solved')).toBeTruthy());
  });

  it('shows "Free to try" when avgSolveCost is 0', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        users: 10,
        challenges: 5,
        solves: 10,
        totalSpend: 0,
        avgSolveCost: 0,
      }),
    } as Response);

    render(<PlatformStats />);
    await waitFor(() => expect(screen.getByText('Free to try')).toBeTruthy());
  });

  it('handles fetch failure gracefully', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('fail'));

    const { container } = render(<PlatformStats />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });
});
