// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useArenaLayout } from './useArenaLayout';

describe('useArenaLayout', () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  it('returns default prefs when nothing in localStorage', () => {
    const { result } = renderHook(() => useArenaLayout());
    expect(result.current.sidebarPosition).toBe('left');
    expect(result.current.sidebarCollapsed).toBe(false);
    expect(result.current.bottomCollapsed).toBe(false);
    expect(result.current.chatDock).toBe('sidebar');
    expect(result.current.resultsDock).toBe('bottom');
    expect(result.current.activeBottomTab).toBe('terminal');
  });

  it('loads saved prefs from localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
      JSON.stringify({ sidebarPosition: 'right', chatDock: 'bottom' })
    );
    const { result } = renderHook(() => useArenaLayout());
    expect(result.current.sidebarPosition).toBe('right');
    expect(result.current.chatDock).toBe('bottom');
    // Transient state always starts at default
    expect(result.current.sidebarCollapsed).toBe(false);
    // Defaults still apply for unset fields
    expect(result.current.resultsDock).toBe('bottom');
  });

  it('handles corrupted localStorage gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('not valid json');
    const { result } = renderHook(() => useArenaLayout());
    expect(result.current.sidebarPosition).toBe('left');
  });

  it('persists only non-transient prefs to localStorage on change', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    const { result } = renderHook(() => useArenaLayout());
    // Changing transient state (collapsed) should NOT trigger localStorage write
    act(() => result.current.setSidebarCollapsed(true));
    // Only the initial render may write defaults; collapsed state is not persisted
    const calls = setItem.mock.calls.filter(c => c[0] === 'arena-layout-prefs');
    for (const [, json] of calls) {
      expect(json).not.toContain('"sidebarCollapsed"');
      expect(json).not.toContain('"bottomCollapsed"');
    }
    // Changing persisted state triggers localStorage write
    act(() => result.current.toggleSidebarPosition());
    const lastCall = setItem.mock.calls[setItem.mock.calls.length - 1];
    expect(lastCall[0]).toBe('arena-layout-prefs');
    expect(lastCall[1]).toContain('"sidebarPosition":"right"');
  });

  it('setSidebarCollapsed updates state', () => {
    const { result } = renderHook(() => useArenaLayout());
    act(() => result.current.setSidebarCollapsed(true));
    expect(result.current.sidebarCollapsed).toBe(true);
  });

  it('setBottomCollapsed updates state', () => {
    const { result } = renderHook(() => useArenaLayout());
    act(() => result.current.setBottomCollapsed(true));
    expect(result.current.bottomCollapsed).toBe(true);
  });

  it('toggleSidebarPosition flips left to right', () => {
    const { result } = renderHook(() => useArenaLayout());
    expect(result.current.sidebarPosition).toBe('left');
    act(() => result.current.toggleSidebarPosition());
    expect(result.current.sidebarPosition).toBe('right');
  });

  it('toggleSidebarPosition flips right to left', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
      JSON.stringify({ sidebarPosition: 'right' })
    );
    const { result } = renderHook(() => useArenaLayout());
    act(() => result.current.toggleSidebarPosition());
    expect(result.current.sidebarPosition).toBe('left');
  });

  it('setChatDock to bottom also sets activeBottomTab', () => {
    const { result } = renderHook(() => useArenaLayout());
    act(() => result.current.setChatDock('bottom'));
    expect(result.current.chatDock).toBe('bottom');
    expect(result.current.activeBottomTab).toBe('chat');
  });

  it('setChatDock to sidebar does not change activeBottomTab', () => {
    const { result } = renderHook(() => useArenaLayout());
    act(() => result.current.setChatDock('sidebar'));
    expect(result.current.chatDock).toBe('sidebar');
    expect(result.current.activeBottomTab).toBe('terminal');
  });

  it('setResultsDock to bottom also sets activeBottomTab', () => {
    const { result } = renderHook(() => useArenaLayout());
    act(() => result.current.setResultsDock('bottom'));
    expect(result.current.resultsDock).toBe('bottom');
    expect(result.current.activeBottomTab).toBe('results');
  });

  it('setResultsDock to sidebar does not change activeBottomTab', () => {
    const { result } = renderHook(() => useArenaLayout());
    act(() => result.current.setResultsDock('sidebar'));
    expect(result.current.resultsDock).toBe('sidebar');
    expect(result.current.activeBottomTab).toBe('terminal');
  });

  it('setActiveBottomTab updates state', () => {
    const { result } = renderHook(() => useArenaLayout());
    act(() => result.current.setActiveBottomTab('chat'));
    expect(result.current.activeBottomTab).toBe('chat');
  });
});
