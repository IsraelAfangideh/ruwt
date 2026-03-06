import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const { mockGetUser, mockGetDb, mockGetUserOrgIds, mockRequireOrgAccess, mockRequireTeamAccount, mockGetUserOrg, mockIsOnActiveTrial, mockGetTrialStatus, mockClaimTrialSlot } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockGetUserOrgIds: vi.fn(),
  mockRequireOrgAccess: vi.fn(),
  mockRequireTeamAccount: vi.fn(),
  mockGetUserOrg: vi.fn(),
  mockIsOnActiveTrial: vi.fn(),
  mockGetTrialStatus: vi.fn(),
  mockClaimTrialSlot: vi.fn(),
}));

vi.mock('../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../_shared/org', () => ({
  getUserOrgIds: mockGetUserOrgIds,
  requireOrgAccess: mockRequireOrgAccess,
  requireTeamAccount: mockRequireTeamAccount,
  getUserOrg: mockGetUserOrg,
  isOnActiveTrial: mockIsOnActiveTrial,
  getTrialStatus: mockGetTrialStatus,
  claimTrialSlot: mockClaimTrialSlot,
  TRIAL_MAX_ASSESSMENTS: 1,
}));

import { onRequestPost, onRequestGet } from './assessments';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = { id: 'user-123', email: 'admin@test.com' };

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makePostContext(body: unknown) {
  return {
    request: new Request('https://ruwt.dev/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
  };
}

function makeGetContext() {
  return {
    request: new Request('https://ruwt.dev/api/assessments', { method: 'GET' }),
    env: makeEnv(),
  };
}

// ── POST tests ───────────────────────────────────────────────────────

describe('POST /api/assessments', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockRequireOrgAccess.mockReset();
    mockRequireTeamAccount.mockReset();
    mockRequireTeamAccount.mockResolvedValue(null);
    mockGetUserOrg.mockReset();
    mockGetUserOrg.mockResolvedValue(null); // Default: no org (no trial checks)
    mockIsOnActiveTrial.mockReset();
    mockIsOnActiveTrial.mockResolvedValue(false);
    mockGetTrialStatus.mockReset();
    mockClaimTrialSlot.mockReset();
    mockClaimTrialSlot.mockResolvedValue('not_trial');
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPost(makePostContext({ title: 'Test', timeLimit: 3600 }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when title is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makePostContext({ timeLimit: 3600 }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
    expect(json.details).toBeDefined();
  });

  it('returns 400 when timeLimit is below minimum (300)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makePostContext({ title: 'Test', timeLimit: 100 }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 when timeLimit exceeds maximum (14400)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makePostContext({ title: 'Test', timeLimit: 20000 }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 403 when orgId is provided but user lacks admin access', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue(null);

    const db: Record<string, any> = {};
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      title: 'Test',
      timeLimit: 3600,
      orgId: 'org-1',
    }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('Insufficient org permissions');
    expect(mockRequireOrgAccess).toHaveBeenCalledWith(db, 'user-123', 'org-1', 'admin');
  });

  it('creates a draft assessment and returns 201 on success', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const createdAssessment = {
      id: 'assess-new',
      title: 'Senior Dev',
      description: 'Test your skills',
      timeLimit: 3600,
      status: 'draft',
      createdBy: 'user-123',
    };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([createdAssessment]),
          }),
        }),
      };
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext({
      title: 'Senior Dev',
      description: 'Test your skills',
      timeLimit: 3600,
    }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.title).toBe('Senior Dev');
    expect(json.status).toBe('draft');
    expect(db.insert).toHaveBeenCalled();
  });

  it('passes orgId to assessment when provided and access is valid', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireOrgAccess.mockResolvedValue('admin');

    let insertedValues: any = null;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((val: any) => {
        insertedValues = val;
        return Promise.resolve(undefined);
      }),
    });
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'new', title: 'Test', status: 'draft' }]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makePostContext({
      title: 'Test',
      timeLimit: 3600,
      orgId: 'org-1',
    }));

    expect(insertedValues.orgId).toBe('org-1');
    expect(insertedValues.status).toBe('draft');
    expect(insertedValues.createdBy).toBe('user-123');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestPost(makePostContext({ title: 'Test', timeLimit: 3600 }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });

  it('returns 403 when user is not team account (POST)', async () => {
    mockRequireTeamAccount.mockResolvedValue(
      Response.json({ error: 'Team account required', code: 'TEAM_REQUIRED' }, { status: 403 })
    );
    mockGetUser.mockResolvedValue(FAKE_USER);

    const res = await onRequestPost(makePostContext({ title: 'Test', timeLimit: 3600 }));
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid JSON body', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const ctx = {
      request: new Request('https://ruwt.dev/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'broken',
      }),
      env: makeEnv(),
    };

    const res = await onRequestPost(ctx);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });
});

// ── GET tests ────────────────────────────────────────────────────────

describe('GET /api/assessments', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockGetUserOrgIds.mockReset();
    mockRequireTeamAccount.mockReset();
    mockRequireTeamAccount.mockResolvedValue(null);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestGet(makeGetContext());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns empty array when user has no assessments', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetUserOrgIds.mockResolvedValue([]);

    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([]);
  });

  it('returns assessments with aggregated stats', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetUserOrgIds.mockResolvedValue([]);

    const assessmentList = [
      { id: 'a-1', title: 'Assessment 1', status: 'active', createdBy: 'user-123' },
      { id: 'a-2', title: 'Assessment 2', status: 'draft', createdBy: 'user-123' },
    ];
    const challengeCounts = [
      { assessmentId: 'a-1', count: 5 },
      { assessmentId: 'a-2', count: 3 },
    ];
    const inviteCounts = [
      { assessmentId: 'a-1', count: 10 },
    ];
    const completionCounts = [
      { assessmentId: 'a-1', count: 7 },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        // Bulk stat queries return from the groupBy chain
        return chain;
      });
      chain.orderBy = vi.fn().mockResolvedValue(assessmentList);
      chain.groupBy = vi.fn().mockImplementation(() => {
        // Return different stats based on call order
        // After the first select (assessmentList), we get three parallel queries
        if (selectCallCount === 2) return Promise.resolve(challengeCounts);
        if (selectCallCount === 3) return Promise.resolve(inviteCounts);
        if (selectCallCount === 4) return Promise.resolve(completionCounts);
        return Promise.resolve([]);
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveLength(2);
    expect(json[0].challengeCount).toBe(5);
    expect(json[0].inviteCount).toBe(10);
    expect(json[0].completionCount).toBe(7);
    expect(json[1].challengeCount).toBe(3);
    expect(json[1].inviteCount).toBe(0); // No invites for a-2
    expect(json[1].completionCount).toBe(0);
  });

  it('includes orgId-based assessments when user belongs to orgs', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetUserOrgIds.mockResolvedValue(['org-1']);

    const assessmentList = [
      { id: 'a-org', title: 'Org Assessment', status: 'active', createdBy: 'other-user', orgId: 'org-1' },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => chain);
      chain.orderBy = vi.fn().mockResolvedValue(assessmentList);
      chain.groupBy = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve([]);
        if (selectCallCount === 3) return Promise.resolve([]);
        if (selectCallCount === 4) return Promise.resolve([]);
        return Promise.resolve([]);
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0].id).toBe('a-org');
  });

  it('returns 403 when user is not team account (GET)', async () => {
    mockRequireTeamAccount.mockResolvedValue(
      Response.json({ error: 'Team account required', code: 'TEAM_REQUIRED' }, { status: 403 })
    );
    mockGetUser.mockResolvedValue(FAKE_USER);

    const res = await onRequestGet(makeGetContext());
    expect(res.status).toBe(403);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetUserOrgIds.mockRejectedValue(new Error('fail'));
    mockGetDb.mockReturnValue({});
    const res = await onRequestGet(makeGetContext());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });
});
