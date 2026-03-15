import { getPathFromState } from '@react-navigation/core';
import { linking } from './linking';
import type { RootStackParamList } from './types';

/**
 * Type-safe route entry: screens with no params can omit `params`,
 * screens with all-optional params can omit `params`,
 * screens with required params must provide them.
 */
export type RouteEntry = {
  [K in keyof RootStackParamList]: RootStackParamList[K] extends undefined
    ? { name: K; params?: undefined }
    : {} extends RootStackParamList[K]
      ? { name: K; params?: RootStackParamList[K] }
      : { name: K; params: RootStackParamList[K] }
}[keyof RootStackParamList];

/**
 * Validate a dynamic string as a valid screen name and return a RouteEntry.
 * Falls back to `fallback` if the string is not in the allowed set.
 */
export function validScreen(
  raw: string,
  allowed: ReadonlySet<keyof RootStackParamList>,
  fallback: keyof RootStackParamList,
): RouteEntry {
  const name = (allowed as Set<string>).has(raw) ? raw as keyof RootStackParamList : fallback;
  return { name } as RouteEntry;
}

/**
 * Wrapper around navigation.reset() that also syncs the browser URL.
 * React Navigation's web history integration can miss URL updates when
 * reset() is called inside async callbacks (the originating component
 * unmounts before the batched URL update fires).
 */
export function resetNavigation(
  navigation: { reset(state: { index: number; routes: RouteEntry[] }): void },
  routes: RouteEntry[],
  index = 0,
) {
  navigation.reset({ index, routes });

  /* istanbul ignore next -- @preserve */
  if (typeof window === 'undefined' || !linking.config) return;

  const path = getPathFromState(
    { routes: routes.map(r => ({ name: r.name, params: r.params })), index, stale: false as const, type: 'stack' as const, key: 'root', routeNames: routes.map(r => r.name) },
    linking.config,
  );

  /* istanbul ignore next -- @preserve */
  if (path && path !== '*') {
    /* istanbul ignore next -- @preserve */
    try { window.history.replaceState(null, '', path.startsWith('/') ? path : '/' + path); } catch { /* test env */ }
  }
}
