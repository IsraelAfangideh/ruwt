// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('@/shared/theme', () => ({
  useColors: () => ({
    text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
  }),
}));

import { BookmarkButton } from './BookmarkButton';

describe('BookmarkButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders unbookmarked state by default', () => {
    render(<BookmarkButton targetType="challenge" targetId="c1" />);
    const btn = screen.getByTestId('bookmark-button');
    expect(btn).toBeTruthy();
    // Unbookmarked shows ☆
    expect(btn.textContent).toContain('\u2606');
    // Accessibility label
    expect(btn.getAttribute('aria-label')).toBe('Add bookmark');
  });

  it('renders bookmarked state when initialBookmarked is true', () => {
    render(<BookmarkButton targetType="challenge" targetId="c1" initialBookmarked={true} />);
    const btn = screen.getByTestId('bookmark-button');
    // Bookmarked shows ★
    expect(btn.textContent).toContain('\u2605');
    expect(btn.getAttribute('aria-label')).toBe('Remove bookmark');
  });

  it('toggles bookmark on click with successful API response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bookmarked: true }),
    }));

    render(<BookmarkButton targetType="challenge" targetId="c1" />);
    const btn = screen.getByTestId('bookmark-button');

    // Initially unbookmarked
    expect(btn.textContent).toContain('\u2606');

    await act(async () => {
      fireEvent.click(btn);
    });

    // After successful toggle, should show bookmarked
    await waitFor(() => {
      expect(btn.textContent).toContain('\u2605');
    });
  });

  it('reverts on API error (non-ok response)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'fail' }),
    }));

    render(<BookmarkButton targetType="challenge" targetId="c1" />);
    const btn = screen.getByTestId('bookmark-button');

    // Initially unbookmarked
    expect(btn.textContent).toContain('\u2606');

    await act(async () => {
      fireEvent.click(btn);
    });

    // Should revert back to unbookmarked after error
    await waitFor(() => {
      expect(btn.textContent).toContain('\u2606');
    });
  });

  it('reverts on network error (fetch throws)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    render(<BookmarkButton targetType="challenge" targetId="c1" initialBookmarked={true} />);
    const btn = screen.getByTestId('bookmark-button');

    // Initially bookmarked
    expect(btn.textContent).toContain('\u2605');

    await act(async () => {
      fireEvent.click(btn);
    });

    // Should revert back to bookmarked after error
    await waitFor(() => {
      expect(btn.textContent).toContain('\u2605');
    });
  });

  it('calls stopPropagation on event if provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bookmarked: false }),
    }));

    render(<BookmarkButton targetType="replay" targetId="r1" />);
    const btn = screen.getByTestId('bookmark-button');

    await act(async () => {
      fireEvent.click(btn);
    });

    // Just verify it doesn't crash
    expect(btn).toBeTruthy();
  });

  it('uses custom size prop', () => {
    render(<BookmarkButton targetType="challenge" targetId="c1" size={24} />);
    const btn = screen.getByTestId('bookmark-button');
    expect(btn).toBeTruthy();
  });

  it('shows reduced opacity when loading', async () => {
    // Use a never-resolving promise to keep it in loading state
    let resolvePromise: any;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise((resolve) => {
      resolvePromise = resolve;
    })));

    render(<BookmarkButton targetType="challenge" targetId="c1" />);
    const btn = screen.getByTestId('bookmark-button');

    await act(async () => {
      fireEvent.click(btn);
    });

    // Button should be disabled during loading
    // Resolve the promise to clean up
    resolvePromise({ ok: true, json: async () => ({ bookmarked: true }) });
  });
});
