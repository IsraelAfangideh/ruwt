/**
 * Tests for /api/orgs/:orgId/challenges — List and create custom challenges.
 *
 * GET  — any org member can list
 * POST — admin/owner can create
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb, mockRequireOrgAccess } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockRequireOrgAccess: vi.fn(),
}));

vi.mock('../../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../_shared/org', () => ({ requireOrgAccess: mockRequireOrgAccess }));
vi.mock('../../../../drizzle/schema.d1', () => ({
  customChallenges: {
    id: 'id', orgId: 'org_id', title: 'title', description: 'description',
    difficulty: 'difficulty', category: 'category', skillTested: 'skill_tested',
    language: 'language', starterCode: 'starter_code', testCases: 'test_cases',
    hiddenTestCases: 'hidden_test_cases', testHarness: 'test_harness',
    tags: 'tags', status: 'status', aiGenerated: 'ai_generated', createdBy: 'created_by',
    createdAt: 'created_at',
  },
}));

import { onRequestGet, onRequestPost } from './challenges';

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
  } as Env;
}

function makeGetCtx() {
  return {
    request: new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/challenges`),
    env: makeEnv(),
    params: { orgId: ORG_ID },
  };
}

function makePostCtx(body: unknown) {
  return {
    request: new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/challenges`, {
      method: 'POST',
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

  function mockWhereResult(rows: unknown[]) {
    return {
      limit: vi.fn().mockResolvedValue(rows),
      orderBy: vi.fn().mockImplementation(() => {
        const r = selectResults.shift() || rows;
        return {
          then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
            Promise.resolve(r).then(resolve, reject),
        };
      }),
      then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
        Promise.resolve(rows).then(resolve, reject),
    };
  }

  const db = {
    selectResults,
    insertedValues,
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
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
// GET tests
// ---------------------------------------------------------------------------

describe('GET /api/orgs/:orgId/challenges', () => {
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

  it('returns list of custom challenges for org member', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('viewer');
    const db = createMockDb();
    const challenges = [
      { id: 'custom-abc', title: 'Bug Hunt', difficulty: 'medium', status: 'active' },
      { id: 'custom-def', title: 'API Design', difficulty: 'hard', status: 'draft' },
    ];
    db.selectResults.push(challenges);

    const res = await onRequestGet(makeGetCtx());

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json).toHaveLength(2);
    expect(json[0].id).toBe('custom-abc');
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
// POST tests
// ---------------------------------------------------------------------------

describe('POST /api/orgs/:orgId/challenges', () => {
  const validChallenge = {
    title: 'Test Challenge',
    description: 'A test challenge description',
    difficulty: 'medium',
    testCases: JSON.stringify([{ input: '1', expectedOutput: '1' }]),
  };

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPost(makePostCtx(validChallenge));

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin/owner', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue(null);
    createMockDb();

    const res = await onRequestPost(makePostCtx(validChallenge));

    expect(res.status).toBe(403);
    const json = await res.json() as any;
    expect(json.error).toBe('Insufficient permissions');
  });

  it('returns 400 for invalid body (missing required fields)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    createMockDb();

    const res = await onRequestPost(makePostCtx({ title: 'Missing fields' }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Invalid request');
    expect(json.details).toBeDefined();
  });

  it('returns 400 for unparseable JSON body', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    createMockDb();

    const req = new Request(`https://ruwt.dev/api/orgs/${ORG_ID}/challenges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{bad json',
    });

    const res = await onRequestPost({
      request: req,
      env: makeEnv(),
      params: { orgId: ORG_ID },
    });

    expect(res.status).toBe(400);
  });

  it('creates challenge successfully with all fields', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    const db = createMockDb();

    const created = { id: 'custom-12345678', title: 'Test Challenge', status: 'draft' };
    db.selectResults.push([created]);

    const res = await onRequestPost(makePostCtx({
      ...validChallenge,
      category: 'debugging',
      skillTested: 'Cache invalidation',
      language: 'typescript',
      starterCode: 'function solve() {}',
      hiddenTestCases: '[]',
      testHarness: 'console.log("ok")',
      tags: '["cache","debug"]',
    }));

    expect(res.status).toBe(201);
    const json = await res.json() as any;
    expect(json.id).toBe('custom-12345678');

    // Verify inserted values
    expect(db.insertedValues).toHaveLength(1);
    const inserted = db.insertedValues[0] as any;
    expect(inserted.orgId).toBe(ORG_ID);
    expect(inserted.status).toBe('draft');
    expect(inserted.aiGenerated).toBe(0);
    expect(inserted.createdBy).toBe(FAKE_USER.id);
  });

  it('uses default values for optional fields', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('owner');
    const db = createMockDb();
    db.selectResults.push([{ id: 'custom-xxx', title: validChallenge.title }]);

    const res = await onRequestPost(makePostCtx(validChallenge));

    expect(res.status).toBe(201);
    const inserted = db.insertedValues[0] as any;
    expect(inserted.category).toBe('practice'); // default
    expect(inserted.language).toBe('javascript'); // default
  });

  it('returns 500 when database insert fails', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');
    mockGetDb.mockReturnValue({
      select: vi.fn(),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('INSERT failed')),
      }),
    });

    const res = await onRequestPost(makePostCtx(validChallenge));

    expect(res.status).toBe(500);
  });
});
