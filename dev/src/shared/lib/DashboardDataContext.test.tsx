// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUser = { current: null as any };
const mockAuthLoading = { current: false };

vi.mock('./AuthContext', () => ({
  useAuth: () => ({ user: mockUser.current, loading: mockAuthLoading.current }),
}));

import {
  DashboardDataProvider,
  useDashboardData,
  reducer,
  initialState,
  ENDPOINTS,
  MIN_REFETCH_INTERVAL,
} from './DashboardDataContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }) {
  return <DashboardDataProvider>{children}</DashboardDataProvider>;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockUser.current = null;
  mockAuthLoading.current = false;
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ([]),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests: reducer (pure function)
// ---------------------------------------------------------------------------

describe('reducer', () => {
  it('SET_STATUS updates status for given endpoint', () => {
    const state = reducer(initialState, {
      type: 'SET_STATUS',
      endpoint: 'challenges',
      status: 'loading',
    });
    expect(state.challenges.status).toBe('loading');
    // Other endpoints unchanged
    expect(state.leaderboard.status).toBe('idle');
  });

  it('SET_DATA updates data, status, and lastFetchedAt', () => {
    const before = Date.now();
    const state = reducer(initialState, {
      type: 'SET_DATA',
      endpoint: 'challenges',
      data: [{ id: 'c1' }],
      status: 'loaded',
    });
    expect(state.challenges.data).toEqual([{ id: 'c1' }]);
    expect(state.challenges.status).toBe('loaded');
    expect(state.challenges.lastFetchedAt).toBeGreaterThanOrEqual(before);
  });

  it('BATCH_SET_STATUS updates multiple endpoints', () => {
    const state = reducer(initialState, {
      type: 'BATCH_SET_STATUS',
      endpoints: ['challenges', 'leaderboard', 'badges'],
      status: 'loading',
    });
    expect(state.challenges.status).toBe('loading');
    expect(state.leaderboard.status).toBe('loading');
    expect(state.badges.status).toBe('loading');
    // Untouched endpoint
    expect(state.dashboard.status).toBe('idle');
  });

  it('default case returns state unchanged', () => {
    const state = reducer(initialState, { type: 'UNKNOWN' } as any);
    expect(state).toBe(initialState);
  });

  it('SET_STATUS preserves other fields in the endpoint slice', () => {
    const loaded = reducer(initialState, {
      type: 'SET_DATA',
      endpoint: 'challenges',
      data: [1, 2, 3],
      status: 'loaded',
    });
    const updated = reducer(loaded, {
      type: 'SET_STATUS',
      endpoint: 'challenges',
      status: 'loading',
    });
    // Data should still be there
    expect(updated.challenges.data).toEqual([1, 2, 3]);
    expect(updated.challenges.status).toBe('loading');
  });

  it('BATCH_SET_STATUS with empty endpoints returns state unchanged', () => {
    const state = reducer(initialState, {
      type: 'BATCH_SET_STATUS',
      endpoints: [],
      status: 'loading',
    });
    expect(state).toEqual(initialState);
  });
});

// ---------------------------------------------------------------------------
// Tests: ENDPOINTS transform functions
// ---------------------------------------------------------------------------

describe('ENDPOINTS transforms', () => {
  it('challenges: returns array if input is array', () => {
    expect(ENDPOINTS.challenges.transform([{ id: 'c1' }])).toEqual([{ id: 'c1' }]);
  });

  it('challenges: returns empty array if input is not array', () => {
    expect(ENDPOINTS.challenges.transform({ foo: 'bar' })).toEqual([]);
    expect(ENDPOINTS.challenges.transform(null)).toEqual([]);
  });

  it('dailyChallenge: returns object if challengeId present', () => {
    const obj = { challengeId: 'c1', title: 'Daily' };
    expect(ENDPOINTS.dailyChallenge.transform(obj)).toEqual(obj);
  });

  it('dailyChallenge: returns null if no challengeId', () => {
    expect(ENDPOINTS.dailyChallenge.transform({})).toBeNull();
    expect(ENDPOINTS.dailyChallenge.transform(null)).toBeNull();
  });

  it('leaderboard: extracts entries or defaults to empty', () => {
    expect(ENDPOINTS.leaderboard.transform({ entries: [1, 2] })).toEqual([1, 2]);
    expect(ENDPOINTS.leaderboard.transform({})).toEqual([]);
    expect(ENDPOINTS.leaderboard.transform(null)).toEqual([]);
  });

  it('seasons: extracts seasons or defaults to empty', () => {
    expect(ENDPOINTS.seasons.transform({ seasons: ['s1'] })).toEqual(['s1']);
    expect(ENDPOINTS.seasons.transform(null)).toEqual([]);
  });

  it('dashboard: returns json or null', () => {
    expect(ENDPOINTS.dashboard.transform({ stats: {} })).toEqual({ stats: {} });
    expect(ENDPOINTS.dashboard.transform(null)).toBeNull();
  });

  it('badges: extracts catalog and earned', () => {
    const result = ENDPOINTS.badges.transform({ catalog: ['a'], earned: ['b'] });
    expect(result).toEqual({ catalog: ['a'], earned: ['b'] });
  });

  it('badges: defaults to empty arrays', () => {
    expect(ENDPOINTS.badges.transform(null)).toEqual({ catalog: [], earned: [] });
    expect(ENDPOINTS.badges.transform({})).toEqual({ catalog: [], earned: [] });
  });

  it('bookmarks: extracts bookmarks or defaults to empty', () => {
    expect(ENDPOINTS.bookmarks.transform({ bookmarks: [1] })).toEqual([1]);
    expect(ENDPOINTS.bookmarks.transform(null)).toEqual([]);
  });

  it('activity: extracts activities or defaults to empty', () => {
    expect(ENDPOINTS.activity.transform({ activities: [1] })).toEqual([1]);
    expect(ENDPOINTS.activity.transform(null)).toEqual([]);
  });

  it('notifications: extracts unreadCount or defaults to 0', () => {
    expect(ENDPOINTS.notifications.transform({ unreadCount: 5 })).toEqual({ unreadCount: 5 });
    expect(ENDPOINTS.notifications.transform(null)).toEqual({ unreadCount: 0 });
  });
});

// ---------------------------------------------------------------------------
// Tests: useDashboardData outside provider
// ---------------------------------------------------------------------------

describe('useDashboardData without provider', () => {
  it('throws error when used outside DashboardDataProvider', () => {
    expect(() => {
      renderHook(() => useDashboardData());
    }).toThrow('useDashboardData must be used within DashboardDataProvider');
  });
});

// ---------------------------------------------------------------------------
// Tests: DashboardDataProvider — initial state (no user)
// ---------------------------------------------------------------------------

describe('DashboardDataProvider (no user)', () => {
  it('fetches public endpoints when no user is authenticated', async () => {
    mockUser.current = null;
    mockAuthLoading.current = false;

    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/challenges', expect.anything());
      expect(fetchMock).toHaveBeenCalledWith('/api/daily-challenge', expect.anything());
    });
    expect(fetchMock).not.toHaveBeenCalledWith('/api/dashboard', expect.anything());
    expect(result.current.state.challenges.status).not.toBe('idle');
  });

  it('still fetches public list while auth is loading', async () => {
    mockUser.current = { id: 'u1' };
    mockAuthLoading.current = true;

    renderHook(() => useDashboardData(), { wrapper });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/challenges', expect.anything());
    });
    expect(fetchMock).not.toHaveBeenCalledWith('/api/dashboard', expect.anything());
  });
});

// ---------------------------------------------------------------------------
// Tests: DashboardDataProvider — authenticated fetch
// ---------------------------------------------------------------------------

describe('DashboardDataProvider (authenticated)', () => {
  it('fetches all endpoints when user authenticates', async () => {
    mockUser.current = { id: 'u1' };
    mockAuthLoading.current = false;

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ([]),
    });

    renderHook(() => useDashboardData(), { wrapper });

    await waitFor(() => {
      for (const config of Object.values(ENDPOINTS)) {
        expect(fetchMock).toHaveBeenCalledWith(config.url, expect.anything());
      }
    });
  });

  it('sets status to loaded after successful fetch', async () => {
    mockUser.current = { id: 'u1' };

    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/challenges') {
        return { ok: true, json: async () => [{ id: 'c1' }] };
      }
      return { ok: true, json: async () => ({}) };
    });

    const { result } = renderHook(() => useDashboardData(), { wrapper });

    await waitFor(() => {
      expect(result.current.state.challenges.status).toBe('loaded');
    });
    expect(result.current.state.challenges.data).toEqual([{ id: 'c1' }]);
  });

  it('sets status to error when fetch returns non-ok', async () => {
    mockUser.current = { id: 'u1' };

    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/challenges') {
        return { ok: false, status: 500 };
      }
      return { ok: true, json: async () => ({}) };
    });

    const { result } = renderHook(() => useDashboardData(), { wrapper });

    await waitFor(() => {
      expect(result.current.state.challenges.status).toBe('error');
    });
  });

  it('sets status to error when fetch throws (non-abort)', async () => {
    mockUser.current = { id: 'u1' };

    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/challenges') {
        throw new Error('Network error');
      }
      return { ok: true, json: async () => ({}) };
    });

    const { result } = renderHook(() => useDashboardData(), { wrapper });

    await waitFor(() => {
      expect(result.current.state.challenges.status).toBe('error');
    });
  });

  it('ignores AbortError without setting error status', async () => {
    mockUser.current = { id: 'u1' };

    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/challenges') {
        const err = new DOMException('Aborted', 'AbortError');
        throw err;
      }
      return { ok: true, json: async () => ({}) };
    });

    const { result } = renderHook(() => useDashboardData(), { wrapper });

    // Wait for other endpoints to load
    await waitFor(() => {
      expect(result.current.state.leaderboard.status).toBe('loaded');
    });
    // challenges should still be loading (from BATCH_SET_STATUS), not error
    expect(result.current.state.challenges.status).toBe('loading');
  });

  it('reports initialLoadComplete when all endpoints are loaded or error', async () => {
    mockUser.current = { id: 'u1' };

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useDashboardData(), { wrapper });

    await waitFor(() => {
      expect(result.current.initialLoadComplete).toBe(true);
    });
  });

  it('initialLoadComplete is true when mix of loaded and error', async () => {
    mockUser.current = { id: 'u1' };

    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/challenges') {
        return { ok: false, status: 500 };
      }
      return { ok: true, json: async () => ({}) };
    });

    const { result } = renderHook(() => useDashboardData(), { wrapper });

    await waitFor(() => {
      expect(result.current.initialLoadComplete).toBe(true);
    });
    expect(result.current.state.challenges.status).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// Tests: refreshEndpoint
// ---------------------------------------------------------------------------

describe('refreshEndpoint', () => {
  it('fetches endpoint as background (no loading state set)', async () => {
    mockUser.current = { id: 'u1' };
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await waitFor(() => expect(result.current.initialLoadComplete).toBe(true));

    // Clear mock to track refreshEndpoint calls
    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true, json: async () => [{ id: 'new' }] });

    await act(async () => {
      await result.current.refreshEndpoint('challenges');
    });

    // Should have called fetch for challenges
    expect(fetchMock).toHaveBeenCalledWith('/api/challenges', expect.anything());
  });

  it('does not set error on background fetch failure', async () => {
    mockUser.current = { id: 'u1' };
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await waitFor(() => expect(result.current.initialLoadComplete).toBe(true));

    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await act(async () => {
      await result.current.refreshEndpoint('challenges');
    });

    // Should still be 'loaded', not 'error' — background doesn't set error
    expect(result.current.state.challenges.status).toBe('loaded');
  });

  it('does not set error on background fetch exception', async () => {
    mockUser.current = { id: 'u1' };
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await waitFor(() => expect(result.current.initialLoadComplete).toBe(true));

    fetchMock.mockClear();
    fetchMock.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      await result.current.refreshEndpoint('challenges');
    });

    // Should still be 'loaded' from initial fetch
    expect(result.current.state.challenges.status).toBe('loaded');
  });

  it('updates data on successful background refresh', async () => {
    mockUser.current = { id: 'u1' };
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await waitFor(() => expect(result.current.initialLoadComplete).toBe(true));

    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true, json: async () => [{ id: 'refreshed' }] });

    await act(async () => {
      await result.current.refreshEndpoint('challenges');
    });

    expect(result.current.state.challenges.data).toEqual([{ id: 'refreshed' }]);
  });
});

// ---------------------------------------------------------------------------
// Tests: refreshAll
// ---------------------------------------------------------------------------

describe('refreshAll', () => {
  it('skips endpoints fetched recently (within MIN_REFETCH_INTERVAL)', async () => {
    mockUser.current = { id: 'u1' };
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await waitFor(() => expect(result.current.initialLoadComplete).toBe(true));

    fetchMock.mockClear();

    await act(async () => {
      await result.current.refreshAll();
    });

    // All endpoints were just fetched, so refreshAll should skip them
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes stale endpoints when Date.now() advances past MIN_REFETCH_INTERVAL', async () => {
    mockUser.current = { id: 'u1' };
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await waitFor(() => expect(result.current.initialLoadComplete).toBe(true));

    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    // Mock Date.now to advance past MIN_REFETCH_INTERVAL
    const realNow = Date.now;
    const futureTime = realNow() + MIN_REFETCH_INTERVAL + 1000;
    vi.spyOn(Date, 'now').mockReturnValue(futureTime);

    await act(async () => {
      await result.current.refreshAll();
    });

    // Now all endpoints are stale and should be refreshed
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls.length).toBe(Object.keys(ENDPOINTS).length);

    vi.restoreAllMocks();
  });
});
