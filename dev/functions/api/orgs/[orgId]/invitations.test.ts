/**
 * Tests for /api/orgs/:orgId/invitations — Invite, list, and revoke invitations.
 *
 * POST   — Invite team member (admin/owner)
 * GET    — List pending invitations (admin/owner)
 * DELETE — Revoke invitation (admin/owner)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb, mockRequireOrgAccess, mockSendEmail } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockRequireOrgAccess: vi.fn(),
  mockSendEmail: vi.fn(),
}));

vi.mock('../../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../_shared/org', () => ({ requireOrgAccess: mockRequireOrgAccess }));
vi.mock('../../../_shared/newsletter/resend', () => ({ sendEmail: mockSendEmail }));
vi.mock('../../../../drizzle/schema.d1', () => ({
  organizations: { id: 'id', name: 'name' },
  orgMembers: { id: 'id', orgId: 'org_id', userId: 'user_id' },
  orgInvitations: { id: 'id', orgId: 'org_id', email: 'email', role: 'role', token: 'token', status: 'status', expiresAt: 'expires_at', createdBy: 'created_by' },
  profiles: { id: 'id', email: 'email' },
}));

import { onRequestPost, onRequestGet, onRequestDelete } from './invitations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_USER = { id: 'user-1', email: 'admin@ruwt.dev' };
const ORG_ID = 'org-1';

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
    RESEND_API_KEY: 'test-resend-key',
  } as Env;
}

function makeGetCtx() {
  return {
    request: new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/invitations`),
    env: makeEnv(),
    params: { orgId: ORG_ID },
  };
}

function makePostCtx(body: unknown) {
  return {
    request: new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
    params: { orgId: ORG_ID },
  };
}

function makeDeleteCtx(body: unknown) {
  return {
    request: new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/invitations`, {
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
  const insertedValues: unknown[] = [];
  const updateCalls: Array<{ set: unknown }> = [];

  function mockWhereResult(rows: unknown[]) {
    return {
      limit: vi.fn().mockResolvedValue(rows),
      then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
        Promise.resolve(rows).then(resolve, reject),
    };
  }

  const db = {
    selectResults,
    insertedValues,
    updateCalls,
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
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((val: unknown) => {
        insertedValues.push(val);
        return Promise.resolve(undefined);
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((val: unknown) => {
        updateCalls.push({ set: val });
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
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
  mockSendEmail.mockResolvedValue({ success: true });
});

// ---------------------------------------------------------------------------
// POST /api/orgs/:orgId/invitations
// ---------------------------------------------------------------------------

describe('POST /api/orgs/:orgId/invitations', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPost(makePostCtx({ email: 'new@test.com' }));

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin/owner', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue(null);
    createMockDb();

    const res = await onRequestPost(makePostCtx({ email: 'new@test.com' }));

    expect(res.status).toBe(403);
    const json = await res.json() as any;
    expect(json.error).toBe('Insufficient permissions');
  });

  it('returns 400 for invalid email', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    createMockDb();

    const res = await onRequestPost(makePostCtx({ email: 'not-an-email' }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 for missing email', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    createMockDb();

    const res = await onRequestPost(makePostCtx({}));

    expect(res.status).toBe(400);
  });

  it('returns 400 for unparseable JSON body', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    createMockDb();

    const req = new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{bad',
    });

    const res = await onRequestPost({
      request: req,
      env: makeEnv(),
      params: { orgId: ORG_ID },
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 when email is already a member', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    // Existing member lookup returns a result
    db.selectResults.push([{ id: 'existing-member' }]);

    const res = await onRequestPost(makePostCtx({ email: 'existing@team.com' }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('This email is already a member of the organization');
  });

  it('returns 404 when org not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([]); // no existing member
    db.selectResults.push([]); // org not found

    const res = await onRequestPost(makePostCtx({ email: 'new@test.com' }));

    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toBe('Organization not found');
  });

  it('creates invitation, sends email, and returns 201', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([]); // no existing member
    db.selectResults.push([{ name: 'Test Org' }]); // org found
    const invitationObj = { id: 'inv-1', email: 'new@test.com', role: 'member', status: 'pending' };
    db.selectResults.push([invitationObj]); // re-fetch after insert

    const res = await onRequestPost(makePostCtx({ email: 'new@test.com', role: 'member' }));

    expect(res.status).toBe(201);
    const json = await res.json() as any;
    expect(json.email).toBe('new@test.com');

    // Verify invitation was inserted
    expect(db.insertedValues).toHaveLength(1);
    const inv = db.insertedValues[0] as any;
    expect(inv.orgId).toBe(ORG_ID);
    expect(inv.email).toBe('new@test.com');
    expect(inv.role).toBe('member');
    expect(inv.status).toBe('pending');
    expect(inv.createdBy).toBe(FAKE_USER.id);

    // Verify email was sent
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const emailCall = mockSendEmail.mock.calls[0];
    expect(emailCall[1].to).toBe('new@test.com');
    expect(emailCall[1].subject).toContain('Test Org');
    expect(emailCall[1].html).toContain('Accept Invitation');
  });

  it('defaults role to member when not specified', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('owner');
    const db = createMockDb();
    db.selectResults.push([]); // no existing member
    db.selectResults.push([{ name: 'My Org' }]); // org
    db.selectResults.push([{ id: 'inv-2', email: 'def@test.com', role: 'member' }]); // result

    const res = await onRequestPost(makePostCtx({ email: 'def@test.com' }));

    expect(res.status).toBe(201);
    const inv = db.insertedValues[0] as any;
    expect(inv.role).toBe('member');
  });

  it('returns 500 when an error occurs', async () => {
    mockGetUser.mockRejectedValue(new Error('Auth crash'));

    const res = await onRequestPost(makePostCtx({ email: 'x@x.com' }));

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/orgs/:orgId/invitations
// ---------------------------------------------------------------------------

describe('GET /api/orgs/:orgId/invitations', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestGet(makeGetCtx());

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin/owner', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue(null);
    createMockDb();

    const res = await onRequestGet(makeGetCtx());

    expect(res.status).toBe(403);
  });

  it('returns list of pending invitations', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    const invitations = [
      { id: 'inv-1', email: 'a@test.com', role: 'member', status: 'pending' },
      { id: 'inv-2', email: 'b@test.com', role: 'admin', status: 'pending' },
    ];
    db.selectResults.push(invitations);

    const res = await onRequestGet(makeGetCtx());

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json).toHaveLength(2);
    expect(json[0].email).toBe('a@test.com');
  });

  it('returns 500 when database throws', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockRejectedValue(new Error('DB error'));
    createMockDb();

    const res = await onRequestGet(makeGetCtx());

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/orgs/:orgId/invitations
// ---------------------------------------------------------------------------

describe('DELETE /api/orgs/:orgId/invitations', () => {
  const validUUID = '00000000-0000-4000-8000-000000000001';

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestDelete(makeDeleteCtx({ invitationId: validUUID }));

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin/owner', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue(null);
    createMockDb();

    const res = await onRequestDelete(makeDeleteCtx({ invitationId: validUUID }));

    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid invitationId (not UUID)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    createMockDb();

    const res = await onRequestDelete(makeDeleteCtx({ invitationId: 'not-a-uuid' }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 for missing invitationId', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    createMockDb();

    const res = await onRequestDelete(makeDeleteCtx({}));

    expect(res.status).toBe(400);
  });

  it('returns 400 for unparseable JSON body', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    createMockDb();

    const req = new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/invitations`, {
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

  it('returns 404 when invitation not found or already processed', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([]); // invitation not found

    const res = await onRequestDelete(makeDeleteCtx({ invitationId: validUUID }));

    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toBe('Invitation not found or already processed');
  });

  it('revokes invitation successfully', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([{ id: validUUID, orgId: ORG_ID, status: 'pending' }]);

    const res = await onRequestDelete(makeDeleteCtx({ invitationId: validUUID }));

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.success).toBe(true);

    // Verify status updated to 'revoked'
    expect(db.updateCalls).toHaveLength(1);
    expect(db.updateCalls[0].set).toEqual({ status: 'revoked' });
  });

  it('returns 500 when an error occurs', async () => {
    mockGetUser.mockRejectedValue(new Error('Auth crash'));

    const res = await onRequestDelete(makeDeleteCtx({ invitationId: validUUID }));

    expect(res.status).toBe(500);
  });
});
