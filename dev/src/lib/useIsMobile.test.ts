// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './useIsMobile';

/* ── Helpers ────────────────────────────────────────────────────────────── */

function mockMatchMedia(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mql = {
    matches,
    media: '(max-width: 767px)',
    addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') listeners.push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') {
        const idx = listeners.indexOf(handler);
        if (idx >= 0) listeners.splice(idx, 1);
      }
    }),
    dispatchChange(newMatches: boolean) {
      mql.matches = newMatches;
      for (const l of listeners) {
        l({ matches: newMatches } as MediaQueryListEvent);
      }
    },
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  const matchMediaMock = vi.fn().mockReturnValue(mql);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: matchMediaMock,
  });
  return mql;
}

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('useIsMobile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when viewport matches mobile breakpoint', () => {
    mockMatchMedia(true);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('returns false when viewport does not match mobile breakpoint', () => {
    mockMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('updates when media query changes', () => {
    const mql = mockMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      mql.dispatchChange(true);
    });

    expect(result.current).toBe(true);
  });

  it('updates back to non-mobile when viewport widens', () => {
    const mql = mockMatchMedia(true);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    act(() => {
      mql.dispatchChange(false);
    });

    expect(result.current).toBe(false);
  });

  it('cleans up event listener on unmount', () => {
    const mql = mockMatchMedia(false);

    const { unmount } = renderHook(() => useIsMobile());

    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    const handler = mql.addEventListener.mock.calls.find((c: unknown[]) => c[0] === 'change')![1];

    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith('change', handler);
  });

  it('queries the correct breakpoint', () => {
    mockMatchMedia(false);

    renderHook(() => useIsMobile());

    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
  });
});
