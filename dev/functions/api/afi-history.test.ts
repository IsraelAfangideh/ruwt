import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../drizzle/schema.d1', () => ({
  profiles: { id: 'id', username: 'username' },
  afiHistory: { userId: 'user_id', score: 'score', tier: 'tier', solveCount: 'solve_count', recordedAt: 'recorded_at' },
}));

import { onRequestGet } from './afi-history';

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx(username?: string) {
  const url = username
    ? `https://ruwt.dev/api/afi-history?username=${encodeURIComponent(username)}`
    : 'https://ruwt.dev/api/afi-history';
  return {
    request: new Request(url),
    env: makeEnv(),
  };
}

describe('GET /api/afi-history', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 400 when username is missing', async () => {
    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Username required');
  });

  it('returns 404 when user not found', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });
    const res = await onRequestGet(makeCtx('nonexistent'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('User not found');
  });

  it('returns history in chronological order on happy path', async () => {
    const historyRecords = [
      { score: 400, tier: 'proficient', solveCount: 10, date: '2026-03-15' },
      { score: 350, tier: 'developing', solveCount: 8, date: '2026-03-14' },
    ];
    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          // Profile lookup
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ id: 'u1' }]),
          };
        }
        // History query
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue(historyRecords),
        };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('alice'));
    expect(res.status).toBe(200);
    const json = await res.json();
    // Should be reversed (chronological order, oldest first)
    expect(json.history[0].score).toBe(350);
    expect(json.history[1].score).toBe(400);
  });

  it('returns 500 on error', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('DB fail'); });
    const res = await onRequestGet(makeCtx('alice'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });
});
