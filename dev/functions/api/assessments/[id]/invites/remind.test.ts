import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const {
  mockGetUser,
  mockGetDb,
  mockCanManageAssessment,
  mockSendEmail,
  mockReminderEmail,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockCanManageAssessment: vi.fn(),
  mockSendEmail: vi.fn(),
  mockReminderEmail: vi.fn(),
}));

vi.mock('../../../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../../_shared/org', () => ({
  canManageAssessment: mockCanManageAssessment,
}));
vi.mock('../../../../_shared/newsletter/resend', () => ({ sendEmail: mockSendEmail }));
vi.mock('../../../../_shared/email/templates', () => ({
  reminderEmail: mockReminderEmail,
}));

import { onRequestPost } from './remind';

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
    request: new Request(`https://ruwt.dev/api/assessments/${id}/invites/remind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
    params: { id },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('POST /api/assessments/:id/invites/remind', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockCanManageAssessment.mockReset();
    mockSendEmail.mockReset();
    mockReminderEmail.mockReset();
    mockReminderEmail.mockReturnValue({
      subject: 'Reminder',
      html: '<p>Reminder</p>',
      text: 'Reminder',
    });
    mockSendEmail.mockResolvedValue({ success: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPost(makeContext('a-1', { all: true }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when neither inviteIds nor all is provided', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makeContext('a-1', {}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 404 when user cannot manage assessment', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(false);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makeContext('a-1', { all: true }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toContain('not found');
  });

  it('returns 404 when assessment does not exist', async () => {
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

    const res = await onRequestPost(makeContext('a-1', { all: true }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Assessment not found');
  });

  it('sends reminders to specific invite IDs', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const assessment = { id: 'a-1', title: 'Test Assessment', companyName: 'Acme' };
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const invites = [
      { id: 'inv-1', candidateEmail: 'alice@test.com', token: 'tok1', expiresAt: futureDate, lastReminderAt: null, reminderCount: 0 },
      { id: 'inv-2', candidateEmail: 'bob@test.com', token: 'tok2', expiresAt: futureDate, lastReminderAt: null, reminderCount: 0 },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        // Assessment query
        if (selectCallCount === 1) return chain;
        // Invite query (specific IDs)
        if (selectCallCount === 2) return Promise.resolve(invites);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('a-1', { inviteIds: ['inv-1', 'inv-2'] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.reminded).toBe(2);
    expect(json.skipped).toBe(0);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(mockReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentTitle: 'Test Assessment',
        companyName: 'Acme',
      })
    );
  });

  it('skips invites without a candidate email', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const assessment = { id: 'a-1', title: 'Test', companyName: null };
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const invites = [
      { id: 'inv-1', candidateEmail: null, token: 'tok1', expiresAt: futureDate, lastReminderAt: null, reminderCount: 0 },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve(invites);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('a-1', { inviteIds: ['inv-1'] }));
    const json = await res.json();

    expect(json.reminded).toBe(0);
    expect(json.skipped).toBe(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('skips already-expired invites', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const assessment = { id: 'a-1', title: 'Test', companyName: null };
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const invites = [
      { id: 'inv-1', candidateEmail: 'alice@test.com', token: 'tok1', expiresAt: pastDate, lastReminderAt: null, reminderCount: 0 },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve(invites);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('a-1', { inviteIds: ['inv-1'] }));
    const json = await res.json();

    expect(json.reminded).toBe(0);
    expect(json.skipped).toBe(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('handles email send failure and counts as skipped', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);
    mockSendEmail.mockResolvedValue({ success: false, error: 'Bounce' });

    const assessment = { id: 'a-1', title: 'Test', companyName: null };
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const invites = [
      { id: 'inv-1', candidateEmail: 'bounce@test.com', token: 'tok1', expiresAt: futureDate, lastReminderAt: null, reminderCount: 0 },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve(invites);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('a-1', { inviteIds: ['inv-1'] }));
    const json = await res.json();

    expect(json.reminded).toBe(0);
    expect(json.skipped).toBe(1);
  });

  it('handles email send throwing an exception', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);
    mockSendEmail.mockRejectedValue(new Error('Network failure'));

    const assessment = { id: 'a-1', title: 'Test', companyName: null };
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const invites = [
      { id: 'inv-1', candidateEmail: 'error@test.com', token: 'tok1', expiresAt: futureDate, lastReminderAt: null, reminderCount: 0 },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve(invites);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([assessment]);
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

    const res = await onRequestPost(makeContext('a-1', { inviteIds: ['inv-1'] }));
    const json = await res.json();

    expect(json.reminded).toBe(0);
    expect(json.skipped).toBe(1);
  });

  it('sends reminders with all:true mode', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const assessment = { id: 'a-1', title: 'Test', companyName: 'Acme' };
    const futureDate = new Date(Date.now() + 14 * 86400000).toISOString();
    const invites = [
      { id: 'inv-1', candidateEmail: 'alice@test.com', token: 'tok1', expiresAt: futureDate, lastReminderAt: null, reminderCount: 0 },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve(invites);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('a-1', { all: true }));
    const json = await res.json();

    expect(json.reminded).toBe(1);
    expect(json.skipped).toBe(0);
    // Verify reminder tracking was updated
    expect(db.update).toHaveBeenCalled();
  });

  it('returns zero reminded and zero skipped when no matching invites', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const assessment = { id: 'a-1', title: 'Test', companyName: null };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve([]); // no matching invites
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('a-1', { all: true }));
    const json = await res.json();

    expect(json.reminded).toBe(0);
    expect(json.skipped).toBe(0);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockRejectedValue(new Error('Unexpected'));

    const res = await onRequestPost(makeContext('a-1', { all: true }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
