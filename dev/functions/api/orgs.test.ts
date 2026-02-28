import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../drizzle/schema.d1', () => ({
  organizations: { id: 'id', name: 'name', createdBy: 'created_by', assessmentCredits: 'assessment_credits' },
  orgMembers: { id: 'id', orgId: 'org_id', userId: 'user_id', role: 'role' },
  profiles: { id: 'id', assessmentCredits: 'assessment_credits' },
}));

import { onRequestPost, onRequestGet } from './orgs';

// ── Helpers ──────────────────────────────────────────────────────────
const FAKE_USER = { id: 'user-1', email: 'dev@ruwt.dev' };

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makePostCtx(body: unknown) {
  return {
    request: new Request('https://ruwt.dev/api/orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
  };
}

function makeGetCtx() {
  return {
    request: new Request('https://ruwt.dev/api/orgs'),
    env: makeEnv(),
  };
}

function mockDb(overrides: Record<string, any> = {}) {
  const db = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({}) }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
    }),
    ...overrides,
  };
  mockGetDb.mockReturnValue(db);
  return db;
}

// ── Tests ────────────────────────────────────────────────────────────
describe('POST /api/orgs — create organization', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestPost(makePostCtx({ name: 'Acme' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Unauthorized');
  });

  it('returns 400 when name is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockDb();
    const res = await onRequestPost(makePostCtx({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid request');
    expect(json.details).toBeDefined();
  });

  it('returns 400 when name is empty string', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockDb();
    const res = await onRequestPost(makePostCtx({ name: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockDb();
    const ctx = {
      request: new Request('https://ruwt.dev/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
      env: makeEnv(),
    };
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
  });

  it('creates org, adds creator as owner, and migrates credits on happy path', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const org = { id: 'org-1', name: 'Acme', createdBy: FAKE_USER.id };

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(),
    };
    // First select: profile credits. Second select: created org.
    selectChain.limit
      .mockResolvedValueOnce([{ assessmentCredits: 5000 }])
      .mockResolvedValueOnce([org]);

    const insertValues = vi.fn().mockResolvedValue({});
    const updateSetWhere = vi.fn().mockResolvedValue({});

    const db = {
      select: vi.fn().mockReturnValue(selectChain),
      insert: vi.fn().mockReturnValue({ values: insertValues }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: updateSetWhere }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostCtx({ name: 'Acme' }));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.id).toBe('org-1');
    expect(json.name).toBe('Acme');

    // insert called twice: org + orgMember
    expect(db.insert).toHaveBeenCalledTimes(2);
    // update called once: zero out profile credits
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('does not update credits when profile has zero credits', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(),
    };
    selectChain.limit
      .mockResolvedValueOnce([{ assessmentCredits: 0 }])
      .mockResolvedValueOnce([{ id: 'org-1', name: 'Acme' }]);

    const db = {
      select: vi.fn().mockReturnValue(selectChain),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({}) }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makePostCtx({ name: 'Acme' }));
    expect(db.update).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('DB down'); });
    const res = await onRequestPost(makePostCtx({ name: 'Acme' }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });
});

describe('GET /api/orgs — list user organizations', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(401);
  });

  it('returns orgs with member count on happy path', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const orgRow = {
      org: { id: 'org-1', name: 'Acme' },
      role: 'owner',
    };

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn(),
    };

    // First where: org membership rows. Second where: member count.
    selectChain.where
      .mockResolvedValueOnce([orgRow])
      .mockResolvedValueOnce([{ count: 3 }]);

    const db = {
      select: vi.fn().mockReturnValue(selectChain),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].id).toBe('org-1');
    expect(json[0].role).toBe('owner');
    expect(json[0].memberCount).toBe(3);
  });

  it('returns empty array when user has no orgs', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };

    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(selectChain) });

    const res = await onRequestGet(makeGetCtx());
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(500);
  });
});
