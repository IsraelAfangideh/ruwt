/**
 * Tests for GET/POST /api/attempts/:id/comments — Replay comment endpoints.
 *
 * Verifies access control for public/private replays, comment creation,
 * notification to replay owner, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../../drizzle/schema.d1', () => ({
  replayComments: { id: 'id', attemptId: 'attempt_id', userId: 'user_id', content: 'content' },
  reactions: { id: 'id', userId: 'user_id', targetType: 'target_type', targetId: 'target_id', emoji: 'emoji' },
  profiles: { id: 'id', name: 'name', username: 'username', avatarUrl: 'avatar_url' },
  attempts: { id: 'id', userId: 'user_id', replayPublic: 'replay_public', challengeId: 'challenge_id' },
  challenges: { id: 'id', title: 'title' },
  notifications: { id: 'id', userId: 'user_id', type: 'type', title: 'title', body: 'body', metadata: 'metadata' },
}));

import { onRequestGet, onRequestPost } from './comments';

const FAKE_USER = { id: 'user-1', email: 'dev@ruwt.dev' };

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeGetCtx(attemptId: string) {
  return {
    request: new Request(`https://ruwt.dev/api/attempts/${attemptId}/comments`),
    env: makeEnv(),
    params: { id: attemptId },
  };
}

function makePostCtx(attemptId: string, body: unknown) {
  return {
    request: new Request(`https://ruwt.dev/api/attempts/${attemptId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
    params: { id: attemptId },
  };
}

function mockAttemptLookup(attempt: Record<string, unknown> | null) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(attempt ? [attempt] : []),
      }),
    }),
  };
}

describe('GET /api/attempts/:id/comments', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns comments for public replay', async () => {
    mockGetUser.mockResolvedValue(null); // anonymous

    const attempt = { id: 'att-1', userId: 'user-2', replayPublic: 1, challengeId: 'ch-1' };
    const commentRows = [
      {
        id: 'rc-1', attempt_id: 'att-1', user_id: 'user-3', content: 'Nice solve!',
        created_at: '2024-01-01T00:00:00Z', name: 'Bob', username: 'bob', avatar_url: null,
      },
    ];

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return mockAttemptLookup(attempt);
        return mockAttemptLookup(null); // should not be called
      }),
      all: vi.fn().mockImplementation(() => {
        // comments query returns rows, reaction queries return empty
        return Promise.resolve(commentRows);
      }),
    };

    // Override all to return different results per call
    let allCall = 0;
    db.all = vi.fn().mockImplementation(() => {
      allCall++;
      if (allCall === 1) return Promise.resolve(commentRows);
      return Promise.resolve([]);
    });

    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetCtx('att-1'));
    expect(res.status).toBe(200);

    const json = await res.json() as any;
    expect(json.comments).toHaveLength(1);
    expect(json.comments[0].id).toBe('rc-1');
    expect(json.comments[0].user.name).toBe('Bob');
  });

  it('returns 403 for private replay (non-owner)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = { id: 'att-1', userId: 'other-user', replayPublic: 0, challengeId: 'ch-1' };
    const db = {
      select: vi.fn().mockReturnValue(mockAttemptLookup(attempt)),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetCtx('att-1'));
    expect(res.status).toBe(403);
    expect((await res.json() as any).error).toBe('Replay is private');
  });

  it('returns 404 for non-existent attempt', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const db = {
      select: vi.fn().mockReturnValue(mockAttemptLookup(null)),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetCtx('att-nonexistent'));
    expect(res.status).toBe(404);
    expect((await res.json() as any).error).toBe('Attempt not found');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(null);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });

    const res = await onRequestGet(makeGetCtx('att-1'));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/attempts/:id/comments', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestPost(makePostCtx('att-1', { content: 'Hello' }));
    expect(res.status).toBe(401);
    expect((await res.json() as any).error).toBe('Unauthorized');
  });

  it('returns 400 for invalid content', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makePostCtx('att-1', { content: '' }));
    expect(res.status).toBe(400);
    expect((await res.json() as any).error).toBe('Invalid request');
  });

  it('returns 404 for non-existent attempt', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const db = {
      select: vi.fn().mockReturnValue(mockAttemptLookup(null)),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostCtx('att-nonexistent', { content: 'Hello' }));
    expect(res.status).toBe(404);
    expect((await res.json() as any).error).toBe('Attempt not found');
  });

  it('returns 403 for private replay (non-owner)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = { id: 'att-1', userId: 'other-user', replayPublic: 0, challengeId: 'ch-1' };
    const db = {
      select: vi.fn().mockReturnValue(mockAttemptLookup(attempt)),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostCtx('att-1', { content: 'Hello' }));
    expect(res.status).toBe(403);
    expect((await res.json() as any).error).toBe('Replay is private');
  });

  it('creates comment and notifies replay owner', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = { id: 'att-1', userId: 'user-2', replayPublic: 1, challengeId: 'ch-1' };
    let selectCall = 0;
    const mockInsertValues = vi.fn().mockResolvedValue({});
    const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          // attempt lookup
          return mockAttemptLookup(attempt);
        }
        if (selectCall === 2) {
          // profile for notification
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ name: 'Dev' }]),
              }),
            }),
          };
        }
        if (selectCall === 3) {
          // challenge title for notification
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ title: 'Test Challenge' }]),
              }),
            }),
          };
        }
        // profile for response
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ name: 'Dev', username: 'dev', avatarUrl: null }]),
            }),
          }),
        };
      }),
      insert: mockInsert,
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostCtx('att-1', { content: 'Great solve!' }));
    expect(res.status).toBe(201);

    const json = await res.json() as any;
    expect(json.comment.content).toBe('Great solve!');
    expect(json.comment.user.name).toBe('Dev');

    // insert called twice: once for comment, once for notification
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('does not notify when commenter is replay owner', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const attempt = { id: 'att-1', userId: FAKE_USER.id, replayPublic: 1, challengeId: 'ch-1' };
    let selectCall = 0;
    const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({}) });

    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return mockAttemptLookup(attempt);
        // profile for response
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ name: 'Dev', username: 'dev', avatarUrl: null }]),
            }),
          }),
        };
      }),
      insert: mockInsert,
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostCtx('att-1', { content: 'My own replay' }));
    expect(res.status).toBe(201);

    // insert called only once for the comment (no notification)
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });

    const res = await onRequestPost(makePostCtx('att-1', { content: 'test' }));
    expect(res.status).toBe(500);
  });
});
