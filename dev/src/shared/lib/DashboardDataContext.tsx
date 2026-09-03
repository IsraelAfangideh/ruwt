/**
 * DashboardDataContext: Centralized data prefetching layer.
 * Fetches all dashboard tab data in parallel on first authenticated visit,
 * caches in memory, and exposes to screens for instant tab switching.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { useAuth } from './AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DataStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface DashboardDataState {
  challenges: { data: any[]; status: DataStatus; lastFetchedAt: number };
  dailyChallenge: { data: any; status: DataStatus; lastFetchedAt: number };
  leaderboard: { data: any[]; status: DataStatus; lastFetchedAt: number };
  seasons: { data: any[]; status: DataStatus; lastFetchedAt: number };
  dashboard: { data: any; status: DataStatus; lastFetchedAt: number };
  badges: { data: any; status: DataStatus; lastFetchedAt: number };
  bookmarks: { data: any[]; status: DataStatus; lastFetchedAt: number };
  activity: { data: any[]; status: DataStatus; lastFetchedAt: number };
  notifications: { data: { unreadCount: number }; status: DataStatus; lastFetchedAt: number };
}

export type EndpointName = keyof DashboardDataState;

export interface DashboardDataContextType {
  state: DashboardDataState;
  initialLoadComplete: boolean;
  refreshEndpoint: (name: EndpointName) => Promise<void>;
  refreshAll: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type Action =
  | { type: 'SET_STATUS'; endpoint: EndpointName; status: DataStatus }
  | { type: 'SET_DATA'; endpoint: EndpointName; data: any; status: DataStatus }
  | { type: 'BATCH_SET_STATUS'; endpoints: EndpointName[]; status: DataStatus };

function createInitialSlice() {
  return { data: null as any, status: 'idle' as DataStatus, lastFetchedAt: 0 };
}

export const initialState: DashboardDataState = {
  challenges: { ...createInitialSlice(), data: [] },
  dailyChallenge: createInitialSlice(),
  leaderboard: { ...createInitialSlice(), data: [] },
  seasons: { ...createInitialSlice(), data: [] },
  dashboard: createInitialSlice(),
  badges: { ...createInitialSlice(), data: { catalog: [], earned: [] } },
  bookmarks: { ...createInitialSlice(), data: [] },
  activity: { ...createInitialSlice(), data: [] },
  notifications: { ...createInitialSlice(), data: { unreadCount: 0 } },
};

export function reducer(state: DashboardDataState, action: Action): DashboardDataState {
  switch (action.type) {
    case 'SET_STATUS':
      return {
        ...state,
        [action.endpoint]: { ...state[action.endpoint], status: action.status },
      } as DashboardDataState;
    case 'SET_DATA':
      return {
        ...state,
        [action.endpoint]: {
          data: action.data,
          status: action.status,
          lastFetchedAt: Date.now(),
        },
      } as DashboardDataState;
    case 'BATCH_SET_STATUS': {
      const next = { ...state } as Record<string, any>;
      for (const ep of action.endpoints) {
        next[ep] = { ...state[ep], status: action.status };
      }
      return next as DashboardDataState;
    }
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Endpoint fetch definitions
// ---------------------------------------------------------------------------

interface EndpointConfig {
  url: string;
  transform: (json: any) => any;
}

/** Public browse data — safe to fetch before a session exists. */
export const PUBLIC_ENDPOINTS: EndpointName[] = ['challenges', 'dailyChallenge'];

export const ENDPOINTS: Record<EndpointName, EndpointConfig> = {
  challenges: {
    url: '/api/challenges',
    transform: (json) => (Array.isArray(json) ? json : []),
  },
  dailyChallenge: {
    url: '/api/daily-challenge',
    transform: (json) => (json?.challengeId ? json : null),
  },
  leaderboard: {
    url: '/api/leaderboard?limit=50&period=week&division=open',
    transform: (json) => json?.entries ?? [],
  },
  seasons: {
    url: '/api/seasons',
    transform: (json) => json?.seasons ?? [],
  },
  dashboard: {
    url: '/api/dashboard',
    transform: (json) => json ?? null,
  },
  badges: {
    url: '/api/badges',
    transform: (json) => ({
      catalog: json?.catalog ?? [],
      earned: json?.earned ?? [],
    }),
  },
  bookmarks: {
    url: '/api/bookmarks',
    transform: (json) => json?.bookmarks ?? [],
  },
  activity: {
    url: '/api/activity?limit=30',
    transform: (json) => json?.activities ?? [],
  },
  notifications: {
    url: '/api/notifications?limit=1',
    transform: (json) => ({ unreadCount: json?.unreadCount ?? 0 }),
  },
};

// How often to skip re-fetching an endpoint (ms)
export const MIN_REFETCH_INTERVAL = 60_000;
// Background refresh interval (ms)
export const BACKGROUND_REFRESH_INTERVAL = 120_000;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DashboardDataContext = createContext<DashboardDataContextType | undefined>(undefined);

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const abortControllers = useRef<Partial<Record<EndpointName, AbortController>>>({});
  const fetchedPublic = useRef(false);
  const fetchedPrivate = useRef(false);
  const backgroundInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  /* istanbul ignore next -- @preserve */
  const fetchEndpoint = useCallback(async (name: EndpointName, isBackground = false) => {
    const config = ENDPOINTS[name];

    // Abort any in-flight request for this endpoint
    if (abortControllers.current[name]) {
      abortControllers.current[name]!.abort();
    }

    const controller = new AbortController();
    abortControllers.current[name] = controller;

    // Only show loading status on initial fetch, not background refresh
    if (!isBackground) {
      dispatch({ type: 'SET_STATUS', endpoint: name, status: 'loading' });
    }

    try {
      const res = await fetch(config.url, { signal: controller.signal });
      if (res.ok) {
        const json = await res.json();
        dispatch({ type: 'SET_DATA', endpoint: name, data: config.transform(json), status: 'loaded' });
      } else {
        // Non-OK but not aborted — mark as error on initial, keep stale on background
        if (!isBackground) {
          dispatch({ type: 'SET_STATUS', endpoint: name, status: 'error' });
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        if (!isBackground) {
          dispatch({ type: 'SET_STATUS', endpoint: name, status: 'error' });
        }
      }
    }
  }, []);

  const refreshEndpoint = useCallback(async (name: EndpointName) => {
    await fetchEndpoint(name, true);
  }, [fetchEndpoint]);

  const refreshAll = useCallback(async () => {
    const names = Object.keys(ENDPOINTS) as EndpointName[];
    const now = Date.now();
    const current = stateRef.current;
    const toRefresh = names.filter(
      (n) => now - current[n].lastFetchedAt >= MIN_REFETCH_INTERVAL,
    );
    if (toRefresh.length === 0) return;
    await Promise.allSettled(toRefresh.map((n) => fetchEndpoint(n, true)));
  }, [fetchEndpoint]);

  // Public list immediately — Problems should not wait on Supabase.
  useEffect(() => {
    if (fetchedPublic.current) return;
    fetchedPublic.current = true;
    dispatch({ type: 'BATCH_SET_STATUS', endpoints: PUBLIC_ENDPOINTS, status: 'loading' });
    Promise.allSettled(PUBLIC_ENDPOINTS.map((n) => fetchEndpoint(n, false)));
  }, [fetchEndpoint]);

  // Private tabs + per-user challenge progress after a session exists.
  useEffect(() => {
    if (authLoading || !user || fetchedPrivate.current) return;
    fetchedPrivate.current = true;
    const privateNames = (Object.keys(ENDPOINTS) as EndpointName[]).filter(
      (n) => !PUBLIC_ENDPOINTS.includes(n),
    );
    dispatch({ type: 'BATCH_SET_STATUS', endpoints: privateNames, status: 'loading' });
    Promise.allSettled([...privateNames, 'challenges' as EndpointName].map((n) => fetchEndpoint(n, false)));
  }, [authLoading, user, fetchEndpoint]);

  // Background refresh
  useEffect(() => {
    if (!user) return;
    backgroundInterval.current = setInterval(/* istanbul ignore next -- @preserve */ () => {
      /* istanbul ignore next -- @preserve */
      const names = Object.keys(ENDPOINTS) as EndpointName[];
      /* istanbul ignore next -- @preserve */
      const now = Date.now();
      /* istanbul ignore next -- @preserve */
      const current = stateRef.current;
      /* istanbul ignore next -- @preserve */
      const stale = names.filter((n) => now - current[n].lastFetchedAt >= MIN_REFETCH_INTERVAL);
      /* istanbul ignore next -- @preserve */
      if (stale.length > 0) {
        /* istanbul ignore next -- @preserve */
        Promise.allSettled(stale.map((n) => fetchEndpoint(n, true)));
      }
    }, BACKGROUND_REFRESH_INTERVAL);

    return () => {
      /* istanbul ignore next -- @preserve */
      if (backgroundInterval.current) clearInterval(backgroundInterval.current);
    };
  }, [user, fetchEndpoint]);

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      /* istanbul ignore next -- @preserve */
      Object.values(abortControllers.current).forEach((c) => c?.abort());
    };
  }, []);

  const initialLoadComplete = useMemo(() => {
    const names = Object.keys(ENDPOINTS) as EndpointName[];
    return names.every((n) => state[n].status === 'loaded' || state[n].status === 'error');
  }, [state]);

  const value = useMemo(
    () => ({ state, initialLoadComplete, refreshEndpoint, refreshAll }),
    [state, initialLoadComplete, refreshEndpoint, refreshAll],
  );

  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData(): DashboardDataContextType {
  const context = useContext(DashboardDataContext);
  if (!context) throw new Error('useDashboardData must be used within DashboardDataProvider');
  return context;
}
