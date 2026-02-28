import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../drizzle/schema.d1', () => ({
  attempts: { userId: 'user_id', challengeId: 'challenge_id', status: 'status', totalCost: 'total_cost', submittedAt: 'submitted_at' },
  profiles: { id: 'id', name: 'name', email: 'email', avatarUrl: 'avatar_url' },
  challenges: { id: 'id', title: 'title' },
}));

import { onRequestGet } from './activity';

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx(params = '') {
  return {
    request: new Request(`https://ruwt.dev/api/activity${params}`),
    env: makeEnv(),
  };
}

function setupDb(results: any[] = []) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(results),
  };
  mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });
  return chain;
}

describe('GET /api/activity (public)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns activities and uniqueUsers on happy path', async () => {
    setupDb([
      { userName: 'Alice', userEmail: 'alice@a.com', avatarUrl: null, challengeTitle: 'FizzBuzz', totalCost: 500, submittedAt: '2024-01-01' },
      { userName: null, userEmail: 'bob@b.com', avatarUrl: null, challengeTitle: 'Dedup', totalCost: 300, submittedAt: '2024-01-02' },
    ]);

    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.activities).toHaveLength(2);
    expect(json.activities[0].user).toBe('Alice');
    expect(json.activities[1].user).toBe('bob');
    expect(json.uniqueUsers).toBe(2);
  });

  it('falls back to Anonymous when no name or email', async () => {
    setupDb([
      { userName: null, userEmail: null, avatarUrl: null, challengeTitle: 'Test', totalCost: 100, submittedAt: '2024-01-01' },
    ]);

    const res = await onRequestGet(makeCtx());
    const json = await res.json();
    expect(json.activities[0].user).toBe('Anonymous');
  });

  it('respects limit query param capped at 50', async () => {
    const chain = setupDb([]);
    await onRequestGet(makeCtx('?limit=100'));
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it('uses default limit of 20', async () => {
    const chain = setupDb([]);
    await onRequestGet(makeCtx());
    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  it('returns 500 on error', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });
});
