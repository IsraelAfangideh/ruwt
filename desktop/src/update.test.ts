import { describe, expect, it } from 'vitest';
import { updateAvailable, versionCmp } from './update.js';

describe('desktop updater', () => {
  it('compares dotted versions', () => {
    expect(versionCmp('0.2.0', '0.1.0')).toBe(1);
    expect(versionCmp('0.1.0', '0.2.0')).toBe(-1);
    expect(versionCmp('0.2.0', '0.2.0')).toBe(0);
  });

  it('ignores local dev builds', () => {
    expect(updateAvailable({ version: '0.1.0', commit: 'dev' }, { version: '0.2.0', commit: 'abc' })).toBe(false);
  });

  it('detects a newer version', () => {
    expect(updateAvailable({ version: '0.1.0', commit: 'old' }, { version: '0.2.0', commit: 'new' })).toBe(true);
  });

  it('detects a same-version commit change', () => {
    expect(updateAvailable({ version: '0.2.0', commit: 'aaa1111' }, { version: '0.2.0', commit: 'bbb2222' })).toBe(true);
    expect(updateAvailable({ version: '0.2.0', commit: 'aaa1111' }, { version: '0.2.0', commit: 'aaa1111' })).toBe(false);
  });

  it('ignores an empty remote version', () => {
    expect(updateAvailable({ version: '0.2.0', commit: 'aaa' }, { version: '', commit: 'bbb' })).toBe(false);
  });
});
