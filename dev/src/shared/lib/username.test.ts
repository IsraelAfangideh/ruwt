import { describe, it, expect } from 'vitest';
import { usernameProblem, normalizeUsername, USERNAME_PATTERN } from './username';

describe('usernameProblem', () => {
  it('accepts a valid handle', () => {
    expect(usernameProblem('israel')).toBeNull();
    expect(usernameProblem('a1b')).toBeNull();
    expect(usernameProblem('my-handle-2')).toBeNull();
  });

  it('rejects a handle that is too short or too long', () => {
    expect(usernameProblem('ab')).toContain('3 characters');
    expect(usernameProblem('a'.repeat(31))).toContain('30 characters');
  });

  it('accepts the exact bounds', () => {
    expect(usernameProblem('abc')).toBeNull();
    expect(usernameProblem('a'.repeat(30))).toBeNull();
  });

  it('rejects uppercase, spaces, and other symbols', () => {
    expect(usernameProblem('Israel')).toContain('Lowercase');
    expect(usernameProblem('my handle')).toContain('Lowercase');
    expect(usernameProblem('my_handle')).toContain('Lowercase');
  });

  it('rejects a leading or trailing hyphen', () => {
    expect(usernameProblem('-abc')).toContain('hyphen');
    expect(usernameProblem('abc-')).toContain('hyphen');
  });
});

describe('normalizeUsername', () => {
  it('trims and lowercases', () => {
    expect(normalizeUsername('  Israel  ')).toBe('israel');
  });
});

describe('USERNAME_PATTERN', () => {
  it('is the rule the server enforces, so the two cannot drift', () => {
    // Guards the shared constant itself: if this regex changes, the client
    // hint and the server rejection change together or not at all.
    expect(USERNAME_PATTERN.source).toBe('^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$');
  });
});
