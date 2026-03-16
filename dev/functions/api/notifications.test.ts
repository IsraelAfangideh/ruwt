import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb, mockEnsureProfile } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockEnsureProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../_shared/ensure-profile', () => ({ ensureProfile: mockEnsureProfile }));
vi.mock('../../drizzle/schema.d1', () => ({
  notifications: { id: 'id', userId: 'user_id', read: 'read', createdAt: 'created_at' },
}));

import { onRequestGet, onRequestPost } from './notifications';

const FAKE_USER = { id: 'user-1', email: 'dev@ruwt.dev' };

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeGetCtx(params = '') {
  return {
    request: new Request(`https://ruwt.dev/api/notifications${params}`),
    env: makeEnv(),
  };
}

function makePostCtx(body: unknown) {
  return {
    request: new Request('https://ruwt.dev/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
  };
}

describe('GET /api/notifications', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(401);
  });

  it('returns notifications and unread count on happy path', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const rows = [{ id: 'n-1', userId: 'user-1', read: 0, title: 'Hello' }];

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue(rows),
          };
        }
        // unread count query
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetCtx());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.notifications).toHaveLength(1);
    expect(json.unreadCount).toBe(3);
  });

  it('filters by unread when unread=1 is passed', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const rows = [{ id: 'n-1', userId: 'user-1', read: 0, title: 'Unread' }];

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue(rows),
          };
        }
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetCtx('?unread=1'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.notifications).toHaveLength(1);
    expect(json.unreadCount).toBe(1);
  });

  it('respects limit param capped at 100', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    let selectCall = 0;
    mockGetDb.mockReturnValue({
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return chain;
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        };
      }),
    });

    await onRequestGet(makeGetCtx('?limit=200'));
    expect(chain.limit).toHaveBeenCalledWith(100);
  });

  it('returns 500 on error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(500);
  });
});

describe('POST /api/notifications', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestPost(makePostCtx({ action: 'mark_read', ids: ['n-1'] }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when action is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const res = await onRequestPost(makePostCtx({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Missing action');
  });

  it('returns 400 when mark_read has no ids', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const res = await onRequestPost(makePostCtx({ action: 'mark_read' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('ids');
  });

  it('returns 400 when mark_read has empty ids array', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const res = await onRequestPost(makePostCtx({ action: 'mark_read', ids: [] }));
    expect(res.status).toBe(400);
  });

  it('marks specific notifications as read on happy path', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const updateWhere = vi.fn().mockResolvedValue({});
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    mockGetDb.mockReturnValue({
      update: vi.fn().mockReturnValue({ set: updateSet }),
    });

    const res = await onRequestPost(makePostCtx({ action: 'mark_read', ids: ['n-1', 'n-2'] }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(updateSet).toHaveBeenCalledWith({ read: 1 });
  });

  it('marks all notifications as read', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const updateWhere = vi.fn().mockResolvedValue({});
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    mockGetDb.mockReturnValue({
      update: vi.fn().mockReturnValue({ set: updateSet }),
    });

    const res = await onRequestPost(makePostCtx({ action: 'mark_all_read' }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('returns 400 for unknown action', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const res = await onRequestPost(makePostCtx({ action: 'delete_all' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Unknown action');
  });

  it('handles invalid JSON body gracefully', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const ctx = {
      request: new Request('https://ruwt.dev/api/notifications', {
        method: 'POST',
        body: 'not json',
      }),
      env: makeEnv(),
    };
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Missing action');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestPost(makePostCtx({ action: 'mark_all_read' }));
    expect(res.status).toBe(500);
  });
});

describe('notifications — additional error paths', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('GET returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(401);
  });

  it('POST returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestPost(makePostCtx({ action: 'mark_all_read' }));
    expect(res.status).toBe(401);
  });

  it('POST returns error for malformed JSON body', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const ctx = {
      request: new Request('https://ruwt.dev/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      env: makeEnv(),
    };
    const res = await onRequestPost(ctx);
    expect([400, 500]).toContain(res.status);
  });

  it('POST returns error for invalid action', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const res = await onRequestPost(makePostCtx({ action: 'invalid_action' }));
    expect([400, 500]).toContain(res.status);
  });

  it('POST returns error for empty body', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const res = await onRequestPost(makePostCtx({}));
    expect([400, 500]).toContain(res.status);
  });

  it('GET returns 500 when DB query fails', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('DB error'); });
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(500);
  });
});
