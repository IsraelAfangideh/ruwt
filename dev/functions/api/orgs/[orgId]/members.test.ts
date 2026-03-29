/**
 * Tests for /api/orgs/:orgId/members — List, change role, and remove members.
 *
 * GET    — Any member can list
 * PUT    — Owner only can change roles
 * DELETE — Admin+ can remove members
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb, mockRequireOrgAccess, mockGetUserOrgRole } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockRequireOrgAccess: vi.fn(),
  mockGetUserOrgRole: vi.fn(),
}));

vi.mock('../../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../_shared/org', () => ({
  requireOrgAccess: mockRequireOrgAccess,
  getUserOrgRole: mockGetUserOrgRole,
}));
vi.mock('../../../../drizzle/schema.d1', () => ({
  orgMembers: { id: 'id', orgId: 'org_id', userId: 'user_id', role: 'role', joinedAt: 'joined_at' },
  profiles: { id: 'id', name: 'name', email: 'email', avatarUrl: 'avatar_url' },
}));

import { onRequestGet, onRequestPut, onRequestDelete } from './members';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_USER = { id: '00000000-0000-4000-8000-000000000001', email: 'owner@ruwt.dev' };
const ORG_ID = 'org-1';
const TARGET_USER_UUID = '00000000-0000-4000-8000-000000000002';

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeGetCtx() {
  return {
    request: new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/members`),
    env: makeEnv(),
    params: { orgId: ORG_ID },
  };
}

function makePutCtx(body: unknown) {
  return {
    request: new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/members`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
    params: { orgId: ORG_ID },
  };
}

function makeDeleteCtx(body: unknown) {
  return {
    request: new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
    params: { orgId: ORG_ID },
  };
}

function createMockDb() {
  const selectResults: unknown[][] = [];
  const updateCalls: Array<{ set: unknown }> = [];
  const deleteCalls: unknown[] = [];

  function mockWhereResult(rows: unknown[]) {
    return {
      limit: vi.fn().mockResolvedValue(rows),
      then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
        Promise.resolve(rows).then(resolve, reject),
    };
  }

  const db = {
    selectResults,
    updateCalls,
    deleteCalls,
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            const rows = selectResults.shift() || [];
            return mockWhereResult(rows);
          }),
        }),
        where: vi.fn().mockImplementation(() => {
          const rows = selectResults.shift() || [];
          return mockWhereResult(rows);
        }),
      }),
    })),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((val: unknown) => {
        updateCalls.push({ set: val });
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(() => {
        deleteCalls.push(true);
        return Promise.resolve(undefined);
      }),
    }),
  };

  mockGetDb.mockReturnValue(db);
  return db;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/orgs/:orgId/members
// ---------------------------------------------------------------------------

describe('GET /api/orgs/:orgId/members', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestGet(makeGetCtx());

    expect(res.status).toBe(401);
    const json = await res.json() as any;
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not an org member', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetUserOrgRole.mockResolvedValue(null);
    createMockDb();

    const res = await onRequestGet(makeGetCtx());

    expect(res.status).toBe(403);
    const json = await res.json() as any;
    expect(json.error).toBe('Not a member of this organization');
  });

  it('returns list of members with profile info', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetUserOrgRole.mockResolvedValue('member');
    const db = createMockDb();
    const members = [
      { id: 'mem-1', userId: 'user-1', role: 'owner', joinedAt: '2025-01-01', name: 'Owner', email: 'owner@test.com', avatarUrl: null },
      { id: 'mem-2', userId: 'user-2', role: 'member', joinedAt: '2025-02-01', name: 'Dev', email: 'dev@test.com', avatarUrl: 'https://img.test/avatar.png' },
    ];
    db.selectResults.push(members);

    const res = await onRequestGet(makeGetCtx());

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json).toHaveLength(2);
    expect(json[0].name).toBe('Owner');
    expect(json[1].role).toBe('member');
  });

  it('returns 500 when database throws', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetUserOrgRole.mockRejectedValue(new Error('DB fail'));
    createMockDb();

    const res = await onRequestGet(makeGetCtx());

    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.error).toBe('Internal server error');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/orgs/:orgId/members — Change role
// ---------------------------------------------------------------------------

describe('PUT /api/orgs/:orgId/members', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPut(makePutCtx({ userId: TARGET_USER_UUID, role: 'admin' }));

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not owner', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue(null);
    createMockDb();

    const res = await onRequestPut(makePutCtx({ userId: TARGET_USER_UUID, role: 'admin' }));

    expect(res.status).toBe(403);
    const json = await res.json() as any;
    expect(json.error).toBe('Only owners can change member roles');
  });

  it('returns 400 for invalid body (missing role)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('owner');
    createMockDb();

    const res = await onRequestPut(makePutCtx({ userId: TARGET_USER_UUID }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 for invalid role value', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('owner');
    createMockDb();

    const res = await onRequestPut(makePutCtx({ userId: TARGET_USER_UUID, role: 'superadmin' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 for non-UUID userId', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('owner');
    createMockDb();

    const res = await onRequestPut(makePutCtx({ userId: 'not-uuid', role: 'admin' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 for unparseable JSON body', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('owner');
    createMockDb();

    const req = new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/members`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{{bad json',
    });

    const res = await onRequestPut({
      request: req,
      env: makeEnv(),
      params: { orgId: ORG_ID },
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 when target member not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('owner');
    const db = createMockDb();
    db.selectResults.push([]); // target member not found

    const res = await onRequestPut(makePutCtx({ userId: TARGET_USER_UUID, role: 'admin' }));

    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toBe('Member not found');
  });

  it('returns 400 when trying to change an owner\'s role', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('owner');
    const db = createMockDb();
    db.selectResults.push([{ userId: TARGET_USER_UUID, role: 'owner' }]);

    const res = await onRequestPut(makePutCtx({ userId: TARGET_USER_UUID, role: 'admin' }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Cannot change the role of an owner');
  });

  it('returns 400 when owner tries to demote themselves as only owner', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('owner');
    const db = createMockDb();
    // Target is self — not an owner (the role-change check happens first, so targetMember.role != 'owner')
    db.selectResults.push([{ userId: FAKE_USER.id, role: 'admin' }]);
    // Actually, let me re-read the code... The userId in the body is FAKE_USER.id
    // First it checks if targetMember.role === 'owner' -> no
    // Then it checks if targetUserId === user.id -> yes
    // Then it counts owners
    db.selectResults.push([{ id: 'only-owner' }]); // only 1 owner

    const res = await onRequestPut(makePutCtx({ userId: FAKE_USER.id, role: 'member' }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Cannot demote yourself as the only owner');
  });

  it('changes member role successfully', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('owner');
    const db = createMockDb();
    db.selectResults.push([{ userId: TARGET_USER_UUID, role: 'member' }]);

    const res = await onRequestPut(makePutCtx({ userId: TARGET_USER_UUID, role: 'admin' }));

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.userId).toBe(TARGET_USER_UUID);
    expect(json.role).toBe('admin');

    expect(db.updateCalls).toHaveLength(1);
    expect(db.updateCalls[0].set).toEqual({ role: 'admin' });
  });

  it('returns 500 when database throws', async () => {
    mockGetUser.mockRejectedValue(new Error('Auth fail'));

    const res = await onRequestPut(makePutCtx({ userId: TARGET_USER_UUID, role: 'admin' }));

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/orgs/:orgId/members — Remove member
// ---------------------------------------------------------------------------

describe('DELETE /api/orgs/:orgId/members', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestDelete(makeDeleteCtx({ userId: TARGET_USER_UUID }));

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin/owner', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue(null);
    createMockDb();

    const res = await onRequestDelete(makeDeleteCtx({ userId: TARGET_USER_UUID }));

    expect(res.status).toBe(403);
    const json = await res.json() as any;
    expect(json.error).toBe('Insufficient permissions');
  });

  it('returns 400 for invalid body (missing userId)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    createMockDb();

    const res = await onRequestDelete(makeDeleteCtx({}));

    expect(res.status).toBe(400);
  });

  it('returns 400 for non-UUID userId', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    createMockDb();

    const res = await onRequestDelete(makeDeleteCtx({ userId: 'not-uuid' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 for unparseable JSON body', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    createMockDb();

    const req = new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: '{{bad json',
    });

    const res = await onRequestDelete({
      request: req,
      env: makeEnv(),
      params: { orgId: ORG_ID },
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 when trying to remove yourself', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    createMockDb();

    const res = await onRequestDelete(makeDeleteCtx({ userId: FAKE_USER.id }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toContain('Cannot remove yourself');
  });

  it('returns 404 when target member not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([]); // target not found

    const res = await onRequestDelete(makeDeleteCtx({ userId: TARGET_USER_UUID }));

    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toBe('Member not found');
  });

  it('returns 400 when trying to remove the last owner', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('owner');
    const db = createMockDb();
    db.selectResults.push([{ userId: TARGET_USER_UUID, role: 'owner' }]); // target is owner
    db.selectResults.push([{ id: 'only-owner' }]); // only 1 owner

    const res = await onRequestDelete(makeDeleteCtx({ userId: TARGET_USER_UUID }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Cannot remove the last owner');
  });

  it('removes non-owner member successfully', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([{ userId: TARGET_USER_UUID, role: 'member' }]);

    const res = await onRequestDelete(makeDeleteCtx({ userId: TARGET_USER_UUID }));

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.success).toBe(true);

    expect(db.deleteCalls).toHaveLength(1);
  });

  it('removes owner when there are multiple owners', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('owner');
    const db = createMockDb();
    db.selectResults.push([{ userId: TARGET_USER_UUID, role: 'owner' }]); // target is owner
    db.selectResults.push([{ id: 'owner-1' }, { id: 'owner-2' }]); // multiple owners

    const res = await onRequestDelete(makeDeleteCtx({ userId: TARGET_USER_UUID }));

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.success).toBe(true);
  });

  it('returns 500 when an error occurs', async () => {
    mockGetUser.mockRejectedValue(new Error('Auth crash'));

    const res = await onRequestDelete(makeDeleteCtx({ userId: TARGET_USER_UUID }));

    expect(res.status).toBe(500);
  });
});
