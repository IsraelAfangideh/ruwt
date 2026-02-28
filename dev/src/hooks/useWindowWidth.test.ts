// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWindowWidth, useIsDesktop } from './useWindowWidth';

describe('useWindowWidth', () => {
  let originalInnerWidth: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
  });

  it('returns current window.innerWidth on initial render', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 1200,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useWindowWidth());

    expect(result.current).toBe(1200);
  });

  it('updates when window is resized', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useWindowWidth());
    expect(result.current).toBe(1024);

    // Simulate resize
    Object.defineProperty(window, 'innerWidth', {
      value: 500,
      writable: true,
      configurable: true,
    });

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(500);
  });

  it('cleans up event listener on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useWindowWidth());

    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    const handler = addSpy.mock.calls.find((c) => c[0] === 'resize')![1];

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', handler);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe('useIsDesktop', () => {
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      writable: true,
      configurable: true,
    });
  });

  it('returns true when width >= 768', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 768,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useIsDesktop());

    expect(result.current).toBe(true);
  });

  it('returns false when width < 768', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 767,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useIsDesktop());

    expect(result.current).toBe(false);
  });

  it('updates reactively when window crosses breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 900,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);

    // Resize below breakpoint
    Object.defineProperty(window, 'innerWidth', {
      value: 600,
      writable: true,
      configurable: true,
    });

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(false);
  });
});
