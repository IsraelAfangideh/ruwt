import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../../drizzle/schema.d1', () => ({
  attempts: { id: 'id', userId: 'user_id', challengeId: 'challenge_id', status: 'status', totalCost: 'total_cost', inputTokens: 'input_tokens', outputTokens: 'output_tokens', replayPublic: 'replay_public', submittedAt: 'submitted_at', createdAt: 'created_at' },
  attemptMessages: { attemptId: 'attempt_id', sequence: 'sequence', role: 'role', content: 'content', model: 'model', inputTokens: 'input_tokens', outputTokens: 'output_tokens', cost: 'cost', createdAt: 'created_at' },
  profiles: { id: 'id', name: 'name', email: 'email', avatarUrl: 'avatar_url' },
  challenges: { id: 'id', title: 'title', difficulty: 'difficulty', category: 'category' },
}));

import { onRequestGet } from './replay';

const FAKE_USER = { id: 'user-1', email: 'dev@ruwt.dev' };

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx(attemptId: string) {
  return {
    request: new Request(`https://ruwt.dev/api/attempts/${attemptId}/replay`),
    env: makeEnv(),
    params: { id: attemptId },
  };
}

describe('GET /api/attempts/:id/replay', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 404 when attempt not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestGet(makeCtx('att-999'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Attempt not found');
  });

  it('returns 403 when non-owner accesses non-public replay', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const attempt = {
      id: 'att-1', userId: 'other-user', challengeId: 'ch-1',
      status: 'passed', totalCost: 500, inputTokens: 100, outputTokens: 200,
      replayPublic: 0, submittedAt: '2024-01-01', createdAt: '2024-01-01',
      challengeTitle: 'T', challengeDifficulty: 'easy', challengeCategory: 'c',
    };
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([attempt]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestGet(makeCtx('att-1'));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Replay not available');
  });

  it('returns 403 when non-owner accesses non-passed public replay', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const attempt = {
      id: 'att-1', userId: 'other-user', challengeId: 'ch-1',
      status: 'failed', totalCost: 500, inputTokens: 100, outputTokens: 200,
      replayPublic: 1, submittedAt: '2024-01-01', createdAt: '2024-01-01',
      challengeTitle: 'T', challengeDifficulty: 'easy', challengeCategory: 'c',
    };
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([attempt]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestGet(makeCtx('att-1'));
    expect(res.status).toBe(403);
  });

  it('allows owner to view their own replay even if not public', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const attempt = {
      id: 'att-1', userId: FAKE_USER.id, challengeId: 'ch-1',
      status: 'failed', totalCost: 500, inputTokens: 100, outputTokens: 200,
      replayPublic: 0, submittedAt: '2024-01-01', createdAt: '2024-01-01',
      challengeTitle: 'Fizz', challengeDifficulty: 'easy', challengeCategory: 'prompt_efficiency',
    };
    const solver = { name: 'Dev', email: 'dev@ruwt.dev', avatarUrl: null };
    const msgs = [
      { role: 'user', content: 'Help', model: null, inputTokens: 10, outputTokens: 0, cost: 0, createdAt: '2024-01-01', sequence: 1 },
    ];

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([attempt]),
          };
        }
        if (selectCall === 2) {
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([solver]) };
        }
        // messages
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue(msgs),
        };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('att-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.attempt.id).toBe('att-1');
    expect(json.solver.name).toBe('Dev');
    expect(json.messages).toHaveLength(1);
  });

  it('allows anonymous user to view public passed replay', async () => {
    mockGetUser.mockResolvedValue(null); // no auth
    const attempt = {
      id: 'att-1', userId: 'other-user', challengeId: 'ch-1',
      status: 'passed', totalCost: 500, inputTokens: 100, outputTokens: 200,
      replayPublic: 1, submittedAt: '2024-01-01', createdAt: '2024-01-01',
      challengeTitle: 'Fizz', challengeDifficulty: 'easy', challengeCategory: 'c',
    };
    const solver = { name: null, email: 'other@x.com', avatarUrl: null };
    const msgs = [
      { role: 'assistant', content: 'OK', model: 'gpt-4', inputTokens: 5, outputTokens: 10, cost: 50, createdAt: 't', sequence: 1 },
    ];

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([attempt]),
          };
        }
        if (selectCall === 2) {
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([solver]) };
        }
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue(msgs),
        };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('att-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.solver.name).toBe('other');
    expect(json.stats.modelsUsed).toEqual(['gpt-4']);
    expect(json.stats.totalCost).toBe(50);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeCtx('att-1'));
    expect(res.status).toBe(500);
  });
});
