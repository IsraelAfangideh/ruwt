import { describe, it, expect } from 'vitest';
import { buildKey } from './rate-limit';

describe('buildKey', () => {
  it('uses user ID for authenticated non-public routes', () => {
    expect(buildKey('/api/ai/chat', 'user-123', '1.2.3.4')).toBe('user:user-123');
  });

  it('falls back to IP for unauthenticated non-public routes', () => {
    expect(buildKey('/api/ai/chat', null, '1.2.3.4')).toBe('ip:1.2.3.4');
  });

  it('uses IP for public read routes even when authenticated', () => {
    expect(buildKey('/api/challenges', 'user-123', '1.2.3.4')).toBe('ip:1.2.3.4');
    expect(buildKey('/api/challenges/abc', 'user-123', '1.2.3.4')).toBe('ip:1.2.3.4');
    expect(buildKey('/api/leaderboard', 'user-123', '1.2.3.4')).toBe('ip:1.2.3.4');
  });

  it('uses user ID for non-public API routes', () => {
    expect(buildKey('/api/submissions', 'user-123', '1.2.3.4')).toBe('user:user-123');
    expect(buildKey('/api/attempts', 'user-123', '1.2.3.4')).toBe('user:user-123');
  });

  it('uses user ID for /api/users/ subpaths (trailing slash in route means /api/users/abc does not match prefix check)', () => {
    // The route '/api/users/' with trailing slash means '/api/users/abc' does not
    // match the startsWith('/api/users/' + '/') = startsWith('/api/users//') check.
    // So it falls to user-based keying.
    expect(buildKey('/api/users/abc', 'user-123', '1.2.3.4')).toBe('user:user-123');
  });
});
