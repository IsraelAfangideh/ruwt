import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../drizzle/schema.d1', () => ({
  profiles: { id: 'id', name: 'name', username: 'username', avatarUrl: 'avatar_url', createdAt: 'created_at' },
  attempts: { id: 'id', userId: 'user_id', challengeId: 'challenge_id', status: 'status', totalCost: 'total_cost', inputTokens: 'input_tokens', outputTokens: 'output_tokens', submittedAt: 'submitted_at', replayPublic: 'replay_public' },
  challenges: { id: 'id', title: 'title', difficulty: 'difficulty', category: 'category' },
}));

import { onRequestGet } from './[username]';

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx(username: string) {
  return {
    request: new Request(`https://ruwt.dev/api/users/${username}`),
    env: makeEnv(),
    params: { username },
  };
}

describe('GET /api/users/:username (public)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 400 when username is empty', async () => {
    const res = await onRequestGet(makeCtx(''));
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

  it('returns full public profile on happy path', async () => {
    const profile = { id: 'u-1', name: 'Alice', avatarUrl: null, username: 'alice', createdAt: '2024-01-01' };
    const stats = { solved: 10, avgCost: 500 };
    const rankRows = [{ rank: 3 }];
    const recentReplays = [
      { attemptId: 'a-1', challengeId: 'ch-1', challengeTitle: 'Fizz', challengeDifficulty: 'easy', challengeCategory: 'c', totalCost: 100, inputTokens: 10, outputTokens: 20, submittedAt: '2024-01-01' },
    ];
    const globalAvgs = [
      { category: 'model_selection', avgCost: 1000 },
      { category: 'prompt_efficiency', avgCost: 800 },
    ];
    const userAvgs = [
      { category: 'model_selection', avgCost: 500 },
      { category: 'prompt_efficiency', avgCost: 400 },
    ];

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          // profile lookup
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([profile]) };
        }
        if (selectCall === 2) {
          // stats
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([stats]) };
        }
        if (selectCall === 3) {
          // recent replays
          return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue(recentReplays),
          };
        }
        if (selectCall === 4) {
          // global avgs
          return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockResolvedValue(globalAvgs),
          };
        }
        if (selectCall === 5) {
          // user avgs
          return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockResolvedValue(userAvgs),
          };
        }
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
      all: vi.fn().mockResolvedValue(rankRows),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('alice'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.user.name).toBe('Alice');
    expect(json.user.username).toBe('alice');
    expect(json.stats.solved).toBe(10);
    expect(json.stats.avgCost).toBe(500);
    expect(json.stats.globalRank).toBe(3);
    expect(json.recentReplays).toHaveLength(1);
    // Radar: model_selection ratio = 1000/500 = 2.0 -> score = min(100, max(0, round(2*50))) = 100
    expect(json.radar.modelSelection).toBe(100);
    // prompt_efficiency ratio = 800/400 = 2.0 -> 100
    expect(json.radar.promptEfficiency).toBe(100);
    // categories without data should be 0
    expect(json.radar.debugging).toBe(0);
  });

  it('handles user with no solves gracefully', async () => {
    const profile = { id: 'u-1', name: 'Newbie', avatarUrl: null, username: 'newbie', createdAt: '2024-01-01' };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([profile]) };
        }
        if (selectCall === 2) {
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ solved: 0, avgCost: null }]) };
        }
        if (selectCall === 3) {
          return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          };
        }
        if (selectCall === 4 || selectCall === 5) {
          return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockResolvedValue([]),
          };
        }
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
      all: vi.fn().mockResolvedValue([{ rank: 1 }]),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('newbie'));
    const json = await res.json();
    expect(json.stats.solved).toBe(0);
    expect(json.stats.avgCost).toBe(0);
    expect(json.recentReplays).toEqual([]);
  });

  it('returns 500 on error', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeCtx('alice'));
    expect(res.status).toBe(500);
  });
});
