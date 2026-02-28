// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock dependencies before importing the hook
vi.mock('@react-navigation/native', () => ({
  useNavigation: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { useAuthGuard } from './useAuthGuard';

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('useAuthGuard', () => {
  const mockReset = vi.fn();
  const mockNavigation = { reset: mockReset };

  beforeEach(() => {
    vi.restoreAllMocks();
    (useNavigation as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigation);
    mockReset.mockClear();
  });

  it('starts with loading=true and user=null', () => {
    // Never-resolving promise to keep it in loading state
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: { getUser: () => new Promise(() => {}) },
    });

    const { result } = renderHook(() => useAuthGuard());

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('sets user and loading=false when authenticated', async () => {
    const fakeUser = { id: 'u-1', email: 'test@example.com' };
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: fakeUser } }),
      },
    });

    const { result } = renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(fakeUser);
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('redirects to Login when no authenticated user', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: null } }),
      },
    });

    const { result } = renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalled();
    });

    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Login' }],
    });

    // user and loading stay at initial values since we returned early
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('does not update state if unmounted before auth check completes', async () => {
    let resolveGetUser: (value: unknown) => void;
    const getUserPromise = new Promise((r) => { resolveGetUser = r; });

    (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: { getUser: () => getUserPromise },
    });

    const { result, unmount } = renderHook(() => useAuthGuard());

    // Unmount before resolving
    unmount();

    // Now resolve — the cancelled flag should prevent state updates
    resolveGetUser!({ data: { user: { id: 'u-2' } } });

    // Wait a tick for the promise to settle
    await new Promise((r) => setTimeout(r, 10));

    // State should still be initial (no errors from setting state on unmounted component)
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('does not redirect if unmounted before auth check completes (no user)', async () => {
    let resolveGetUser: (value: unknown) => void;
    const getUserPromise = new Promise((r) => { resolveGetUser = r; });

    (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: { getUser: () => getUserPromise },
    });

    const { unmount } = renderHook(() => useAuthGuard());

    unmount();

    resolveGetUser!({ data: { user: null } });

    await new Promise((r) => setTimeout(r, 10));

    expect(mockReset).not.toHaveBeenCalled();
  });
});
