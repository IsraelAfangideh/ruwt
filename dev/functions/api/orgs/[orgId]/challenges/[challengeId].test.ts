/**
 * Tests for /api/orgs/:orgId/challenges/:challengeId — CRUD for single custom challenge.
 *
 * GET    — any org member can view
 * PUT    — admin/owner can update (with status transition validation)
 * DELETE — admin/owner can delete (draft only)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb, mockRequireOrgAccess } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockRequireOrgAccess: vi.fn(),
}));

vi.mock('../../../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../../_shared/org', () => ({ requireOrgAccess: mockRequireOrgAccess }));
vi.mock('../../../../../drizzle/schema.d1', () => ({
  customChallenges: {
    id: 'id', orgId: 'org_id', title: 'title', description: 'description',
    difficulty: 'difficulty', category: 'category', status: 'status',
    reviewedBy: 'reviewed_by', reviewedAt: 'reviewed_at',
  },
}));

import { onRequestGet, onRequestPut, onRequestDelete } from './[challengeId]';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_USER = { id: 'user-1', email: 'admin@ruwt.dev' };
const ORG_ID = 'org-1';
const CHALLENGE_ID = 'custom-12345678';

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeGetCtx() {
  return {
    request: new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/challenges/${CHALLENGE_ID}`),
    env: makeEnv(),
    params: { orgId: ORG_ID, challengeId: CHALLENGE_ID },
  };
}

function makePutCtx(body: unknown) {
  return {
    request: new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/challenges/${CHALLENGE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
    params: { orgId: ORG_ID, challengeId: CHALLENGE_ID },
  };
}

function makeDeleteCtx() {
  return {
    request: new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/challenges/${CHALLENGE_ID}`, {
      method: 'DELETE',
    }),
    env: makeEnv(),
    params: { orgId: ORG_ID, challengeId: CHALLENGE_ID },
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
// GET /api/orgs/:orgId/challenges/:challengeId
// ---------------------------------------------------------------------------

describe('GET /api/orgs/:orgId/challenges/:challengeId', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestGet(makeGetCtx());

    expect(res.status).toBe(401);
    const json = await res.json() as any;
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not an org member', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue(null);
    createMockDb();

    const res = await onRequestGet(makeGetCtx());

    expect(res.status).toBe(403);
    const json = await res.json() as any;
    expect(json.error).toBe('Not a member of this organization');
  });

  it('returns 404 when challenge not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('viewer');
    const db = createMockDb();
    db.selectResults.push([]); // challenge not found

    const res = await onRequestGet(makeGetCtx());

    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toBe('Challenge not found');
  });

  it('returns challenge details when found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('member');
    const db = createMockDb();
    const challenge = {
      id: CHALLENGE_ID,
      title: 'Debug the Cache',
      difficulty: 'medium',
      category: 'debugging',
      status: 'active',
    };
    db.selectResults.push([challenge]);

    const res = await onRequestGet(makeGetCtx());

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.id).toBe(CHALLENGE_ID);
    expect(json.title).toBe('Debug the Cache');
  });

  it('returns 500 when database throws', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockRejectedValue(new Error('DB error'));
    createMockDb();

    const res = await onRequestGet(makeGetCtx());

    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.error).toBe('Internal server error');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/orgs/:orgId/challenges/:challengeId
// ---------------------------------------------------------------------------

describe('PUT /api/orgs/:orgId/challenges/:challengeId', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPut(makePutCtx({ title: 'Updated' }));

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin/owner', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue(null);
    createMockDb();

    const res = await onRequestPut(makePutCtx({ title: 'Updated' }));

    expect(res.status).toBe(403);
    const json = await res.json() as any;
    expect(json.error).toBe('Insufficient permissions');
  });

  it('returns 404 when challenge not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([]); // challenge not found

    const res = await onRequestPut(makePutCtx({ title: 'Updated' }));

    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toBe('Challenge not found');
  });

  it('returns 400 for invalid body', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'draft' }]); // existing

    const res = await onRequestPut(makePutCtx({ difficulty: 'impossible' }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 for unparseable JSON body', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'draft' }]);

    const req = new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/challenges/${CHALLENGE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{{bad json',
    });

    const res = await onRequestPut({
      request: req,
      env: makeEnv(),
      params: { orgId: ORG_ID, challengeId: CHALLENGE_ID },
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid status transition (active to draft)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'active' }]);

    const res = await onRequestPut(makePutCtx({ status: 'draft' }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toContain("Cannot transition from 'active' to 'draft'");
  });

  it('returns 400 for invalid status transition (archived to active)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'archived' }]);

    const res = await onRequestPut(makePutCtx({ status: 'active' }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toContain("Cannot transition from 'archived' to 'active'");
  });

  it('returns 400 when no fields to update', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'draft' }]);

    const res = await onRequestPut(makePutCtx({}));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('No fields to update');
  });

  it('updates challenge title successfully', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'draft' }]); // existing
    const updated = { id: CHALLENGE_ID, title: 'New Title', status: 'draft' };
    db.selectResults.push([updated]); // re-fetch after update

    const res = await onRequestPut(makePutCtx({ title: 'New Title' }));

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.title).toBe('New Title');

    expect(db.updateCalls).toHaveLength(1);
    expect((db.updateCalls[0].set as any).title).toBe('New Title');
  });

  it('allows draft to active transition and sets reviewer info', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('owner');
    const db = createMockDb();
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'draft' }]);
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'active' }]);

    const res = await onRequestPut(makePutCtx({ status: 'active' }));

    expect(res.status).toBe(200);
    const updateSet = db.updateCalls[0].set as any;
    expect(updateSet.status).toBe('active');
    expect(updateSet.reviewedBy).toBe(FAKE_USER.id);
    expect(updateSet.reviewedAt).toBeDefined();
  });

  it('allows draft to archived transition', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'draft' }]);
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'archived' }]);

    const res = await onRequestPut(makePutCtx({ status: 'archived' }));

    expect(res.status).toBe(200);
  });

  it('allows active to archived transition', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'active' }]);
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'archived' }]);

    const res = await onRequestPut(makePutCtx({ status: 'archived' }));

    expect(res.status).toBe(200);
  });

  it('allows updating same status (no transition)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'draft' }]);
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'draft' }]);

    const res = await onRequestPut(makePutCtx({ status: 'draft', title: 'Also title' }));

    expect(res.status).toBe(200);
    // No reviewer set since status didn't actually change to active
    const updateSet = db.updateCalls[0].set as any;
    expect(updateSet.reviewedBy).toBeUndefined();
  });

  it('updates all updatable fields at once', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'draft' }]);
    db.selectResults.push([{ id: CHALLENGE_ID }]);

    const res = await onRequestPut(makePutCtx({
      title: 'New',
      description: 'Updated desc',
      difficulty: 'hard',
      category: 'backend_api',
      skillTested: 'API design',
      language: 'python',
      starterCode: 'def solve():',
      testCases: '[]',
      hiddenTestCases: '[]',
      testHarness: 'print("ok")',
      tags: '["api"]',
    }));

    expect(res.status).toBe(200);
    const updateSet = db.updateCalls[0].set as any;
    expect(updateSet.title).toBe('New');
    expect(updateSet.description).toBe('Updated desc');
    expect(updateSet.difficulty).toBe('hard');
    expect(updateSet.category).toBe('backend_api');
    expect(updateSet.skillTested).toBe('API design');
    expect(updateSet.language).toBe('python');
    expect(updateSet.starterCode).toBe('def solve():');
    expect(updateSet.testCases).toBe('[]');
    expect(updateSet.hiddenTestCases).toBe('[]');
    expect(updateSet.testHarness).toBe('print("ok")');
    expect(updateSet.tags).toBe('["api"]');
  });

  it('returns 500 when database throws', async () => {
    mockGetUser.mockRejectedValue(new Error('Crash'));

    const res = await onRequestPut(makePutCtx({ title: 'x' }));

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/orgs/:orgId/challenges/:challengeId
// ---------------------------------------------------------------------------

describe('DELETE /api/orgs/:orgId/challenges/:challengeId', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestDelete(makeDeleteCtx());

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin/owner', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue(null);
    createMockDb();

    const res = await onRequestDelete(makeDeleteCtx());

    expect(res.status).toBe(403);
    const json = await res.json() as any;
    expect(json.error).toBe('Insufficient permissions');
  });

  it('returns 404 when challenge not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([]); // not found

    const res = await onRequestDelete(makeDeleteCtx());

    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toBe('Challenge not found');
  });

  it('returns 400 when trying to delete active challenge', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'active' }]);

    const res = await onRequestDelete(makeDeleteCtx());

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toContain('Only draft challenges can be deleted');
  });

  it('returns 400 when trying to delete archived challenge', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'archived' }]);

    const res = await onRequestDelete(makeDeleteCtx());

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toContain('Only draft challenges can be deleted');
  });

  it('deletes draft challenge successfully', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();
    db.selectResults.push([{ id: CHALLENGE_ID, status: 'draft' }]);

    const res = await onRequestDelete(makeDeleteCtx());

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.success).toBe(true);

    expect(db.deleteCalls).toHaveLength(1);
  });

  it('returns 500 when database throws', async () => {
    mockGetUser.mockRejectedValue(new Error('DB crash'));

    const res = await onRequestDelete(makeDeleteCtx());

    expect(res.status).toBe(500);
  });
});
