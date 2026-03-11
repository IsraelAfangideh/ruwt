// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';

// --- Mocks ---
const mockSetUser = vi.fn();
vi.mock('@sentry/react', () => ({
  setUser: (...args: any[]) => mockSetUser(...args),
}));

let mockGetUserResult: any = { data: { user: null } };
let authChangeCallback: ((event: string, session: any) => void) | null = null;
const mockUnsubscribe = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve(mockGetUserResult),
      onAuthStateChange: (cb: any) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
    },
  }),
}));

import { AuthProvider, useAuth } from './AuthContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetUserResult = { data: { user: null } };
    authChangeCallback = null;
    mockUnsubscribe.mockClear();
    mockSetUser.mockClear();
  });

  it('starts with loading=true and resolves to user after getUser', async () => {
    const fakeUser = { id: 'u-1', email: 'test@test.com' };
    mockGetUserResult = { data: { user: fakeUser } };

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(fakeUser);
    expect(mockSetUser).toHaveBeenCalledWith({ id: 'u-1', email: 'test@test.com' });
  });

  it('resolves with user=null when not authenticated', async () => {
    mockGetUserResult = { data: { user: null } };

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });

  it('updates user on auth state change', async () => {
    mockGetUserResult = { data: { user: null } };

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Simulate sign-in via onAuthStateChange
    const newUser = { id: 'u-2', email: 'new@test.com' };
    act(() => {
      authChangeCallback?.('SIGNED_IN', { user: newUser });
    });

    expect(result.current.user).toEqual(newUser);
    expect(mockSetUser).toHaveBeenCalledWith({ id: 'u-2', email: 'new@test.com' });
  });

  it('clears user on sign-out event', async () => {
    const fakeUser = { id: 'u-1', email: 'test@test.com' };
    mockGetUserResult = { data: { user: fakeUser } };

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(fakeUser);
    });

    // Simulate sign-out
    act(() => {
      authChangeCallback?.('SIGNED_OUT', null);
    });

    expect(result.current.user).toBeNull();
    expect(mockSetUser).toHaveBeenCalledWith(null);
  });

  it('unsubscribes on unmount', async () => {
    mockGetUserResult = { data: { user: null } };

    const { unmount } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(authChangeCallback).not.toBeNull();
    });

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
