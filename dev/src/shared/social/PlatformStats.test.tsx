// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PlatformStats } from './PlatformStats';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

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
    await waitFor(() => expect(screen.getByText('60+')).toBeInTheDocument());
    expect(screen.getByText('Challenges')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('Challenges Solved')).toBeInTheDocument();
    expect(screen.getByText('Avg Solve Cost')).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText('Challenge Solved')).toBeInTheDocument());
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
    await waitFor(() => expect(screen.getByText('Free to try')).toBeInTheDocument());
  });

  it('handles fetch failure gracefully', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('fail'));

    const { container } = render(<PlatformStats />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });
});
