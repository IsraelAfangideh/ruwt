import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/db', () => ({ getDb: mockGetDb }));

import { onRequestPost, onRequestGet } from './replay';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = { id: 'user-123', email: 'candidate@test.com' };

function makeEnv(bucketOverrides?: Record<string, unknown>): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
    PROJECTS_BUCKET: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      ...bucketOverrides,
    } as unknown as R2Bucket,
  } as Env;
}

function makePostContext(body: unknown, envOverrides?: Partial<Env>) {
  return {
    request: new Request('https://ruwt.dev/api/assess/takehome/replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: { ...makeEnv(), ...envOverrides } as Env,
  };
}

function makeGetContext(sessionId: string, envOverrides?: Partial<Env>) {
  return {
    request: new Request(`https://ruwt.dev/api/assess/takehome/replay?sessionId=${sessionId}`),
    env: { ...makeEnv(), ...envOverrides } as Env,
  };
}

const validEvents = [
  { type: 'content_snapshot', timestamp: 100, data: { path: 'index.js', content: 'code' } },
  { type: 'file_open', timestamp: 200, data: { path: 'index.js' } },
];

// ── POST Tests ─────────────────────────────────────────────────────

describe('POST /api/assess/takehome/replay', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestPost(makePostContext({ sessionId: 'x', events: validEvents }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when body is invalid', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const res = await onRequestPost(makePostContext({ bad: true }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when events array is empty', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const res = await onRequestPost(makePostContext({ sessionId: 'x', events: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when session not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({ sessionId: 'x', events: validEvents }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when session is not in progress', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const session = { id: 'sess-1', userId: 'user-123', status: 'completed', replayR2Key: null };
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([session]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({ sessionId: 'sess-1', events: validEvents }));
    expect(res.status).toBe(400);
  });

  it('returns 500 when PROJECTS_BUCKET is not configured', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const session = { id: 'sess-1', userId: 'user-123', status: 'in_progress', replayR2Key: null };
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([session]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const ctx = makePostContext({ sessionId: 'sess-1', events: validEvents });
    (ctx.env as any).PROJECTS_BUCKET = undefined;

    const res = await onRequestPost(ctx);
    expect(res.status).toBe(500);
  });

  it('appends events to R2 and returns event count', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const session = { id: 'sess-1', userId: 'user-123', status: 'in_progress', replayR2Key: null };
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([session]);
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const mockBucket = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const ctx = makePostContext({ sessionId: 'sess-1', events: validEvents });
    (ctx.env as any).PROJECTS_BUCKET = mockBucket;

    const res = await onRequestPost(ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.eventCount).toBe(2);
    expect(mockBucket.put).toHaveBeenCalledWith(
      'replay/sess-1/events.json',
      expect.any(String),
    );
    // Should update replayR2Key since it was null
    expect(db.update).toHaveBeenCalled();
  });

  it('appends to existing R2 events', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const session = { id: 'sess-1', userId: 'user-123', status: 'in_progress', replayR2Key: 'replay/sess-1/events.json' };
    const existingEvents = [{ type: 'file_open', timestamp: 50, data: { path: 'old.js' } }];

    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([session]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const mockBucket = {
      get: vi.fn().mockResolvedValue({ text: () => Promise.resolve(JSON.stringify(existingEvents)) }),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const ctx = makePostContext({ sessionId: 'sess-1', events: validEvents });
    (ctx.env as any).PROJECTS_BUCKET = mockBucket;

    const res = await onRequestPost(ctx);
    const json = await res.json();

    expect(json.eventCount).toBe(3); // 1 existing + 2 new

    const writtenData = JSON.parse(mockBucket.put.mock.calls[0][1]);
    expect(writtenData).toHaveLength(3);
    expect(writtenData[0].data.path).toBe('old.js');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestPost(makePostContext({ sessionId: 'x', events: validEvents }));
    expect(res.status).toBe(500);
  });
});

// ── GET Tests ──────────────────────────────────────────────────────

describe('GET /api/assess/takehome/replay', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestGet(makeGetContext('sess-1'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when sessionId is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const ctx = {
      request: new Request('https://ruwt.dev/api/assess/takehome/replay'),
      env: makeEnv(),
    };
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 404 when session not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not session owner and not org admin', async () => {
    mockGetUser.mockResolvedValue({ id: 'other-user', email: 'other@test.com' });
    const session = { id: 'sess-1', userId: 'user-123', assessmentId: 'assess-1', replayR2Key: null };
    const assessment = { id: 'assess-1', orgId: 'org-1' };
    const nonAdminMember = { role: 'viewer' };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([session]);
        if (currentCall === 2) return Promise.resolve([assessment]);
        if (currentCall === 3) return Promise.resolve([nonAdminMember]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext('sess-1'));
    expect(res.status).toBe(403);
  });

  it('returns events for session owner', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const session = { id: 'sess-1', userId: 'user-123', assessmentId: 'assess-1', replayR2Key: 'replay/sess-1/events.json' };
    const storedEvents = [
      { type: 'file_open', timestamp: 100, data: { path: 'a.js' } },
    ];

    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([session]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const mockBucket = {
      get: vi.fn().mockResolvedValue({ text: () => Promise.resolve(JSON.stringify(storedEvents)) }),
    };
    const ctx = makeGetContext('sess-1');
    (ctx.env as any).PROJECTS_BUCKET = mockBucket;

    const res = await onRequestGet(ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.events).toHaveLength(1);
    expect(json.events[0].data.path).toBe('a.js');
  });

  it('returns events for org admin', async () => {
    mockGetUser.mockResolvedValue({ id: 'admin-user', email: 'admin@test.com' });
    const session = { id: 'sess-1', userId: 'user-123', assessmentId: 'assess-1', replayR2Key: 'replay/sess-1/events.json' };
    const assessment = { id: 'assess-1', orgId: 'org-1' };
    const adminMember = { role: 'admin' };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([session]);
        if (currentCall === 2) return Promise.resolve([assessment]);
        if (currentCall === 3) return Promise.resolve([adminMember]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const mockBucket = {
      get: vi.fn().mockResolvedValue({ text: () => Promise.resolve('[]') }),
    };
    const ctx = makeGetContext('sess-1');
    (ctx.env as any).PROJECTS_BUCKET = mockBucket;

    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);
  });

  it('returns events for org owner', async () => {
    mockGetUser.mockResolvedValue({ id: 'owner-user', email: 'owner@test.com' });
    const session = { id: 'sess-1', userId: 'user-123', assessmentId: 'assess-1', replayR2Key: null };
    const assessment = { id: 'assess-1', orgId: 'org-1' };
    const ownerMember = { role: 'owner' };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([session]);
        if (currentCall === 2) return Promise.resolve([assessment]);
        if (currentCall === 3) return Promise.resolve([ownerMember]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const mockBucket = {
      get: vi.fn().mockResolvedValue(null),
    };
    const ctx = makeGetContext('sess-1');
    (ctx.env as any).PROJECTS_BUCKET = mockBucket;

    const res = await onRequestGet(ctx);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.events).toEqual([]);
  });

  it('returns empty events when PROJECTS_BUCKET is not configured', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const session = { id: 'sess-1', userId: 'user-123', assessmentId: 'assess-1', replayR2Key: null };
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([session]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const ctx = makeGetContext('sess-1');
    (ctx.env as any).PROJECTS_BUCKET = undefined;

    const res = await onRequestGet(ctx);
    const json = await res.json();
    expect(json.events).toEqual([]);
  });

  it('returns 403 when assessment has no org and user is not owner', async () => {
    mockGetUser.mockResolvedValue({ id: 'other-user', email: 'other@test.com' });
    const session = { id: 'sess-1', userId: 'user-123', assessmentId: 'assess-1', replayR2Key: null };
    const assessment = { id: 'assess-1', orgId: null };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([session]);
        if (currentCall === 2) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext('sess-1'));
    expect(res.status).toBe(403);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeGetContext('sess-1'));
    expect(res.status).toBe(500);
  });
});
