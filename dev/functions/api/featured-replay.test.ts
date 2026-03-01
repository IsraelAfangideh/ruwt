import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../drizzle/schema.d1', () => ({
  attempts: { id: 'id', userId: 'user_id', challengeId: 'challenge_id', status: 'status', totalCost: 'total_cost', inputTokens: 'input_tokens', outputTokens: 'output_tokens', submittedAt: 'submitted_at', createdAt: 'created_at', replayPublic: 'replay_public' },
  attemptMessages: { attemptId: 'attempt_id', sequence: 'sequence', role: 'role', content: 'content', model: 'model', inputTokens: 'input_tokens', outputTokens: 'output_tokens', cost: 'cost', createdAt: 'created_at' },
  profiles: { id: 'id', name: 'name', email: 'email', avatarUrl: 'avatar_url' },
  challenges: { id: 'id', title: 'title', difficulty: 'difficulty', category: 'category' },
}));

import { onRequestGet } from './featured-replay';

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx() {
  return { request: new Request('https://ruwt.dev/api/featured-replay'), env: makeEnv() };
}

describe('GET /api/featured-replay (public)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns null when no featured replay exists', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestGet(makeCtx());
    const json = await res.json();
    expect(json).toBeNull();
  });

  it('returns full replay data when a featured attempt with messages exists', async () => {
    const attempt = {
      attemptId: 'att-1',
      userId: 'user-1',
      totalCost: 500,
      inputTokens: 100,
      outputTokens: 200,
      submittedAt: '2024-01-01',
      createdAt: '2024-01-01',
      challengeTitle: 'FizzBuzz',
      challengeDifficulty: 'easy',
      challengeCategory: 'prompt_efficiency',
    };
    const solver = { name: 'Alice', email: 'alice@a.com', avatarUrl: 'https://img.com/a.png' };
    const msgs = [
      { role: 'user', content: 'Hi', model: null, inputTokens: 10, outputTokens: 0, cost: 0, createdAt: '2024-01-01', sequence: 1 },
      { role: 'assistant', content: 'Hello', model: 'gpt-4', inputTokens: 10, outputTokens: 20, cost: 100, createdAt: '2024-01-01', sequence: 2 },
    ];

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          // cheapest attempt
          return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([attempt]),
          };
        }
        if (selectCall === 2) {
          // solver profile
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([solver]),
          };
        }
        if (selectCall === 3) {
          // messages
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockResolvedValue(msgs),
          };
        }
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([]),
        };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.attempt.id).toBe('att-1');
    expect(json.challenge.title).toBe('FizzBuzz');
    expect(json.solver.name).toBe('Alice');
    expect(json.messages).toHaveLength(2);
    expect(json.stats.messageCount).toBe(2);
    expect(json.stats.modelsUsed).toEqual(['gpt-4']);
    expect(json.stats.totalCost).toBe(100);
  });

  it('skips attempts with no messages and tries next challenge', async () => {
    const attempt = { attemptId: 'att-1', userId: 'u1', totalCost: 100, inputTokens: 0, outputTokens: 0, submittedAt: 't', createdAt: 't', challengeTitle: 'T', challengeDifficulty: 'easy', challengeCategory: 'c' };
    const solver = { name: 'A', email: 'a@a.com', avatarUrl: null };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([attempt]),
          };
        }
        if (selectCall === 2) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([solver]),
          };
        }
        if (selectCall === 3) {
          // No messages -> skip
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockResolvedValue([]),
          };
        }
        // All subsequent challenges: no attempt found
        return {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    const json = await res.json();
    expect(json).toBeNull();
  });

  it('returns null on error (does not return 500 status)', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('uses email prefix as solver name when name is missing (line 86)', async () => {
    const attempt = { attemptId: 'att-1', userId: 'u1', totalCost: 100, inputTokens: 10, outputTokens: 20, submittedAt: 't', createdAt: 't', challengeTitle: 'T', challengeDifficulty: 'easy', challengeCategory: 'c' };
    const solver = { name: null, email: 'alice@test.com', avatarUrl: null };
    const msgs = [{ role: 'user', content: 'Hi', model: null, inputTokens: 5, outputTokens: 0, cost: 0, createdAt: 't', sequence: 1 }];

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([attempt]) };
        if (selectCall === 2) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([solver]) };
        if (selectCall === 3) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockResolvedValue(msgs) };
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]), orderBy: vi.fn().mockResolvedValue([]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    const json = await res.json();
    expect(json.solver.name).toBe('alice');
  });

  it('uses Anonymous as solver name when solver profile is missing (line 86)', async () => {
    const attempt = { attemptId: 'att-1', userId: 'u1', totalCost: 100, inputTokens: 10, outputTokens: 20, submittedAt: 't', createdAt: 't', challengeTitle: 'T', challengeDifficulty: 'easy', challengeCategory: 'c' };
    const msgs = [{ role: 'user', content: 'Hi', model: null, inputTokens: 5, outputTokens: 0, cost: 0, createdAt: 't', sequence: 1 }];

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([attempt]) };
        if (selectCall === 2) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }; // no solver
        if (selectCall === 3) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockResolvedValue(msgs) };
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]), orderBy: vi.fn().mockResolvedValue([]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    const json = await res.json();
    expect(json.solver.name).toBe('Anonymous');
  });

  it('correctly counts total cost from messages with null costs (line 68)', async () => {
    const attempt = { attemptId: 'att-1', userId: 'u1', totalCost: 200, inputTokens: 30, outputTokens: 40, submittedAt: 't', createdAt: 't', challengeTitle: 'T', challengeDifficulty: 'easy', challengeCategory: 'c' };
    const solver = { name: 'Bob', email: 'b@b.com', avatarUrl: null };
    const msgs = [
      { role: 'user', content: 'Hi', model: null, inputTokens: 5, outputTokens: 0, cost: null, createdAt: 't', sequence: 1 },
      { role: 'assistant', content: 'Hello', model: 'gpt-4', inputTokens: 10, outputTokens: 20, cost: 100, createdAt: 't', sequence: 2 },
    ];

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([attempt]) };
        if (selectCall === 2) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([solver]) };
        if (selectCall === 3) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockResolvedValue(msgs) };
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]), orderBy: vi.fn().mockResolvedValue([]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    const json = await res.json();
    // null cost should be treated as 0: 0 + 100 = 100
    expect(json.stats.totalCost).toBe(100);
  });
});
