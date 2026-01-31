import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const STORAGE_KEY = 'ruwt_anonymous_user_id';

function createUuid(): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) {
    return random;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getAnonymousUserId(): Promise<string> {
  if (Platform.OS === 'web') {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const created = createUuid();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  }

  const existing = await SecureStore.getItemAsync(STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const created = createUuid();
  await SecureStore.setItemAsync(STORAGE_KEY, created);
  return created;
}

export function getClientMeta(): {
  platform: string;
  appVersion?: string;
  locale?: string;
  timezone?: string;
  userAgent?: string;
} {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const appVersion =
    Constants.expoConfig?.version ||
    Constants.manifest?.version ||
    undefined;

  return {
    platform: Platform.OS,
    appVersion,
    locale,
    timezone,
    userAgent: Platform.OS === 'web' ? navigator.userAgent : undefined,
  };
}
