import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock('../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../../drizzle/schema.d1', () => ({
  attempts: { id: 'id', userId: 'user_id', challengeId: 'challenge_id', status: 'status', totalCost: 'total_cost', inputTokens: 'input_tokens', outputTokens: 'output_tokens', submittedAt: 'submitted_at', replayPublic: 'replay_public' },
  profiles: { id: 'id', name: 'name', email: 'email', avatarUrl: 'avatar_url' },
  challenges: { id: 'id', title: 'title', difficulty: 'difficulty', category: 'category' },
}));

import { onRequestGet } from './replays';

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx(params = '') {
  return {
    request: new Request(`https://ruwt.dev/api/replays${params}`),
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

describe('GET /api/replays (public)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns recent replays by default', async () => {
    setupDb([
      {
        attemptId: 'a-1', userId: 'u-1', userName: 'Alice', userEmail: 'a@a.com', avatarUrl: null,
        challengeId: 'c-1', challengeTitle: 'Fizz', challengeDifficulty: 'easy', challengeCategory: 'prompt_efficiency',
        totalCost: 500, inputTokens: 100, outputTokens: 200, submittedAt: '2024-01-01',
      },
    ]);

    const res = await onRequestGet(makeCtx());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.type).toBe('recent');
    expect(json.replays).toHaveLength(1);
    expect(json.replays[0].user.name).toBe('Alice');
    expect(json.replays[0].challenge.title).toBe('Fizz');
    expect(json.replays[0].cost).toBe(500);
    expect(json.replays[0].tokens).toBe(300);
  });

  it('returns featured type when featured=true', async () => {
    setupDb([]);
    const res = await onRequestGet(makeCtx('?featured=true'));
    const json = await res.json();
    expect(json.type).toBe('featured');
  });

  it('falls back to email prefix when no name', async () => {
    setupDb([
      {
        attemptId: 'a-1', userId: 'u-1', userName: null, userEmail: 'bob@b.com', avatarUrl: null,
        challengeId: 'c-1', challengeTitle: 'T', challengeDifficulty: 'easy', challengeCategory: 'c',
        totalCost: 100, inputTokens: 10, outputTokens: 20, submittedAt: '2024-01-01',
      },
    ]);

    const res = await onRequestGet(makeCtx());
    const json = await res.json();
    expect(json.replays[0].user.name).toBe('bob');
  });

  it('filters by challengeId when query param is present', async () => {
    const chain = setupDb([]);
    await onRequestGet(makeCtx('?challengeId=fizzbuzz'));
    const json = await (await onRequestGet(makeCtx('?challengeId=fizzbuzz'))).json();
    expect(json.replays).toEqual([]);
  });

  it('respects limit param capped at 50', async () => {
    const chain = setupDb([]);
    await onRequestGet(makeCtx('?limit=100'));
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it('defaults limit to 10', async () => {
    const chain = setupDb([]);
    await onRequestGet(makeCtx());
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('returns 500 on error', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(500);
  });
});
