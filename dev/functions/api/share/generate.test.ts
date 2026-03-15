import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../drizzle/schema.d1', () => ({
  attempts: { id: 'id', userId: 'user_id', status: 'status', challengeId: 'challenge_id', totalCost: 'total_cost', passedTests: 'passed_tests', totalTests: 'total_tests' },
  challenges: { id: 'id', title: 'title', difficulty: 'difficulty', category: 'category' },
  profiles: {},
}));

import { onRequestPost } from './generate';

const FAKE_USER = { id: 'user-1', email: 'dev@ruwt.dev' };

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx(body: unknown) {
  return {
    request: new Request('https://ruwt.dev/api/share/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
  };
}

describe('POST /api/share/generate', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestPost(makeCtx({ attemptId: 'att-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when attemptId is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const res = await onRequestPost(makeCtx({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Missing attemptId');
  });

  it('returns 404 when attempt not found or belongs to other user', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestPost(makeCtx({ attemptId: 'att-999' }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Attempt not found');
  });

  it('returns 400 when attempt is not passed', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const attempt = { id: 'att-1', userId: FAKE_USER.id, status: 'failed', challengeId: 'ch-1', totalCost: 100, passedTests: 0, totalTests: 5 };
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([attempt]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestPost(makeCtx({ attemptId: 'att-1' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Can only share passed attempts');
  });

  it('returns share URL and metadata for a passed attempt', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const attempt = { id: 'att-1', userId: FAKE_USER.id, status: 'passed', challengeId: 'ch-1', totalCost: 500, passedTests: 5, totalTests: 5 };
    const challenge = { title: 'FizzBuzz', difficulty: 'easy', category: 'prompt_efficiency' };
    const rankResult = { rank: 2 };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([attempt]) };
        }
        if (selectCall === 2) {
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([challenge]) };
        }
        // rank
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([rankResult]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx({ attemptId: 'att-1' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.shareToken).toBe('att-1');
    expect(json.shareUrl).toBe('https://ruwt.dev/share/att-1');
    expect(json.challenge.title).toBe('FizzBuzz');
    expect(json.rank).toBe(2);
    expect(json.cost).toBe(500);
    expect(json.passedTests).toBe(5);
    expect(json.totalTests).toBe(5);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestPost(makeCtx({ attemptId: 'att-1' }));
    expect(res.status).toBe(500);
  });

  it('returns rank zero when leaderboard rank query is empty', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const attempt = { id: 'att-1', userId: FAKE_USER.id, status: 'passed', challengeId: 'ch-1', totalCost: 500, passedTests: 5, totalTests: 5 };
    const challenge = { title: 'T', difficulty: 'easy', category: 'c' };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([attempt]) };
        if (selectCall === 2) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([challenge]) };
        // rank query returns empty
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx({ attemptId: 'att-1' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.rank).toBe(0);
  });

  it('returns null challenge when challenge record is not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const attempt = { id: 'att-1', userId: FAKE_USER.id, status: 'passed', challengeId: 'ch-missing', totalCost: 500, passedTests: 5, totalTests: 5 };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([attempt]) };
        // challenge not found
        if (selectCall === 2) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ rank: 1 }]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx({ attemptId: 'att-1' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.challenge).toBeNull();
  });
});
