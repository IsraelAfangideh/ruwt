import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const {
  mockGetUser,
  mockGetDb,
  mockCanManageAssessment,
  mockGetUserOrg,
  mockHasActiveSubscription,
  mockSendEmail,
  mockCandidateInviteEmail,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockCanManageAssessment: vi.fn(),
  mockGetUserOrg: vi.fn(),
  mockHasActiveSubscription: vi.fn(),
  mockSendEmail: vi.fn(),
  mockCandidateInviteEmail: vi.fn(),
}));

vi.mock('../../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../_shared/org', () => ({
  canManageAssessment: mockCanManageAssessment,
  getUserOrg: mockGetUserOrg,
  hasActiveSubscription: mockHasActiveSubscription,
}));
vi.mock('../../../_shared/newsletter/resend', () => ({ sendEmail: mockSendEmail }));
vi.mock('../../../_shared/email/templates', () => ({
  candidateInviteEmail: mockCandidateInviteEmail,
}));

import { onRequestPost, onRequestGet } from './invites';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = { id: 'user-123', email: 'admin@test.com' };

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
    RESEND_API_KEY: 'test-key',
  } as Env;
}

function makePostContext(id: string, body: unknown) {
  return {
    request: new Request(`https://ruwt.dev/api/assessments/${id}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
    params: { id },
  };
}

function makeGetContext(id: string) {
  return {
    request: new Request(`https://ruwt.dev/api/assessments/${id}/invites`, { method: 'GET' }),
    env: makeEnv(),
    params: { id },
  };
}

// ── POST tests ───────────────────────────────────────────────────────

describe('POST /api/assessments/:id/invites', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockCanManageAssessment.mockReset();
    mockGetUserOrg.mockReset();
    mockHasActiveSubscription.mockReset();
    mockSendEmail.mockReset();
    mockCandidateInviteEmail.mockReset();
    mockCandidateInviteEmail.mockReturnValue({
      subject: 'You have been invited',
      html: '<p>Invite</p>',
      text: 'Invite',
    });
    mockSendEmail.mockResolvedValue({ success: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPost(makePostContext('a-1', {}));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 404 when user cannot manage assessment', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(false);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makePostContext('a-1', {}));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Assessment not found');
  });

  it('returns 404 when assessment select returns empty after access check', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]), // no assessment found
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext('a-1', {}));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Assessment not found');
  });

  it('returns 400 when assessment is not active', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const assessment = { id: 'a-1', status: 'draft', title: 'Draft Assessment', orgId: null };

    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([assessment]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext('a-1', {}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Assessment must be active to create invites');
  });

  it('returns 402 when no org exists', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);
    mockGetUserOrg.mockResolvedValue(null);

    const assessment = { id: 'a-1', status: 'active', title: 'Test', orgId: null };

    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([assessment]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext('a-1', {}));
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.error).toContain('Create an organization');
  });

  it('returns 402 when subscription is not active', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);
    mockGetUserOrg.mockResolvedValue({ org: { id: 'org-1' }, role: 'admin' });
    mockHasActiveSubscription.mockResolvedValue(false);

    const assessment = { id: 'a-1', status: 'active', title: 'Test', orgId: null };

    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([assessment]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext('a-1', {}));
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.error).toContain('Active subscription required');
  });

  it('creates invite without email and returns 201', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);
    mockHasActiveSubscription.mockResolvedValue(true);

    const assessment = { id: 'a-1', status: 'active', title: 'Test', orgId: 'org-1', companyName: null, companyLogoUrl: null, timeLimit: 3600 };
    const createdInvite = { id: 'inv-1', token: 'abc123', status: 'pending' };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([assessment]);
        if (selectCallCount === 2) return Promise.resolve([createdInvite]);
        return Promise.resolve([]);
      });
      return chain;
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext('a-1', {}));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.token).toBe('abc123');
    expect(json.emailSent).toBe(false);
    expect(json.url).toContain('/assess/');
  });

  it('creates invite with email, sends email, and returns 201', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);
    mockHasActiveSubscription.mockResolvedValue(true);

    const assessment = {
      id: 'a-1',
      status: 'active',
      title: 'Test',
      description: 'Desc',
      orgId: 'org-1',
      companyName: 'Acme',
      companyLogoUrl: null,
      timeLimit: 3600,
    };
    const createdInvite = { id: 'inv-1', token: 'tok123', status: 'pending' };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([assessment]);
        // Challenge count query
        if (selectCallCount === 2) return Promise.resolve([{ count: 5 }]);
        if (selectCallCount === 3) return Promise.resolve([createdInvite]);
        return Promise.resolve([]);
      });
      return chain;
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        catch: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makePostContext('a-1', {
      candidateEmail: 'candidate@example.com',
      expiresInDays: 14,
    }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.emailSent).toBe(true);
    expect(mockSendEmail).toHaveBeenCalled();
    expect(mockCandidateInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentTitle: 'Test',
        companyName: 'Acme',
      })
    );
  });

  it('uses assessment orgId for subscription check when available', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);
    mockHasActiveSubscription.mockResolvedValue(true);

    const assessment = { id: 'a-1', status: 'active', title: 'Test', orgId: 'org-direct' };
    const createdInvite = { id: 'inv-1', token: 'tok', status: 'pending' };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([assessment]);
        if (selectCallCount === 2) return Promise.resolve([createdInvite]);
        return Promise.resolve([]);
      });
      return chain;
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makePostContext('a-1', {}));

    // Should use assessment.orgId directly, not call getUserOrg
    expect(mockHasActiveSubscription).toHaveBeenCalledWith(db, 'org-direct');
    expect(mockGetUserOrg).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid email format', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makePostContext('a-1', { candidateEmail: 'not-an-email' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 500 on unexpected error in POST', async () => {
    mockGetUser.mockRejectedValue(new Error('Unexpected'));

    const res = await onRequestPost(makePostContext('a-1', {}));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});

// ── GET tests ────────────────────────────────────────────────────────

describe('GET /api/assessments/:id/invites', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockCanManageAssessment.mockReset();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestGet(makeGetContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 404 when user cannot manage assessment', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(false);
    mockGetDb.mockReturnValue({});

    const res = await onRequestGet(makeGetContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Assessment not found');
  });

  it('returns list of invites for the assessment', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const invites = [
      { id: 'inv-1', token: 'tok-1', status: 'pending', candidateEmail: 'a@test.com' },
      { id: 'inv-2', token: 'tok-2', status: 'started', candidateEmail: 'b@test.com' },
      { id: 'inv-3', token: 'tok-3', status: 'completed', candidateEmail: null },
    ];

    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(invites),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveLength(3);
    expect(json[0].token).toBe('tok-1');
    expect(json[2].candidateEmail).toBeNull();
  });

  it('returns empty array when no invites exist', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([]);
  });

  it('returns 500 on unexpected error in GET', async () => {
    mockGetUser.mockRejectedValue(new Error('Unexpected'));

    const res = await onRequestGet(makeGetContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
