import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb, mockEnsureProfile } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockEnsureProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../../_shared/ensure-profile', () => ({ ensureProfile: mockEnsureProfile }));
vi.mock('../../_shared/ai/ai-pricing', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return actual;
});

import { onRequestPost, onRequestGet } from './matches';

const USER = { id: 'user-1', email: 'dev@ruwt.dev' };
const MODEL = '@cf/meta/llama-3.1-8b-instruct';

function env(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'x', VITE_SUPABASE_ANON_KEY: 'y' } as Env;
}

function postCtx(body: unknown) {
  return {
    request: new Request('https://ruwt.dev/api/versus/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: env(),
  };
}

function getCtx(qs: string) {
  return {
    request: new Request(`https://ruwt.dev/api/versus/matches${qs}`),
    env: env(),
  };
}

describe('POST /api/versus/matches', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockEnsureProfile.mockReset().mockResolvedValue(undefined);
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestPost(postCtx({ challengeId: 'c1', model: MODEL }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for unknown model', async () => {
    mockGetUser.mockResolvedValue(USER);
    const res = await onRequestPost(postCtx({ challengeId: 'c1', model: 'nope' }));
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('Unknown model');
  });

  it('creates a versus attempt and match', async () => {
    mockGetUser.mockResolvedValue(USER);
    const challenge = {
      id: 'c1',
      title: 'Fizz',
      description: 'd',
      difficulty: 'easy',
      starterCode: 'function solve() {}',
      testCases: '[{"input":"1","expectedOutput":"1"}]',
      hiddenTestCases: null,
      wallClockLimit: null,
    };
    const attempt = { id: 'a1', userId: USER.id, playMode: 'versus', status: 'in_progress' };
    const match = {
      id: 'm1',
      userId: USER.id,
      challengeId: 'c1',
      userAttemptId: 'a1',
      opponentModel: MODEL,
      opponentStatus: 'queued',
      opponentThinking: '',
      opponentIteration: 0,
      opponentCost: 0,
      opponentInputTokens: 0,
      opponentOutputTokens: 0,
      userPassedAt: null,
      opponentPassedAt: null,
      winner: null,
      createdAt: '2026-08-29T00:00:00.000Z',
      finishedAt: null,
    };

    let selectCall = 0;
    const insertValues = vi.fn().mockResolvedValue(undefined);
    mockGetDb.mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCall++;
              if (selectCall === 1) return Promise.resolve([challenge]);
              if (selectCall === 2) return Promise.resolve([]);
              if (selectCall === 3) return Promise.resolve([attempt]);
              return Promise.resolve([match]);
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    });

    const res = await onRequestPost(postCtx({ challengeId: 'c1', model: MODEL }));
    const json = await res.json() as any;
    expect(res.status).toBe(200);
    expect(json.isExisting).toBe(false);
    expect(json.match.opponentModel).toBe(MODEL);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ playMode: 'versus' }));
  });

  it('resumes an in-progress versus match', async () => {
    mockGetUser.mockResolvedValue(USER);
    const challenge = { id: 'c1', testCases: '[]', hiddenTestCases: null, wallClockLimit: null };
    const existingAttempt = { id: 'a1', status: 'in_progress', playMode: 'versus' };
    const existingMatch = {
      id: 'm1',
      userId: USER.id,
      challengeId: 'c1',
      userAttemptId: 'a1',
      opponentModel: MODEL,
      opponentStatus: 'thinking',
      opponentThinking: 'hmm',
      opponentIteration: 0,
      opponentCost: 0,
      opponentInputTokens: 0,
      opponentOutputTokens: 0,
      winner: null,
      createdAt: '2026-08-29T00:00:00.000Z',
      finishedAt: null,
    };
    let selectCall = 0;
    mockGetDb.mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCall++;
              if (selectCall === 1) return Promise.resolve([challenge]);
              if (selectCall === 2) return Promise.resolve([existingAttempt]);
              return Promise.resolve([existingMatch]);
            }),
          }),
        }),
      }),
    });

    const res = await onRequestPost(postCtx({ challengeId: 'c1', model: MODEL }));
    const json = await res.json() as any;
    expect(res.status).toBe(200);
    expect(json.isExisting).toBe(true);
    expect(json.match.id).toBe('m1');
  });
});

describe('GET /api/versus/matches', () => {
  it('requires challengeId', async () => {
    mockGetUser.mockResolvedValue(USER);
    const res = await onRequestGet(getCtx(''));
    expect(res.status).toBe(400);
  });

  it('returns null when no live match', async () => {
    mockGetUser.mockResolvedValue(USER);
    mockGetDb.mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });
    const res = await onRequestGet(getCtx('?challengeId=c1'));
    expect(res.status).toBe(200);
    expect((await res.json() as { match: null }).match).toBeNull();
  });
});
