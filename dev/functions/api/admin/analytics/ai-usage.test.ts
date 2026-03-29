import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/infra/db', () => ({ getDb: mockGetDb }));

import { onRequestGet } from './ai-usage';

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

function makeCtx(env?: Env) {
  return {
    request: new Request('https://ruwt.dev/api/admin/analytics/ai-usage'),
    env: env ?? makeEnv(),
  };
}

describe('GET /api/admin/analytics/ai-usage', () => {
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
    const res = await onRequestGet(makeCtx(makeEnv({ ADMIN_USER_IDS: undefined })));
    expect(res.status).toBe(403);
  });

  it('returns correct percentages with mixed AI/no-AI solves', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    const db = {
      all: vi.fn()
        .mockResolvedValueOnce([{ total_passed: 10, no_ai: 3 }])
        .mockResolvedValueOnce([
          { title: 'FizzBuzz Budget', difficulty: 'easy', total_passed: 5, no_ai_count: 3 },
          { title: 'LRU Cache', difficulty: 'medium', total_passed: 5, no_ai_count: 0 },
        ])
        .mockResolvedValueOnce([
          { username: 'karim', email: 'karim@test.com', total_passed: 3, no_ai_solves: 3 },
          { username: null, email: 'anon@test.com', total_passed: 2, no_ai_solves: 0 },
        ]),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    const json = await res.json();

    expect(json.summary.totalPassed).toBe(10);
    expect(json.summary.withoutAI).toBe(3);
    expect(json.summary.withAI).toBe(7);
    expect(json.summary.noAIPercent).toBe(30);

    expect(json.byChallenge).toHaveLength(2);
    expect(json.byChallenge[0].title).toBe('FizzBuzz Budget');
    expect(json.byChallenge[0].noAIPercent).toBe(60);
    expect(json.byChallenge[1].noAIPercent).toBe(0);

    expect(json.topNoAIUsers).toHaveLength(2);
    expect(json.topNoAIUsers[0].user).toBe('karim');
    expect(json.topNoAIUsers[0].noAISolves).toBe(3);
    expect(json.topNoAIUsers[1].user).toBe('anon');
  });

  it('returns zero percentages when all solves use AI', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    const db = {
      all: vi.fn()
        .mockResolvedValueOnce([{ total_passed: 5, no_ai: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    const json = await res.json();

    expect(json.summary.noAIPercent).toBe(0);
    expect(json.summary.withAI).toBe(5);
  });

  it('handles empty database (no attempts)', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    const db = {
      all: vi.fn()
        .mockResolvedValueOnce([{ total_passed: 0, no_ai: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    const json = await res.json();

    expect(json.summary.totalPassed).toBe(0);
    expect(json.summary.noAIPercent).toBe(0);
    expect(json.byChallenge).toEqual([]);
    expect(json.topNoAIUsers).toEqual([]);
  });

  it('handles null totals row gracefully', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    const db = {
      all: vi.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    const json = await res.json();

    expect(json.summary.totalPassed).toBe(0);
    expect(json.summary.noAIPercent).toBe(0);
  });
});
