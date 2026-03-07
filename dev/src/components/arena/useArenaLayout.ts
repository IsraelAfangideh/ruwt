import { useState, useCallback, useEffect, useRef } from 'react';

/** Preferences persisted to localStorage */
interface PersistedPrefs {
  sidebarPosition: 'left' | 'right';
  chatDock: 'sidebar' | 'bottom';
  resultsDock: 'sidebar' | 'bottom';
  activeBottomTab: 'terminal' | 'chat' | 'results';
}

/** Full layout state (persisted prefs + transient state) */
export interface ArenaLayoutPrefs extends PersistedPrefs {
  sidebarCollapsed: boolean;
  bottomCollapsed: boolean;
}

const STORAGE_KEY = 'arena-layout-prefs';

const PERSISTED_DEFAULTS: PersistedPrefs = {
  sidebarPosition: 'left',
  chatDock: 'sidebar',
  resultsDock: 'bottom',
  activeBottomTab: 'terminal',
};

const DEFAULTS: ArenaLayoutPrefs = {
  ...PERSISTED_DEFAULTS,
  sidebarCollapsed: false,
  bottomCollapsed: false,
};

function loadPrefs(): ArenaLayoutPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function useArenaLayout() {
  const [prefs, setPrefs] = useState<ArenaLayoutPrefs>(loadPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // Only persist non-transient preferences, not collapsed state
  useEffect(() => {
    const { sidebarPosition, chatDock, resultsDock, activeBottomTab } = prefs;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sidebarPosition, chatDock, resultsDock, activeBottomTab }));
  }, [prefs.sidebarPosition, prefs.chatDock, prefs.resultsDock, prefs.activeBottomTab]);

  const setSidebarCollapsed = useCallback((v: boolean) => {
    setPrefs((p) => ({ ...p, sidebarCollapsed: v }));
  }, []);

  const setBottomCollapsed = useCallback((v: boolean) => {
    setPrefs((p) => ({ ...p, bottomCollapsed: v }));
  }, []);

  const toggleSidebarPosition = useCallback(() => {
    setPrefs((p) => ({ ...p, sidebarPosition: p.sidebarPosition === 'left' ? 'right' : 'left' }));
  }, []);

  const setChatDock = useCallback((v: 'sidebar' | 'bottom') => {
    setPrefs((p) => ({ ...p, chatDock: v, activeBottomTab: v === 'bottom' ? 'chat' : p.activeBottomTab }));
  }, []);

  const setResultsDock = useCallback((v: 'sidebar' | 'bottom') => {
    setPrefs((p) => ({ ...p, resultsDock: v, activeBottomTab: v === 'bottom' ? 'results' : p.activeBottomTab }));
  }, []);

  const setActiveBottomTab = useCallback((v: 'terminal' | 'chat' | 'results') => {
    setPrefs((p) => ({ ...p, activeBottomTab: v }));
  }, []);

  return {
    ...prefs,
    setSidebarCollapsed,
    setBottomCollapsed,
    toggleSidebarPosition,
    setChatDock,
    setResultsDock,
    setActiveBottomTab,
  };
}
