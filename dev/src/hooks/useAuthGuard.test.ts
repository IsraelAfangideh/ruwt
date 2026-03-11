// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

// Mock dependencies before importing the hook
vi.mock('@react-navigation/native', () => ({
  useNavigation: vi.fn(),
}));

let mockAuthReturn = { user: null as any, loading: true };
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

import { useNavigation } from '@react-navigation/native';
import { useAuthGuard } from './useAuthGuard';

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('useAuthGuard', () => {
  const mockReset = vi.fn();
  const mockNavigation = { reset: mockReset };

  beforeEach(() => {
    vi.restoreAllMocks();
    (useNavigation as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigation);
    mockReset.mockClear();
    mockAuthReturn = { user: null, loading: true };
  });

  it('starts with loading=true and user=null while auth is loading', () => {
    mockAuthReturn = { user: null, loading: true };

    const { result } = renderHook(() => useAuthGuard());

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    // Should not redirect while still loading
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('returns user and loading=false when authenticated', () => {
    const fakeUser = { id: 'u-1', email: 'test@example.com' };
    mockAuthReturn = { user: fakeUser, loading: false };

    const { result } = renderHook(() => useAuthGuard());

    expect(result.current.loading).toBe(false);
    expect(result.current.user).toEqual(fakeUser);
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('redirects to Login when loading completes with no user', () => {
    mockAuthReturn = { user: null, loading: false };

    renderHook(() => useAuthGuard());

    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  });

  it('does not redirect while loading even if user is null', () => {
    mockAuthReturn = { user: null, loading: true };

    renderHook(() => useAuthGuard());

    expect(mockReset).not.toHaveBeenCalled();
  });
});
