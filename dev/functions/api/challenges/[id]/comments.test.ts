/**
 * Tests for GET/POST /api/challenges/:id/comments — Challenge comment endpoints.
 *
 * Verifies listing comments with reactions, creating comments with auto-populated
 * solveCost, reply notifications, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../../drizzle/schema.d1', () => ({
  challengeComments: { id: 'id', challengeId: 'challenge_id', userId: 'user_id', content: 'content', solveCost: 'solve_cost', parentId: 'parent_id' },
  reactions: { id: 'id', userId: 'user_id', targetType: 'target_type', targetId: 'target_id', emoji: 'emoji' },
  profiles: { id: 'id', name: 'name', username: 'username', avatarUrl: 'avatar_url' },
  attempts: { userId: 'user_id', challengeId: 'challenge_id', status: 'status', totalCost: 'total_cost' },
  challenges: { id: 'id', title: 'title' },
  notifications: { id: 'id', userId: 'user_id', type: 'type', title: 'title', body: 'body', metadata: 'metadata' },
}));

import { onRequestGet, onRequestPost } from './comments';

const FAKE_USER = { id: 'user-1', email: 'dev@ruwt.dev' };

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeGetCtx(challengeId: string, params = '') {
  return {
    request: new Request(`https://ruwt.dev/api/challenges/${challengeId}/comments${params}`),
    env: makeEnv(),
    params: { id: challengeId },
  };
}

function makePostCtx(challengeId: string, body: unknown) {
  return {
    request: new Request(`https://ruwt.dev/api/challenges/${challengeId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
    params: { id: challengeId },
  };
}

describe('GET /api/challenges/:id/comments', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns comments with user info and reactions', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const commentRows = [
      {
        id: 'cc-1', challenge_id: 'ch-1', user_id: 'user-2', content: 'Great challenge!',
        solve_cost: 150, parent_id: null, created_at: '2024-01-01T00:00:00Z',
        name: 'Alice', username: 'alice', avatar_url: 'https://img.test/alice.png',
      },
    ];
    const reactionRows = [{ target_id: 'cc-1', emoji: 'fire', cnt: 3 }];
    const userReactions = [{ target_id: 'cc-1', emoji: 'fire' }];
    const countRow = [{ cnt: 1 }];

    let allCall = 0;
    const db = {
      all: vi.fn().mockImplementation(() => {
        allCall++;
        if (allCall === 1) return Promise.resolve(commentRows);
        if (allCall === 2) return Promise.resolve(reactionRows);
        if (allCall === 3) return Promise.resolve(userReactions);
        return Promise.resolve(countRow);
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetCtx('ch-1'));
    expect(res.status).toBe(200);

    const json = await res.json() as any;
    expect(json.comments).toHaveLength(1);
    expect(json.comments[0].id).toBe('cc-1');
    expect(json.comments[0].user.name).toBe('Alice');
    expect(json.comments[0].reactions).toEqual({ fire: 3 });
    expect(json.comments[0].userReaction).toBe('fire');
    expect(json.total).toBe(1);
  });

  it('returns empty array for challenge with no comments', async () => {
    mockGetUser.mockResolvedValue(null);

    let allCall = 0;
    const db = {
      all: vi.fn().mockImplementation(() => {
        allCall++;
        if (allCall === 1) return Promise.resolve([]);
        // count query
        return Promise.resolve([{ cnt: 0 }]);
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetCtx('ch-empty'));
    expect(res.status).toBe(200);

    const json = await res.json() as any;
    expect(json.comments).toEqual([]);
    expect(json.total).toBe(0);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(null);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });

    const res = await onRequestGet(makeGetCtx('ch-1'));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/challenges/:id/comments', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestPost(makePostCtx('ch-1', { content: 'Hello' }));
    expect(res.status).toBe(401);
    expect((await res.json() as any).error).toBe('Unauthorized');
  });

  it('returns 400 for invalid content (empty string)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makePostCtx('ch-1', { content: '' }));
    expect(res.status).toBe(400);
    expect((await res.json() as any).error).toBe('Invalid request');
  });

  it('returns 404 for non-existent challenge', async () => {
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

    const res = await onRequestPost(makePostCtx('ch-nonexistent', { content: 'Hello' }));
    expect(res.status).toBe(404);
    expect((await res.json() as any).error).toBe('Challenge not found');
  });

  it('creates comment with auto-populated solveCost', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    let selectCall = 0;
    const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({}) });

    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          // challenge lookup
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: 'ch-1', title: 'Test Challenge' }]),
              }),
            }),
          };
        }
        // profile lookup (last select)
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ name: 'Dev', username: 'dev', avatarUrl: null }]),
            }),
          }),
        };
      }),
      all: vi.fn().mockResolvedValue([{ total_cost: 200 }]),
      insert: mockInsert,
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostCtx('ch-1', { content: 'Nice one!' }));
    expect(res.status).toBe(201);

    const json = await res.json() as any;
    expect(json.comment.content).toBe('Nice one!');
    expect(json.comment.solveCost).toBe(200);
    expect(json.comment.user.name).toBe('Dev');
    expect(json.comment.reactions).toEqual({});
  });

  it('creates notification for parent comment reply', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    let selectCall = 0;
    const mockInsertValues = vi.fn().mockResolvedValue({});
    const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          // challenge lookup
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: 'ch-1', title: 'Test Challenge' }]),
              }),
            }),
          };
        }
        if (selectCall === 2) {
          // parent comment lookup
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: 'parent-1', userId: 'user-2' }]),
              }),
            }),
          };
        }
        if (selectCall === 3) {
          // profile for notification body
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ name: 'Dev' }]),
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
      all: vi.fn().mockResolvedValue([]),
      insert: mockInsert,
    };
    mockGetDb.mockReturnValue(db);

    const parentId = '550e8400-e29b-41d4-a716-446655440000';
    const res = await onRequestPost(makePostCtx('ch-1', { content: 'Replying!', parentId }));
    expect(res.status).toBe(201);

    // insert called twice: once for notification, once for comment
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('returns 201 with comment object', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: 'ch-1', title: 'T' }]),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ name: 'Test', username: 'test', avatarUrl: null }]),
            }),
          }),
        };
      }),
      all: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({}) }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostCtx('ch-1', { content: 'Hello world' }));
    expect(res.status).toBe(201);

    const json = await res.json() as any;
    expect(json.comment).toBeDefined();
    expect(json.comment.id).toBeDefined();
    expect(json.comment.content).toBe('Hello world');
    expect(json.comment.parentId).toBeNull();
    expect(json.comment.userReaction).toBeNull();
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });

    const res = await onRequestPost(makePostCtx('ch-1', { content: 'test' }));
    expect(res.status).toBe(500);
  });
});
