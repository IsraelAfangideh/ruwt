import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock('../../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../drizzle/schema.d1', () => ({
  attempts: { id: 'id', status: 'status', totalCost: 'total_cost', passedTests: 'passed_tests', totalTests: 'total_tests', userId: 'user_id', challengeId: 'challenge_id', submittedAt: 'submitted_at' },
  challenges: { id: 'id', title: 'title', difficulty: 'difficulty', category: 'category', language: 'language' },
  profiles: { id: 'id', name: 'name', username: 'username', avatarUrl: 'avatar_url' },
}));

import { onRequestGet } from './[attemptId]';

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx(attemptId?: string) {
  return {
    request: new Request(`https://ruwt.dev/api/share/${attemptId || ''}`),
    env: makeEnv(),
    params: Promise.resolve({ attemptId }),
  };
}

describe('GET /api/share/:attemptId (public)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 400 when attemptId is missing', async () => {
    const res = await onRequestGet(makeCtx(undefined));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Missing attemptId');
  });

  it('returns 404 when attempt not found', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestGet(makeCtx('att-999'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when attempt is not passed', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'att-1', status: 'failed', totalCost: 100, passedTests: 0, totalTests: 5, userId: 'u-1', challengeId: 'ch-1', submittedAt: 't' }]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestGet(makeCtx('att-1'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Not found');
  });

  it('returns share data for a passed attempt', async () => {
    const attempt = { id: 'att-1', status: 'passed', totalCost: 500, passedTests: 5, totalTests: 5, userId: 'u-1', challengeId: 'ch-1', submittedAt: '2024-01-01' };
    const challenge = { id: 'ch-1', title: 'FizzBuzz', difficulty: 'easy', category: 'prompt_efficiency', language: 'javascript' };
    const solver = { name: 'Alice', username: 'alice', avatarUrl: 'https://img.com/a.png' };
    const rankResult = { rank: 3 };

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
        if (selectCall === 3) {
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([solver]) };
        }
        // rank
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([rankResult]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('att-1'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.attemptId).toBe('att-1');
    expect(json.cost).toBe(500);
    expect(json.rank).toBe(3);
    expect(json.challenge.title).toBe('FizzBuzz');
    expect(json.solver.name).toBe('Alice');
    expect(json.solver.username).toBe('alice');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeCtx('att-1'));
    expect(res.status).toBe(500);
  });

  it('returns rank zero when leaderboard rank query is empty', async () => {
    const attempt = { id: 'att-1', status: 'passed', totalCost: 500, passedTests: 5, totalTests: 5, userId: 'u-1', challengeId: 'ch-1', submittedAt: '2024-01-01' };
    const challenge = { id: 'ch-1', title: 'FizzBuzz', difficulty: 'easy', category: 'prompt_efficiency', language: 'javascript' };
    const solver = { name: 'Alice', username: 'alice', avatarUrl: null };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([attempt]) };
        if (selectCall === 2) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([challenge]) };
        if (selectCall === 3) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([solver]) };
        // rank query returns empty → fallback to 0
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('att-1'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.rank).toBe(0);
  });

  it('returns null solver when user profile is not found', async () => {
    const attempt = { id: 'att-1', status: 'passed', totalCost: 500, passedTests: 5, totalTests: 5, userId: 'u-1', challengeId: 'ch-1', submittedAt: '2024-01-01' };
    const challenge = { id: 'ch-1', title: 'FizzBuzz', difficulty: 'easy', category: 'prompt_efficiency', language: 'javascript' };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([attempt]) };
        if (selectCall === 2) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([challenge]) };
        // profile query returns empty → solver is undefined
        if (selectCall === 3) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ rank: 1 }]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('att-1'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.solver).toBeNull();
  });

  it('returns null challenge when challenge record is not found', async () => {
    const attempt = { id: 'att-1', status: 'passed', totalCost: 500, passedTests: 5, totalTests: 5, userId: 'u-1', challengeId: 'ch-missing', submittedAt: '2024-01-01' };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([attempt]) };
        // challenge not found
        if (selectCall === 2) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        if (selectCall === 3) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('att-1'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.challenge).toBeNull();
  });
});
