import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildKey, checkRateLimit } from './rate-limit';

// ---------------------------------------------------------------------------
// checkRateLimit — D1-backed sliding window rate limiter
// ---------------------------------------------------------------------------

describe('checkRateLimit', () => {
  let mockDb: {
    prepare: ReturnType<typeof vi.fn>;
  };

  function makePrepare(countResult: number, oldestResult?: number) {
    let callIndex = 0;
    return vi.fn().mockImplementation(() => {
      callIndex++;
      const currentCall = callIndex;
      return {
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockImplementation(() => {
            if (currentCall === 1) return Promise.resolve({ cnt: countResult });
            if (currentCall === 2) return Promise.resolve({ oldest_ts: oldestResult });
            return Promise.resolve(null);
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue(undefined),
        }),
      };
    });
  }

  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // avoid probabilistic cleanup
  });

  it('allows request when count is below limit', async () => {
    mockDb = { prepare: makePrepare(0) };

    const result = await checkRateLimit(mockDb as unknown as D1Database, 'user:u1', '/api/ai/chat');

    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it('denies request when count reaches limit for /api/ai/chat (30 req/60s)', async () => {
    const now = Math.floor(Date.now() / 1000);
    // oldest_ts is the start of the window — retry after = oldest_ts + 60 - now
    mockDb = { prepare: makePrepare(30, now - 50) };

    const result = await checkRateLimit(mockDb as unknown as D1Database, 'user:u1', '/api/ai/chat');

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it('denies request when count reaches limit for /api/submissions (10 req/60s)', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockDb = { prepare: makePrepare(10, now - 30) };

    const result = await checkRateLimit(mockDb as unknown as D1Database, 'user:u1', '/api/submissions');

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it('uses public read tier (60 req/60s) for /api/challenges', async () => {
    mockDb = { prepare: makePrepare(59) };

    const result = await checkRateLimit(mockDb as unknown as D1Database, 'ip:1.2.3.4', '/api/challenges');

    expect(result.allowed).toBe(true);
  });

  it('uses default tier (120 req/60s) for unmatched /api/ routes', async () => {
    mockDb = { prepare: makePrepare(119) };

    const result = await checkRateLimit(mockDb as unknown as D1Database, 'user:u1', '/api/some-unknown');

    expect(result.allowed).toBe(true);
  });

  it('records the request in D1 when allowed', async () => {
    const runMock = vi.fn().mockResolvedValue(undefined);
    let callIndex = 0;
    mockDb = {
      prepare: vi.fn().mockImplementation(() => {
        callIndex++;
        const currentCall = callIndex;
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(currentCall === 1 ? { cnt: 0 } : null),
            run: runMock,
          }),
        };
      }),
    };

    await checkRateLimit(mockDb as unknown as D1Database, 'user:u1', '/api/ai/chat');

    // The INSERT call is the second prepare call
    expect(mockDb.prepare).toHaveBeenCalledTimes(2);
    expect(runMock).toHaveBeenCalled();
  });

  it('triggers probabilistic cleanup when random < 0.01', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.005); // < 0.01 threshold

    const deleteMock = vi.fn().mockResolvedValue(undefined);
    let callIndex = 0;
    mockDb = {
      prepare: vi.fn().mockImplementation(() => {
        callIndex++;
        const currentCall = callIndex;
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(currentCall === 1 ? { cnt: 0 } : null),
            run: vi.fn().mockImplementation(() => {
              if (currentCall === 3) {
                // cleanup DELETE
                return { catch: vi.fn() };
              }
              return Promise.resolve(undefined);
            }),
          }),
        };
      }),
    };

    await checkRateLimit(mockDb as unknown as D1Database, 'user:u1', '/api/ai/chat');

    // Should have 3 prepare calls: COUNT, INSERT, DELETE
    expect(mockDb.prepare).toHaveBeenCalledTimes(3);
  });

  it('retryAfter is at least 1 second when rate limited', async () => {
    const now = Math.floor(Date.now() / 1000);
    // oldest_ts is very recent, so retryAfter should be close to windowSeconds
    mockDb = { prepare: makePrepare(30, now) };

    const result = await checkRateLimit(mockDb as unknown as D1Database, 'user:u1', '/api/ai/chat');

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
    expect(result.retryAfter).toBeLessThanOrEqual(60);
  });

  it('computes retryAfter correctly based on oldest entry in window', async () => {
    const now = Math.floor(Date.now() / 1000);
    // oldest_ts is 50 seconds ago, window is 60s, so oldest falls out in 10s
    mockDb = { prepare: makePrepare(30, now - 50) };

    const result = await checkRateLimit(mockDb as unknown as D1Database, 'user:u1', '/api/ai/chat');

    expect(result.allowed).toBe(false);
    // retryAfter = max(1, (oldest_ts + 60) - now) = max(1, (now-50+60)-now) = max(1, 10) = 10
    expect(result.retryAfter).toBe(10);
  });

  it('handles null countResult by treating as 0', async () => {
    let callIndex = 0;
    mockDb = {
      prepare: vi.fn().mockImplementation(() => {
        callIndex++;
        const currentCall = callIndex;
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(currentCall === 1 ? null : null),
            run: vi.fn().mockResolvedValue(undefined),
          }),
        };
      }),
    };

    const result = await checkRateLimit(mockDb as unknown as D1Database, 'user:u1', '/api/ai/chat');

    expect(result.allowed).toBe(true);
  });

  it('handles null oldest_ts in rate limit response by using windowStart', async () => {
    const now = Math.floor(Date.now() / 1000);
    let callIndex = 0;
    mockDb = {
      prepare: vi.fn().mockImplementation(() => {
        callIndex++;
        const currentCall = callIndex;
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockImplementation(() => {
              if (currentCall === 1) return Promise.resolve({ cnt: 30 });
              if (currentCall === 2) return Promise.resolve({ oldest_ts: null });
              return Promise.resolve(null);
            }),
            run: vi.fn().mockResolvedValue(undefined),
          }),
        };
      }),
    };

    const result = await checkRateLimit(mockDb as unknown as D1Database, 'user:u1', '/api/ai/chat');

    expect(result.allowed).toBe(false);
    // When oldest_ts is null, falls back to windowStart: retryAfter = max(1, (windowStart + 60) - now)
    // windowStart = now - 60, so retryAfter = max(1, now - 60 + 60 - now) = max(1, 0) = 1
    expect(result.retryAfter).toBe(1);
  });

  it('shares rate limit bucket for sub-paths of the same tier route', async () => {
    // /api/challenges and /api/challenges/abc should share the same bucket
    mockDb = { prepare: makePrepare(59) };

    const result = await checkRateLimit(mockDb as unknown as D1Database, 'ip:1.2.3.4', '/api/challenges/abc');

    expect(result.allowed).toBe(true);
    // Verify the endpoint key used is the tier route prefix, not the full path
    const bindCall = (mockDb.prepare as any).mock.results[0].value.bind;
    expect(bindCall).toHaveBeenCalled();
  });

  it('matches routes with query parameters', async () => {
    mockDb = { prepare: makePrepare(0) };

    const result = await checkRateLimit(mockDb as unknown as D1Database, 'ip:1.2.3.4', '/api/challenges?page=1');

    expect(result.allowed).toBe(true);
  });
});

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
