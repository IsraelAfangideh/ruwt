import { useState, useCallback, useEffect } from 'react';

/** Preferences persisted to localStorage */
interface PersistedPrefs {
  sidebarPosition: 'left' | 'right';
  resultsDock: 'sidebar' | 'bottom';
  activeBottomTab: 'terminal' | 'results';
}

/** Full layout state (persisted prefs + transient state) */
export interface ArenaLayoutPrefs extends PersistedPrefs {
  sidebarCollapsed: boolean;
  bottomCollapsed: boolean;
}

const STORAGE_KEY = 'arena-layout-prefs';

const PERSISTED_DEFAULTS: PersistedPrefs = {
  sidebarPosition: 'left',
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

  // Only persist non-transient preferences, not collapsed state
  useEffect(() => {
    const { sidebarPosition, resultsDock, activeBottomTab } = prefs;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sidebarPosition, resultsDock, activeBottomTab }));
  }, [prefs.sidebarPosition, prefs.resultsDock, prefs.activeBottomTab]);

  const setSidebarCollapsed = useCallback((v: boolean) => {
    setPrefs((p) => ({ ...p, sidebarCollapsed: v }));
  }, []);

  const setBottomCollapsed = useCallback((v: boolean) => {
    setPrefs((p) => ({ ...p, bottomCollapsed: v }));
  }, []);

  const toggleSidebarPosition = useCallback(() => {
    setPrefs((p) => ({ ...p, sidebarPosition: p.sidebarPosition === 'left' ? 'right' : 'left' }));
  }, []);

  const setResultsDock = useCallback((v: 'sidebar' | 'bottom') => {
    setPrefs((p) => ({ ...p, resultsDock: v, activeBottomTab: v === 'bottom' ? 'results' : p.activeBottomTab }));
  }, []);

  const setActiveBottomTab = useCallback((v: 'terminal' | 'results') => {
    setPrefs((p) => ({ ...p, activeBottomTab: v }));
  }, []);

  // Derive effective bottom tab — if the selected tab isn't actually docked
  // in the bottom panel, fall back to terminal.
  const effectiveBottomTab = (
    (prefs.activeBottomTab === 'results' && prefs.resultsDock === 'bottom') ||
    prefs.activeBottomTab === 'terminal'
  ) ? prefs.activeBottomTab : 'terminal';

  return {
    ...prefs,
    activeBottomTab: effectiveBottomTab,
    setSidebarCollapsed,
    setBottomCollapsed,
    toggleSidebarPosition,
    setResultsDock,
    setActiveBottomTab,
  };
}
