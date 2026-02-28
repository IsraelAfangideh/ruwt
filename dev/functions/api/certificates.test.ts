import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../drizzle/schema.d1', () => ({
  certificates: { id: 'id', userId: 'user_id', type: 'type', title: 'title', metadata: 'metadata', shareToken: 'share_token', earnedAt: 'earned_at' },
  attempts: { userId: 'user_id', challengeId: 'challenge_id', status: 'status', totalCost: 'total_cost' },
  challenges: { id: 'id', category: 'category', language: 'language' },
  profiles: {},
}));

import { onRequestGet, onRequestPost } from './certificates';

const FAKE_USER = { id: 'user-1', email: 'dev@ruwt.dev' };

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeGetCtx() {
  return { request: new Request('https://ruwt.dev/api/certificates'), env: makeEnv() };
}

function makePostCtx() {
  return {
    request: new Request('https://ruwt.dev/api/certificates', { method: 'POST' }),
    env: makeEnv(),
  };
}

describe('GET /api/certificates', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(401);
  });

  it('returns certificates with parsed metadata on happy path', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const certs = [
      { id: 'c-1', userId: 'user-1', type: 'track_completion', title: 'QA Master', metadata: '{"track":"qa_master"}', shareToken: 'abc', earnedAt: '2024-01-01' },
      { id: 'c-2', userId: 'user-1', type: 'track_completion', title: 'Python Prof', metadata: null, shareToken: 'def', earnedAt: '2024-02-01' },
    ];
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(certs),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestGet(makeGetCtx());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.certificates).toHaveLength(2);
    expect(json.certificates[0].metadata).toEqual({ track: 'qa_master' });
    expect(json.certificates[1].metadata).toBeNull();
  });

  it('handles invalid JSON in metadata gracefully', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const certs = [{ id: 'c-1', metadata: '{bad json', title: 'T' }];
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(certs),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestGet(makeGetCtx());
    const json = await res.json();
    expect(json.certificates[0].metadata).toBeNull();
  });

  it('returns 500 on error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(500);
  });
});

describe('POST /api/certificates (check & award)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestPost(makePostCtx());
    expect(res.status).toBe(401);
  });

  it('returns awarded list and checked count on happy path with no existing certs', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    // Simulate: user has passed all qa_testing challenges, but no existing certs
    const passedAttempts = [
      { challengeId: 'ch-qa-1', totalCost: 500 },
      { challengeId: 'ch-qa-2', totalCost: 800 },
    ];
    const allChallenges = [
      { id: 'ch-qa-1', category: 'qa_testing', language: 'javascript' },
      { id: 'ch-qa-2', category: 'qa_testing', language: 'javascript' },
      { id: 'ch-py-1', category: 'backend_api', language: 'python' },
    ];

    let selectCallCount = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // passedAttempts: select().from().where() -> array
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(passedAttempts),
            }),
          };
        }
        if (selectCallCount === 2) {
          // allChallenges: select().from() -> array (no where)
          return {
            from: vi.fn().mockResolvedValue(allChallenges),
          };
        }
        // Existing cert check: select().from().where().limit() -> []
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
      }),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({}) }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostCtx());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.checked).toBe(6); // 6 tracks defined
    expect(json.awarded).toContain('QA Testing Master');
  });

  it('skips tracks where user already has the cert', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const passedAttempts = [{ challengeId: 'ch-qa-1', totalCost: 500 }];
    const allChallenges = [{ id: 'ch-qa-1', category: 'qa_testing', language: 'javascript' }];

    let selectCallCount = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(passedAttempts),
            }),
          };
        }
        if (selectCallCount === 2) {
          return {
            from: vi.fn().mockResolvedValue(allChallenges),
          };
        }
        // Existing cert found for all tracks
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'existing-cert' }]),
            }),
          }),
        };
      }),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({}) }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostCtx());
    const json = await res.json();
    expect(json.awarded).toEqual([]);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestPost(makePostCtx());
    expect(res.status).toBe(500);
  });
});
