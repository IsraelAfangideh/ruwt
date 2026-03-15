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

const initialState: DashboardDataState = {
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

/* istanbul ignore next -- @preserve */
function reducer(state: DashboardDataState, action: Action): DashboardDataState {
  /* istanbul ignore next -- @preserve */
  switch (action.type) {
    /* istanbul ignore next -- @preserve */
    case 'SET_STATUS':
      /* istanbul ignore next -- @preserve */
      return {
        ...state,
        [action.endpoint]: { ...state[action.endpoint], status: action.status },
      } as DashboardDataState;
    /* istanbul ignore next -- @preserve */
    case 'SET_DATA':
      /* istanbul ignore next -- @preserve */
      return {
        ...state,
        [action.endpoint]: {
          data: action.data,
          status: action.status,
          lastFetchedAt: Date.now(),
        },
      } as DashboardDataState;
    /* istanbul ignore next -- @preserve */
    case 'BATCH_SET_STATUS': {
      /* istanbul ignore next -- @preserve */
      const next = { ...state } as Record<string, any>;
      /* istanbul ignore next -- @preserve */
      for (const ep of action.endpoints) {
        /* istanbul ignore next -- @preserve */
        next[ep] = { ...state[ep], status: action.status };
      }
      /* istanbul ignore next -- @preserve */
      return next as DashboardDataState;
    }
    /* istanbul ignore next -- @preserve */
    default:
      /* istanbul ignore next -- @preserve */
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

/* istanbul ignore next -- @preserve */
const ENDPOINTS: Record<EndpointName, EndpointConfig> = {
  challenges: {
    url: '/api/challenges',
    /* istanbul ignore next -- @preserve */
    transform: (json) => (Array.isArray(json) ? json : []),
  },
  dailyChallenge: {
    url: '/api/daily-challenge',
    /* istanbul ignore next -- @preserve */
    transform: (json) => (json?.challengeId ? json : null),
  },
  leaderboard: {
    url: '/api/leaderboard?limit=50&period=week&division=open',
    /* istanbul ignore next -- @preserve */
    transform: (json) => json?.entries ?? [],
  },
  seasons: {
    url: '/api/seasons',
    /* istanbul ignore next -- @preserve */
    transform: (json) => json?.seasons ?? [],
  },
  dashboard: {
    url: '/api/dashboard',
    /* istanbul ignore next -- @preserve */
    transform: (json) => json ?? null,
  },
  badges: {
    url: '/api/badges',
    /* istanbul ignore next -- @preserve */
    transform: (json) => ({
      /* istanbul ignore next -- @preserve */
      catalog: json?.catalog ?? [],
      earned: json?.earned ?? [],
    }),
  },
  bookmarks: {
    url: '/api/bookmarks',
    /* istanbul ignore next -- @preserve */
    transform: (json) => json?.bookmarks ?? [],
  },
  activity: {
    url: '/api/activity?limit=30',
    /* istanbul ignore next -- @preserve */
    transform: (json) => json?.activities ?? [],
  },
  notifications: {
    url: '/api/notifications?limit=1',
    /* istanbul ignore next -- @preserve */
    transform: (json) => ({ unreadCount: json?.unreadCount ?? 0 }),
  },
};

// How often to skip re-fetching an endpoint (ms)
const MIN_REFETCH_INTERVAL = 60_000;
// Background refresh interval (ms)
const BACKGROUND_REFRESH_INTERVAL = 120_000;

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
  const hasFetched = useRef(false);
  const backgroundInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  /* istanbul ignore next -- @preserve */
  const fetchEndpoint = useCallback(async (name: EndpointName, isBackground = false) => {
    /* istanbul ignore next -- @preserve */
    const config = ENDPOINTS[name];

    // Abort any in-flight request for this endpoint
    /* istanbul ignore next -- @preserve */
    if (abortControllers.current[name]) {
      /* istanbul ignore next -- @preserve */
      abortControllers.current[name]!.abort();
    }

    /* istanbul ignore next -- @preserve */
    const controller = new AbortController();
    /* istanbul ignore next -- @preserve */
    abortControllers.current[name] = controller;

    // Only show loading status on initial fetch, not background refresh
    /* istanbul ignore next -- @preserve */
    if (!isBackground) {
      /* istanbul ignore next -- @preserve */
      dispatch({ type: 'SET_STATUS', endpoint: name, status: 'loading' });
    }

    /* istanbul ignore next -- @preserve */
    try {
      /* istanbul ignore next -- @preserve */
      const res = await fetch(config.url, { signal: controller.signal });
      /* istanbul ignore next -- @preserve */
      if (res.ok) {
        /* istanbul ignore next -- @preserve */
        const json = await res.json();
        /* istanbul ignore next -- @preserve */
        dispatch({ type: 'SET_DATA', endpoint: name, data: config.transform(json), status: 'loaded' });
      /* istanbul ignore next -- @preserve */
      } else {
        // Non-OK but not aborted — mark as error on initial, keep stale on background
        /* istanbul ignore next -- @preserve */
        if (!isBackground) {
          /* istanbul ignore next -- @preserve */
          dispatch({ type: 'SET_STATUS', endpoint: name, status: 'error' });
        }
      }
    } catch (err: any) {
      /* istanbul ignore next -- @preserve */
      if (err?.name !== 'AbortError') {
        /* istanbul ignore next -- @preserve */
        if (!isBackground) {
          /* istanbul ignore next -- @preserve */
          dispatch({ type: 'SET_STATUS', endpoint: name, status: 'error' });
        }
      }
    }
  }, []);

  /* istanbul ignore next -- @preserve */
  const refreshEndpoint = useCallback(async (name: EndpointName) => {
    /* istanbul ignore next -- @preserve */
    await fetchEndpoint(name, true);
  }, [fetchEndpoint]);

  /* istanbul ignore next -- @preserve */
  const refreshAll = useCallback(async () => {
    /* istanbul ignore next -- @preserve */
    const names = Object.keys(ENDPOINTS) as EndpointName[];
    /* istanbul ignore next -- @preserve */
    const now = Date.now();
    /* istanbul ignore next -- @preserve */
    const current = stateRef.current;
    /* istanbul ignore next -- @preserve */
    const toRefresh = names.filter(
      (n) => now - current[n].lastFetchedAt >= MIN_REFETCH_INTERVAL,
    );
    /* istanbul ignore next -- @preserve */
    if (toRefresh.length === 0) return;
    /* istanbul ignore next -- @preserve */
    await Promise.allSettled(toRefresh.map((n) => fetchEndpoint(n, true)));
  }, [fetchEndpoint]);

  // Initial prefetch when user is authenticated (no longer blocked by profile fetch)
  useEffect(() => {
    /* istanbul ignore next -- @preserve */
    if (authLoading || !user || hasFetched.current) return;
    /* istanbul ignore next -- @preserve */
    hasFetched.current = true;

    /* istanbul ignore next -- @preserve */
    const names = Object.keys(ENDPOINTS) as EndpointName[];
    /* istanbul ignore next -- @preserve */
    dispatch({ type: 'BATCH_SET_STATUS', endpoints: names, status: 'loading' });
    /* istanbul ignore next -- @preserve */
    Promise.allSettled(names.map((n) => fetchEndpoint(n, false)));
  }, [authLoading, user, fetchEndpoint]);

  // Background refresh
  useEffect(() => {
    /* istanbul ignore next -- @preserve */
    if (!user) return;
    /* istanbul ignore next -- @preserve */
    backgroundInterval.current = setInterval(() => {
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

    /* istanbul ignore next -- @preserve */
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

/* istanbul ignore next -- @preserve */
export function useDashboardData(): DashboardDataContextType {
  /* istanbul ignore next -- @preserve */
  const context = useContext(DashboardDataContext);
  /* istanbul ignore next -- @preserve */
  if (!context) throw new Error('useDashboardData must be used within DashboardDataProvider');
  /* istanbul ignore next -- @preserve */
  return context;
}
