/**
 * Tests for POST /api/orgs/join — Accept organization invitation.
 *
 * Verifies auth gating, token validation, expiry handling, duplicate member check,
 * member creation, invitation status update, profile upgrade, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../drizzle/schema.d1', () => ({
  organizations: { id: 'id', name: 'name' },
  orgMembers: { id: 'id', orgId: 'org_id', userId: 'user_id', role: 'role' },
  orgInvitations: { id: 'id', orgId: 'org_id', token: 'token', status: 'status', expiresAt: 'expires_at', role: 'role', createdBy: 'created_by' },
  profiles: { id: 'id', accountType: 'account_type' },
}));

import { onRequestPost } from './join';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_USER = { id: 'user-1', email: 'dev@ruwt.dev' };
const ORG_ID = 'org-1';

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeContext(body: unknown) {
  return {
    request: new Request('https://ruwt.dev/api/orgs/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
  };
}

/**
 * Build mock db with configurable query results.
 * Query order in join.ts:
 * 1. Find invitation by token
 * 2. Check existing membership
 * 3. Insert new member
 * 4. Update invitation status
 * 5. Update profile accountType
 * 6. Get org for response
 */
function createMockDb(options: {
  invitation?: Record<string, unknown> | null;
  existingMember?: Record<string, unknown> | null;
  org?: Record<string, unknown> | null;
}) {
  let selectCallCount = 0;
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
    insertedValues,
    updateCalls,
    select: vi.fn().mockImplementation(() => {
      selectCallCount++;
      const callNum = selectCallCount;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            if (callNum === 1) {
              // Invitation lookup
              return mockWhereResult(options.invitation ? [options.invitation] : []);
            }
            if (callNum === 2) {
              // Existing member check
              return mockWhereResult(options.existingMember ? [options.existingMember] : []);
            }
            if (callNum === 3) {
              // Org lookup for response
              return mockWhereResult(options.org ? [options.org] : []);
            }
            return mockWhereResult([]);
          }),
        }),
      };
    }),
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
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/orgs/join', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPost(makeContext({ token: 'abc123' }));

    expect(res.status).toBe(401);
    const json = await res.json() as any;
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 for missing token', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const res = await onRequestPost(makeContext({}));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Invalid request');
    expect(json.details).toBeDefined();
  });

  it('returns 400 for empty token', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const res = await onRequestPost(makeContext({ token: '' }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 for unparseable JSON body', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    createMockDb({ invitation: null });

    const req = new Request('https://ruwt.dev/api/orgs/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{bad json',
    });

    const res = await onRequestPost({ request: req, env: makeEnv() });

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Invalid request');
  });

  it('returns 404 when invitation token is not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    createMockDb({ invitation: null });

    const res = await onRequestPost(makeContext({ token: 'nonexistent' }));

    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toBe('Invalid or expired invitation');
  });

  it('returns 400 when invitation has expired', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const db = createMockDb({
      invitation: {
        id: 'inv-1',
        orgId: ORG_ID,
        token: 'expired-token',
        status: 'pending',
        role: 'member',
        expiresAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        createdBy: 'admin-1',
      },
    });

    const res = await onRequestPost(makeContext({ token: 'expired-token' }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('This invitation has expired');

    // Should have updated the invitation status to 'expired'
    expect(db.updateCalls.length).toBeGreaterThanOrEqual(1);
    expect(db.updateCalls[0].set).toEqual({ status: 'expired' });
  });

  it('returns 400 when user is already a member', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    createMockDb({
      invitation: {
        id: 'inv-2',
        orgId: ORG_ID,
        token: 'valid-token',
        status: 'pending',
        role: 'member',
        expiresAt: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
        createdBy: 'admin-1',
      },
      existingMember: { id: 'mem-1' },
    });

    const res = await onRequestPost(makeContext({ token: 'valid-token' }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('You are already a member of this organization');
  });

  it('successfully joins org: creates member, marks invitation accepted, updates profile', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const db = createMockDb({
      invitation: {
        id: 'inv-3',
        orgId: ORG_ID,
        token: 'valid-token',
        status: 'pending',
        role: 'member',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdBy: 'admin-1',
      },
      existingMember: null,
      org: { id: ORG_ID, name: 'Test Org', logoUrl: null },
    });

    const res = await onRequestPost(makeContext({ token: 'valid-token' }));

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.org).toEqual({ id: ORG_ID, name: 'Test Org', logoUrl: null });
    expect(json.role).toBe('member');

    // Verify member was created
    expect(db.insertedValues.length).toBe(1);
    const member = db.insertedValues[0] as any;
    expect(member.orgId).toBe(ORG_ID);
    expect(member.userId).toBe(FAKE_USER.id);
    expect(member.role).toBe('member');
    expect(member.invitedBy).toBe('admin-1');

    // Verify invitation status updated to 'accepted'
    const acceptUpdate = db.updateCalls.find((c: any) => c.set.status === 'accepted');
    expect(acceptUpdate).toBeDefined();

    // Verify profile updated to 'team'
    const profileUpdate = db.updateCalls.find((c: any) => c.set.accountType === 'team');
    expect(profileUpdate).toBeDefined();
  });

  it('joins with admin role when invitation specifies admin', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const db = createMockDb({
      invitation: {
        id: 'inv-4',
        orgId: ORG_ID,
        token: 'admin-token',
        status: 'pending',
        role: 'admin',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdBy: 'owner-1',
      },
      existingMember: null,
      org: { id: ORG_ID, name: 'Admin Org' },
    });

    const res = await onRequestPost(makeContext({ token: 'admin-token' }));

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.role).toBe('admin');

    const member = db.insertedValues[0] as any;
    expect(member.role).toBe('admin');
  });

  it('returns 500 when an unexpected error occurs', async () => {
    mockGetUser.mockRejectedValue(new Error('Auth service down'));

    const res = await onRequestPost(makeContext({ token: 'any' }));

    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.error).toBe('Internal server error');
  });
});
