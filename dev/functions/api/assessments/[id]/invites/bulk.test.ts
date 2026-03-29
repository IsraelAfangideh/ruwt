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

vi.mock('../../../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../../_shared/org', () => ({
  canManageAssessment: mockCanManageAssessment,
  getUserOrg: mockGetUserOrg,
  hasActiveSubscription: mockHasActiveSubscription,
}));
vi.mock('../../../../_shared/newsletter/resend', () => ({ sendEmail: mockSendEmail }));
vi.mock('../../../../_shared/email/templates', () => ({
  candidateInviteEmail: mockCandidateInviteEmail,
}));

import { onRequestPost } from './bulk';

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

function makeContext(id: string, body: unknown) {
  return {
    request: new Request(`https://ruwt.dev/api/assessments/${id}/invites/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
    params: { id },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('POST /api/assessments/:id/invites/bulk', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockCanManageAssessment.mockReset();
    mockGetUserOrg.mockReset();
    mockHasActiveSubscription.mockReset();
    mockSendEmail.mockReset();
    mockCandidateInviteEmail.mockReset();
    mockCandidateInviteEmail.mockReturnValue({
      subject: 'Invite',
      html: '<p>Invite</p>',
      text: 'Invite',
    });
    mockSendEmail.mockResolvedValue({ success: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPost(makeContext('a-1', { emails: ['a@test.com'] }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when emails array is empty', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makeContext('a-1', { emails: [] }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 when emails contain invalid addresses', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makeContext('a-1', { emails: ['not-an-email'] }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 404 when user cannot manage assessment', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(false);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makeContext('a-1', { emails: ['a@test.com'] }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toContain('not found');
  });

  it('returns 400 when assessment is not active', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const assessment = { id: 'a-1', status: 'draft', title: 'Test', orgId: 'org-1' };

    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([assessment]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('a-1', { emails: ['a@test.com'] }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('Assessment must be active');
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

    const res = await onRequestPost(makeContext('a-1', { emails: ['a@test.com'] }));
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

    const res = await onRequestPost(makeContext('a-1', { emails: ['a@test.com'] }));
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.error).toContain('Active subscription required');
  });

  it('creates invites for multiple emails and sends emails', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);
    mockHasActiveSubscription.mockResolvedValue(true);

    const assessment = {
      id: 'a-1', status: 'active', title: 'Test', orgId: 'org-1',
      companyName: 'Acme', companyLogoUrl: null, timeLimit: 3600,
    };
    const challengeRows = [{ id: 'ac-1' }, { id: 'ac-2' }];

    let selectCallCount = 0;
    let insertCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      // Challenge rows query (no limit, uses where)
      if (selectCallCount === 2) {
        chain.where = vi.fn().mockResolvedValue(challengeRows);
      }
      return chain;
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation(() => {
        insertCount++;
        return Promise.resolve(undefined);
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('a-1', {
      emails: ['alice@test.com', 'bob@test.com'],
      expiresInDays: 7,
    }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.totalCreated).toBe(2);
    expect(json.totalEmailed).toBe(2);
    expect(json.results).toHaveLength(2);
    expect(json.results[0].email).toBe('alice@test.com');
    expect(json.results[0].emailSent).toBe(true);
    expect(json.results[0].url).toContain('https://ruwt.dev/assess/');
    expect(json.results[1].email).toBe('bob@test.com');

    // Should have called sendEmail for each email
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
  });

  it('continues batch even if one email fails', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);
    mockHasActiveSubscription.mockResolvedValue(true);

    // First email fails, second succeeds
    mockSendEmail
      .mockResolvedValueOnce({ success: false, error: 'Invalid recipient' })
      .mockResolvedValueOnce({ success: true });

    const assessment = { id: 'a-1', status: 'active', title: 'Test', orgId: 'org-1', companyName: null, companyLogoUrl: null, timeLimit: 3600 };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        // Call 1: assessment lookup → chain (needs .limit(1))
        if (currentCall === 1) return chain;
        // Call 2: challenge rows → resolves directly
        if (currentCall === 2) return Promise.resolve([{ id: 'ac-1' }]);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('a-1', {
      emails: ['fail@test.com', 'ok@test.com'],
    }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.totalCreated).toBe(2); // Both invites created
    expect(json.totalEmailed).toBe(1); // Only one email succeeded
    expect(json.results[0].emailSent).toBe(false);
    expect(json.results[1].emailSent).toBe(true);
  });

  it('handles email send throwing an exception gracefully', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);
    mockHasActiveSubscription.mockResolvedValue(true);
    mockSendEmail.mockRejectedValue(new Error('Network error'));

    const assessment = { id: 'a-1', status: 'active', title: 'Test', orgId: 'org-1', companyName: null, companyLogoUrl: null, timeLimit: 3600 };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return chain;
        if (currentCall === 2) return Promise.resolve([{ id: 'ac-1' }]);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    // The catch handler in bulk.ts: db.insert(emailLogs).values({...}).catch(() => {})
    // So insert().values() must return a thenable that has .catch()
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation(() => {
        const p = Promise.resolve(undefined);
        return p;
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('a-1', {
      emails: ['throw@test.com'],
    }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.totalCreated).toBe(1);
    expect(json.totalEmailed).toBe(0);
    expect(json.results[0].emailSent).toBe(false);
  });

  it('returns 404 when assessment is not found after query', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('a-1', { emails: ['a@test.com'] }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Assessment not found');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockRejectedValue(new Error('Unexpected'));

    const res = await onRequestPost(makeContext('a-1', { emails: ['a@test.com'] }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
