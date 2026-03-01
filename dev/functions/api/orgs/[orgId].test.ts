import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb, mockGetUserOrgRole, mockRequireOrgAccess, mockRequireTeamAccount } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockGetUserOrgRole: vi.fn(),
  mockRequireOrgAccess: vi.fn(),
  mockRequireTeamAccount: vi.fn(),
}));

vi.mock('../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../_shared/org', () => ({
  getUserOrgRole: mockGetUserOrgRole,
  requireOrgAccess: mockRequireOrgAccess,
  requireTeamAccount: mockRequireTeamAccount,
}));
vi.mock('../../../drizzle/schema.d1', () => ({
  organizations: { id: 'id', name: 'name' },
  orgMembers: { id: 'id', orgId: 'org_id', userId: 'user_id', role: 'role', joinedAt: 'joined_at' },
  profiles: { id: 'id', name: 'name', email: 'email', avatarUrl: 'avatar_url' },
}));

import { onRequestGet, onRequestPut } from './[orgId]';

const FAKE_USER = { id: 'user-1', email: 'dev@ruwt.dev' };
const ORG_ID = 'org-1';

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeGetCtx() {
  return {
    request: new Request(`https://ruwt.dev/api/orgs/${ORG_ID}`),
    env: makeEnv(),
    params: { orgId: ORG_ID },
  };
}

function makePutCtx(body: unknown) {
  return {
    request: new Request(`https://ruwt.dev/api/orgs/${ORG_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
    params: { orgId: ORG_ID },
  };
}

function setupDb(overrides: Record<string, any> = {}) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
  const db = {
    select: vi.fn().mockReturnValue(selectChain),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
    }),
  };
  mockGetDb.mockReturnValue(db);
  return { db, selectChain };
}

describe('GET /api/orgs/:orgId', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireTeamAccount.mockResolvedValue(null);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not team account (GET)', async () => {
    mockRequireTeamAccount.mockResolvedValue(
      Response.json({ error: 'Team account required', code: 'TEAM_REQUIRED' }, { status: 403 })
    );
    mockGetUser.mockResolvedValue(FAKE_USER);

    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(403);
  });

  it('returns 403 when user is not a member', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetUserOrgRole.mockResolvedValue(null);
    setupDb();
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Not a member of this organization');
  });

  it('returns 404 when org does not exist', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetUserOrgRole.mockResolvedValue('member');
    const { selectChain } = setupDb();
    // First limit: org not found. Second would be members but never reached.
    selectChain.limit.mockResolvedValueOnce([]);
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(404);
  });

  it('returns org with members on happy path', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetUserOrgRole.mockResolvedValue('owner');

    const org = { id: ORG_ID, name: 'Acme' };
    const members = [
      { id: 'm-1', userId: 'user-1', role: 'owner', joinedAt: '2024-01-01', name: 'Dev', email: 'dev@ruwt.dev', avatarUrl: null },
    ];

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn(),
      limit: vi.fn(),
    };
    // First call: select().from(orgs).where().limit() -> org
    selectChain.limit.mockResolvedValueOnce([org]);
    // Second call: select().from(orgMembers).innerJoin().where() -> members
    selectChain.where.mockReturnValueOnce(selectChain).mockResolvedValueOnce(members);

    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(selectChain) });

    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(ORG_ID);
    expect(json.name).toBe('Acme');
    expect(json.members).toHaveLength(1);
    expect(json.members[0].role).toBe('owner');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    mockGetUserOrgRole.mockResolvedValue('member');
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/orgs/:orgId', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireTeamAccount.mockResolvedValue(null);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestPut(makePutCtx({ name: 'New Name' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not team account (PUT)', async () => {
    mockRequireTeamAccount.mockResolvedValue(
      Response.json({ error: 'Team account required', code: 'TEAM_REQUIRED' }, { status: 403 })
    );
    mockGetUser.mockResolvedValue(FAKE_USER);

    const res = await onRequestPut(makePutCtx({ name: 'New Name' }));
    expect(res.status).toBe(403);
  });

  it('returns 403 when user lacks admin role', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue(null);
    setupDb();
    const res = await onRequestPut(makePutCtx({ name: 'New Name' }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Insufficient permissions');
  });

  it('returns 400 when no valid fields to update', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    setupDb();
    const res = await onRequestPut(makePutCtx({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('No valid fields to update');
  });

  it('returns 400 for invalid request body', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    setupDb();
    const res = await onRequestPut(makePutCtx({ name: '' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid request');
  });

  it('updates org and returns updated data on happy path', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('owner');

    const updatedOrg = { id: ORG_ID, name: 'New Name' };
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([updatedOrg]),
    };
    const db = {
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPut(makePutCtx({ name: 'New Name' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe('New Name');
    expect(db.update).toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestPut(makePutCtx({ name: 'X' }));
    expect(res.status).toBe(500);
  });
});
