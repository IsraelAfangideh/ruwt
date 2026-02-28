// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ActivityFeed } from './ActivityFeed';

vi.mock('@/theme', () => ({
  useColors: () => ({
    text: '#000',
    textMuted: '#888',
    accent: '#c9a962',
    border: '#ccc',
  }),
}));

vi.mock('@/lib/ai/pricing', () => ({
  formatCostFromHundredths: (v: number) => `$${(v / 10000).toFixed(4)}`,
}));

describe('ActivityFeed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when API returns empty activities', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ activities: [], uniqueUsers: 0 }),
    } as Response);

    const { container } = render(<ActivityFeed />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('returns null when uniqueUsers is below threshold (< 3)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        activities: [{ user: 'alice', avatarUrl: null, challenge: 'Test', cost: 100, timestamp: null }],
        uniqueUsers: 2,
      }),
    } as Response);

    const { container } = render(<ActivityFeed />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('renders activity items when there are enough users', async () => {
    const now = new Date().toISOString();
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        activities: [
          { user: 'alice', avatarUrl: null, challenge: 'Debounce', cost: 500, timestamp: now },
          { user: 'bob', avatarUrl: null, challenge: 'Cache', cost: 300, timestamp: null },
        ],
        uniqueUsers: 5,
      }),
    } as Response);

    render(<ActivityFeed />);
    await waitFor(() => expect(screen.getByText('alice')).toBeTruthy());
    expect(screen.getByText('Debounce')).toBeTruthy();
    expect(screen.getByText('bob')).toBeTruthy();
    expect(screen.getByText('Cache')).toBeTruthy();
  });

  it('uses custom heading when provided', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        activities: [{ user: 'carol', avatarUrl: null, challenge: 'X', cost: 0, timestamp: null }],
        uniqueUsers: 10,
      }),
    } as Response);

    render(<ActivityFeed heading="Live Feed" />);
    await waitFor(() => expect(screen.getByText('Live Feed')).toBeTruthy());
  });

  it('uses default heading "Recent Solves" when no heading provided', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        activities: [{ user: 'eve', avatarUrl: null, challenge: 'Y', cost: 0, timestamp: null }],
        uniqueUsers: 5,
      }),
    } as Response);

    render(<ActivityFeed />);
    await waitFor(() => expect(screen.getByText('Recent Solves')).toBeTruthy());
  });

  it('calls fetch with limit parameter', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ activities: [], uniqueUsers: 0 }),
    } as Response);

    render(<ActivityFeed limit={5} />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/activity?limit=5'));
  });

  it('handles fetch failure gracefully (renders nothing)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    const { container } = render(<ActivityFeed />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    // Should render nothing on error (activities stays empty)
    expect(container.innerHTML).toBe('');
  });

  it('shows "Xm ago" for timestamps a few minutes old', async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        activities: [
          { user: 'alice', avatarUrl: null, challenge: 'Test', cost: 100, timestamp: fiveMinutesAgo },
        ],
        uniqueUsers: 5,
      }),
    } as Response);

    render(<ActivityFeed />);
    await waitFor(() => expect(screen.getByText('5m ago')).toBeTruthy());
  });

  it('shows "Xh ago" for timestamps a few hours old', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        activities: [
          { user: 'bob', avatarUrl: null, challenge: 'Test', cost: 100, timestamp: threeHoursAgo },
        ],
        uniqueUsers: 5,
      }),
    } as Response);

    render(<ActivityFeed />);
    await waitFor(() => expect(screen.getByText('3h ago')).toBeTruthy());
  });

  it('shows "Xd ago" for timestamps days old', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        activities: [
          { user: 'carol', avatarUrl: null, challenge: 'Test', cost: 100, timestamp: twoDaysAgo },
        ],
        uniqueUsers: 5,
      }),
    } as Response);

    render(<ActivityFeed />);
    await waitFor(() => expect(screen.getByText('2d ago')).toBeTruthy());
  });
});
