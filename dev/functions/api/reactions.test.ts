/**
 * Tests for POST /api/reactions — Reaction toggle endpoint.
 *
 * Verifies authentication, input validation, toggle behavior (add/remove),
 * notification creation, and reaction count aggregation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../drizzle/schema.d1', () => ({
  reactions: { id: 'id', userId: 'user_id', targetType: 'target_type', targetId: 'target_id', emoji: 'emoji' },
  challengeComments: { id: 'id', userId: 'user_id' },
  replayComments: { id: 'id', userId: 'user_id' },
  profiles: { id: 'id', name: 'name' },
  notifications: { id: 'id', userId: 'user_id', type: 'type', title: 'title', body: 'body', metadata: 'metadata' },
}));

import { onRequestPost } from './reactions';

const FAKE_USER = { id: 'user-1', email: 'dev@ruwt.dev' };

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx(body: unknown) {
  return {
    request: new Request('https://ruwt.dev/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
  };
}

describe('POST /api/reactions', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestPost(makeCtx({ targetType: 'challenge_comment', targetId: 'cc-1', emoji: 'fire' }));
    expect(res.status).toBe(401);
    expect((await res.json() as any).error).toBe('Unauthorized');
  });

  it('returns 400 for invalid emoji', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makeCtx({ targetType: 'challenge_comment', targetId: 'cc-1', emoji: 'invalid_emoji' }));
    expect(res.status).toBe(400);
    expect((await res.json() as any).error).toBe('Invalid request');
  });

  it('returns 400 for invalid targetType', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makeCtx({ targetType: 'bad_type', targetId: 'cc-1', emoji: 'fire' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent challenge comment', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx({ targetType: 'challenge_comment', targetId: 'cc-nonexistent', emoji: 'fire' }));
    expect(res.status).toBe(404);
    expect((await res.json() as any).error).toBe('Comment not found');
  });

  it('returns 404 for non-existent replay comment', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx({ targetType: 'replay_comment', targetId: 'rc-nonexistent', emoji: 'heart' }));
    expect(res.status).toBe(404);
    expect((await res.json() as any).error).toBe('Comment not found');
  });

  it('adds reaction (toggle on) and returns updated counts', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    let selectCall = 0;
    const mockInsertValues = vi.fn().mockResolvedValue({});
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        catch: vi.fn().mockResolvedValue(undefined),
      }),
    });

    let allCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          // comment author lookup
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ userId: 'user-2' }]),
              }),
            }),
          };
        }
        // profile for notification
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ name: 'Dev' }]),
            }),
          }),
        };
      }),
      all: vi.fn().mockImplementation(() => {
        allCall++;
        if (allCall === 1) {
          // existing reaction check — none exists
          return Promise.resolve([]);
        }
        // reaction counts after toggle
        return Promise.resolve([{ emoji: 'fire', cnt: 1 }]);
      }),
      insert: mockInsert,
      delete: vi.fn(),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx({ targetType: 'challenge_comment', targetId: 'cc-1', emoji: 'fire' }));
    expect(res.status).toBe(200);

    const json = await res.json() as any;
    expect(json.action).toBe('added');
    expect(json.reactionCounts).toEqual({ fire: 1 });
  });

  it('removes reaction when already exists (toggle off)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    let allCall = 0;
    const mockDeleteWhere = vi.fn().mockResolvedValue({});

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ userId: 'user-2' }]),
          }),
        }),
      }),
      all: vi.fn().mockImplementation(() => {
        allCall++;
        if (allCall === 1) {
          // existing reaction found
          return Promise.resolve([{ id: 'r-existing' }]);
        }
        // reaction counts after removal — empty
        return Promise.resolve([]);
      }),
      delete: vi.fn().mockReturnValue({ where: mockDeleteWhere }),
      insert: vi.fn(),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx({ targetType: 'challenge_comment', targetId: 'cc-1', emoji: 'fire' }));
    expect(res.status).toBe(200);

    const json = await res.json() as any;
    expect(json.action).toBe('removed');
    expect(json.reactionCounts).toEqual({});
  });

  it('creates notification for comment author (not self)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    let selectCall = 0;
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        catch: vi.fn().mockResolvedValue(undefined),
      }),
    });

    let allCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          // comment author is different user
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ userId: 'user-other' }]),
              }),
            }),
          };
        }
        // profile for notification
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ name: 'Dev' }]),
            }),
          }),
        };
      }),
      all: vi.fn().mockImplementation(() => {
        allCall++;
        if (allCall === 1) return Promise.resolve([]); // no existing reaction
        return Promise.resolve([{ emoji: 'thumbs_up', cnt: 1 }]);
      }),
      insert: mockInsert,
      delete: vi.fn(),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx({ targetType: 'challenge_comment', targetId: 'cc-1', emoji: 'thumbs_up' }));
    expect(res.status).toBe(200);

    // insert called twice: reaction + notification
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('does not create notification for self-reaction', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    let allCall = 0;
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        catch: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            // comment author is the same user
            limit: vi.fn().mockResolvedValue([{ userId: FAKE_USER.id }]),
          }),
        }),
      }),
      all: vi.fn().mockImplementation(() => {
        allCall++;
        if (allCall === 1) return Promise.resolve([]); // no existing
        return Promise.resolve([{ emoji: 'heart', cnt: 1 }]);
      }),
      insert: mockInsert,
      delete: vi.fn(),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx({ targetType: 'challenge_comment', targetId: 'cc-1', emoji: 'heart' }));
    expect(res.status).toBe(200);

    // insert called only once for the reaction, no notification
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });

    const res = await onRequestPost(makeCtx({ targetType: 'challenge_comment', targetId: 'cc-1', emoji: 'fire' }));
    expect(res.status).toBe(500);
  });
});
