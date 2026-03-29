import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../_shared/infra/db', () => ({ getDb: mockGetDb }));

import { onRequestGet } from './events';

const ADMIN_USER = { id: 'admin-1', email: 'admin@ruwt.dev' };
const REGULAR_USER = { id: 'user-1', email: 'dev@ruwt.dev' };

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'u',
    VITE_SUPABASE_ANON_KEY: 'k',
    ADMIN_USER_IDS: 'admin-1,admin-2',
    ...overrides,
  } as Env;
}

function makeCtx(urlSuffix = '', env?: Env) {
  return {
    request: new Request(`https://ruwt.dev/api/admin/events${urlSuffix}`),
    env: env ?? makeEnv(),
  };
}

describe('GET /api/admin/events', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not an admin', async () => {
    mockGetUser.mockResolvedValue(REGULAR_USER);
    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Forbidden');
  });

  it('returns 403 when ADMIN_USER_IDS is not set', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);
    const res = await onRequestGet(makeCtx('', makeEnv({ ADMIN_USER_IDS: undefined })));
    expect(res.status).toBe(403);
  });

  it('returns summary and timeline for default 48h window', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    const db = {
      all: vi.fn()
        // signups
        .mockResolvedValueOnce([{ name: 'Karim', email: 'karim@test.com', created_at: '2026-03-18 06:00:00' }])
        // attempts
        .mockResolvedValueOnce([
          { status: 'passed', title: 'FizzBuzz', username: 'karim', total_cost: 500, passed_tests: 3, total_tests: 3, created_at: '2026-03-18 07:00:00' },
          { status: 'failed', title: 'LRU Cache', username: 'karim', total_cost: 200, passed_tests: 1, total_tests: 5, created_at: '2026-03-18 06:30:00' },
        ])
        // ai_calls aggregated
        .mockResolvedValueOnce([{ model: 'claude-sonnet-4-20250514', calls: 5, total_cost: 1200, input_tokens: 5000, output_tokens: 2000 }])
        // transactions
        .mockResolvedValueOnce([{ type: 'signup_bonus', count: 1, total_amount: 50000 }])
        // emails
        .mockResolvedValueOnce([{ digest_type: 'daily_challenge', status: 'sent', count: 28 }])
        // errors
        .mockResolvedValueOnce([{ level: 'error', endpoint: '/api/execute', error_message: 'timeout', timestamp: '2026-03-18 08:00:00' }]),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.summary.hours).toBe(48);
    expect(json.summary.signups).toBe(1);
    expect(json.summary.attempts.total).toBe(2);
    expect(json.summary.attempts.passed).toBe(1);
    expect(json.summary.attempts.failed).toBe(1);
    expect(json.summary.ai_usage).toHaveLength(1);
    expect(json.summary.transactions).toHaveLength(1);
    expect(json.summary.emails).toHaveLength(1);
    expect(json.summary.errors).toBe(1);

    // Timeline sorted descending
    expect(json.events).toHaveLength(4); // 1 signup + 2 attempts + 1 error
    expect(json.events[0].type).toBe('error'); // 08:00 is latest
    expect(json.events[1].type).toBe('attempt'); // 07:00
    expect(json.events[2].type).toBe('attempt'); // 06:30
    expect(json.events[3].type).toBe('signup'); // 06:00
  });

  it('respects custom hours param and clamps to max 168', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    const db = {
      all: vi.fn().mockResolvedValue([]),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('?hours=200'));
    const json = await res.json();
    expect(json.summary.hours).toBe(168); // clamped to 1 week max
  });

  it('clamps hours minimum to 1', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    const db = { all: vi.fn().mockResolvedValue([]) };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('?hours=0'));
    const json = await res.json();
    expect(json.summary.hours).toBe(1);
  });

  it('falls back to 48 for non-numeric hours param', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    const db = { all: vi.fn().mockResolvedValue([]) };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('?hours=abc'));
    const json = await res.json();
    expect(json.summary.hours).toBe(48);
  });

  it('handles empty results gracefully', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    const db = { all: vi.fn().mockResolvedValue([]) };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    const json = await res.json();
    expect(json.summary.signups).toBe(0);
    expect(json.summary.attempts.total).toBe(0);
    expect(json.summary.errors).toBe(0);
    expect(json.events).toEqual([]);
  });

  it('handles error_logs table not existing (catch fallback)', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    let callIdx = 0;
    const db = {
      all: vi.fn().mockImplementation(() => {
        callIdx++;
        if (callIdx === 6) return Promise.reject(new Error('no such table: error_logs'));
        return Promise.resolve([]);
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.summary.errors).toBe(0);
  });
});
