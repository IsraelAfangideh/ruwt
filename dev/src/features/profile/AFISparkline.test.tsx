// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const { AFISparkline } = await import('./AFISparkline');

describe('AFISparkline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when fewer than 2 data points', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ history: [{ score: 100, tier: 'novice', date: '2026-01-01' }] }),
    }));

    const { container } = render(
      <AFISparkline username="alice" currentTier="novice" />
    );

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    // With only 1 point, returns null
    expect(container.innerHTML).toBe('');
  });

  it('renders sparkline with SVG path when 2+ data points', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        history: [
          { score: 200, tier: 'developing', date: '2026-01-01' },
          { score: 300, tier: 'developing', date: '2026-01-02' },
          { score: 400, tier: 'proficient', date: '2026-01-03' },
        ],
      }),
    }));

    const { container } = render(
      <AFISparkline username="alice" currentTier="proficient" width={200} height={48} />
    );

    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '200');
    expect(svg).toHaveAttribute('height', '48');

    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('d')).toContain('M');
    expect(path!.getAttribute('d')).toContain('L');

    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();

    // Positive trend: +200 pts
    expect(screen.getByText('+200 pts')).toBeInTheDocument();
  });

  it('renders negative trend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        history: [
          { score: 500, tier: 'proficient', date: '2026-01-01' },
          { score: 400, tier: 'proficient', date: '2026-01-02' },
        ],
      }),
    }));

    render(
      <AFISparkline username="bob" currentTier="proficient" />
    );

    await waitFor(() => {
      expect(screen.getByText('-100 pts')).toBeInTheDocument();
    });
  });

  it('handles zero trend (flat line)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        history: [
          { score: 300, tier: 'developing', date: '2026-01-01' },
          { score: 300, tier: 'developing', date: '2026-01-02' },
        ],
      }),
    }));

    render(
      <AFISparkline username="carol" currentTier="developing" />
    );

    await waitFor(() => {
      expect(screen.getByText('+0 pts')).toBeInTheDocument();
    });
  });

  it('renders null when fetch fails silently', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const { container } = render(
      <AFISparkline username="dave" currentTier="novice" />
    );

    // Wait for the fetch to be called
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    // Should render nothing (empty points means null)
    expect(container.innerHTML).toBe('');
  });

  it('renders null when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Not found' }),
    }));

    const { container } = render(
      <AFISparkline username="eve" currentTier="novice" />
    );

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    expect(container.innerHTML).toBe('');
  });

  it('handles missing history array in response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }));

    const { container } = render(
      <AFISparkline username="frank" currentTier="novice" />
    );

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    expect(container.innerHTML).toBe('');
  });

  it('uses custom width and height props', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        history: [
          { score: 200, tier: 'developing', date: '2026-01-01' },
          { score: 300, tier: 'developing', date: '2026-01-02' },
        ],
      }),
    }));

    const { container } = render(
      <AFISparkline username="grace" currentTier="developing" width={300} height={60} />
    );

    await waitFor(() => {
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg!.getAttribute('width')).toBe('300');
      expect(svg!.getAttribute('height')).toBe('60');
    });
  });
});
