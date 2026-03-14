/**
 * Sync test: validates client and server badge definitions stay in sync.
 * If this test fails, it means someone updated one side without the other.
 */
import { describe, it, expect } from 'vitest';
import { BADGE_DEFS as CLIENT_BADGES } from '../../src/shared/lib/badge-defs';
import { BADGE_DEFS as SERVER_BADGES } from './badges';

describe('badge sync (client <-> server)', () => {
  const clientKeys = Object.keys(CLIENT_BADGES).sort();
  const serverKeys = Object.keys(SERVER_BADGES).sort();

  it('client and server define the same badge keys', () => {
    expect(clientKeys).toEqual(serverKeys);
  });

  it('no extra keys on the client side', () => {
    const serverSet = new Set(serverKeys);
    for (const key of clientKeys) {
      expect(serverSet.has(key), `server missing badge key: ${key}`).toBe(true);
    }
  });

  it('no extra keys on the server side', () => {
    const clientSet = new Set(clientKeys);
    for (const key of serverKeys) {
      expect(clientSet.has(key), `client missing badge key: ${key}`).toBe(true);
    }
  });

  it('title matches for every badge', () => {
    for (const key of clientKeys) {
      expect(
        CLIENT_BADGES[key].title,
        `title mismatch for badge: ${key}`
      ).toBe(SERVER_BADGES[key].title);
    }
  });

  it('description matches for every badge', () => {
    for (const key of clientKeys) {
      expect(
        CLIENT_BADGES[key].description,
        `description mismatch for badge: ${key}`
      ).toBe(SERVER_BADGES[key].description);
    }
  });

  it('icon matches for every badge', () => {
    for (const key of clientKeys) {
      expect(
        CLIENT_BADGES[key].icon,
        `icon mismatch for badge: ${key}`
      ).toBe(SERVER_BADGES[key].icon);
    }
  });
});
