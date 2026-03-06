import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb, mockSendEmail, mockTrialExpiringEmail, mockTrialExpiredEmail } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockSendEmail: vi.fn().mockResolvedValue({ success: true, id: 'test-id' }),
  mockTrialExpiringEmail: vi.fn().mockReturnValue({
    subject: 'Your trial expires in 7 days',
    html: '<p>expiring html</p>',
    text: 'expiring text',
  }),
  mockTrialExpiredEmail: vi.fn().mockReturnValue({
    subject: 'Your trial has ended',
    html: '<p>expired html</p>',
    text: 'expired text',
  }),
}));

vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../_shared/newsletter/resend', () => ({ sendEmail: mockSendEmail }));
vi.mock('../_shared/email/templates', () => ({
  trialExpiringEmail: mockTrialExpiringEmail,
  trialExpiredEmail: mockTrialExpiredEmail,
}));

import { onRequestPost } from './trial-lifecycle';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'u',
    VITE_SUPABASE_ANON_KEY: 'k',
    CRON_SECRET: 'test-secret',
    RESEND_API_KEY: 'test-key',
    ERROR_ALERT_EMAIL: 'admin@test.com',
    ...overrides,
  } as Env;
}

function makeCtx(token?: string, env?: Env, headers?: Record<string, string>) {
  const h: Record<string, string> = { ...headers };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return {
    request: new Request('https://ruwt.dev/api/trial-lifecycle', { method: 'POST', headers: h }),
    env: env ?? makeEnv(),
  };
}

// Helpers for common org rows
function makeExpiringOrg(overrides: Record<string, unknown> = {}) {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    org_id: 'org-1',
    org_name: 'Acme Corp',
    trial_ends_at: sevenDaysFromNow,
    trial_assessments_used: 0,
    trial_invites_used: 0,
    owner_id: 'user-1',
    owner_email: 'owner@acme.com',
    owner_name: 'Alice',
    ...overrides,
  };
}

function makeExpiredOrg(overrides: Record<string, unknown> = {}) {
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  return {
    org_id: 'org-2',
    org_name: 'Beta Inc',
    trial_ends_at: twelveHoursAgo,
    trial_assessments_used: 1,
    trial_invites_used: 0,
    owner_id: 'user-2',
    owner_email: 'owner@beta.com',
    owner_name: 'Bob',
    ...overrides,
  };
}

/** Build a mock db where the first db.all call returns expiringOrgs, subsequent calls are configurable */
function buildMockDb(options: {
  expiringOrgs?: unknown[];
  expiringDedupCounts?: Array<{ cnt: number }>;
  expiredOrgs?: unknown[];
  expiredDedupCounts?: Array<{ cnt: number }>;
} = {}) {
  const {
    expiringOrgs = [],
    expiringDedupCounts = [],
    expiredOrgs = [],
    expiredDedupCounts = [],
  } = options;

  // Build a call sequence:
  //   1. expiring orgs query
  //   2. for each expiring org: dedup check
  //   3. expired orgs query
  //   4. for each expired org: dedup check
  const allCalls: unknown[] = [];

  // 1. expiring orgs
  allCalls.push(expiringOrgs);

  // 2. dedup for each expiring org
  for (const dedupResult of expiringDedupCounts) {
    allCalls.push([dedupResult]);
  }

  // 3. expired orgs
  allCalls.push(expiredOrgs);

  // 4. dedup for each expired org
  for (const dedupResult of expiredDedupCounts) {
    allCalls.push([dedupResult]);
  }

  const allFn = vi.fn();
  for (const [i, val] of allCalls.entries()) {
    allFn.mockResolvedValueOnce(val);
  }

  return {
    all: allFn,
    run: vi.fn().mockResolvedValue({}),
  };
}

describe('POST /api/trial-lifecycle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Restore default return values cleared by resetAllMocks
    mockSendEmail.mockResolvedValue({ success: true, id: 'test-id' });
    mockTrialExpiringEmail.mockReturnValue({
      subject: 'Your trial expires in 7 days',
      html: '<p>expiring html</p>',
      text: 'expiring text',
    });
    mockTrialExpiredEmail.mockReturnValue({
      subject: 'Your trial has ended',
      html: '<p>expired html</p>',
      text: 'expired text',
    });
  });

  // ─── Auth ──────────────────────────────────────────────────────────────────

  describe('auth', () => {
    it('returns 401 when no Authorization header', async () => {
      const res = await onRequestPost(makeCtx());
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe('Unauthorized');
    });

    it('returns 401 when token does not match CRON_SECRET', async () => {
      const res = await onRequestPost(makeCtx('wrong-token'));
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe('Unauthorized');
    });

    it('returns 401 when CRON_SECRET is not set in env', async () => {
      const res = await onRequestPost(makeCtx('any-token', makeEnv({ CRON_SECRET: undefined })));
      expect(res.status).toBe(401);
    });

    it('returns 401 with stale X-Cron-Timestamp (>5 min old)', async () => {
      const staleTs = String(Math.floor(Date.now() / 1000) - 600); // 10 minutes ago
      const res = await onRequestPost(
        makeCtx('test-secret', undefined, { 'X-Cron-Timestamp': staleTs }),
      );
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe('Request expired');
    });

    it('returns 401 with future stale X-Cron-Timestamp (>5 min ahead)', async () => {
      const futureTs = String(Math.floor(Date.now() / 1000) + 600); // 10 minutes in future
      const res = await onRequestPost(
        makeCtx('test-secret', undefined, { 'X-Cron-Timestamp': futureTs }),
      );
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe('Request expired');
    });

    it('allows request with fresh X-Cron-Timestamp (<5 min)', async () => {
      const freshTs = String(Math.floor(Date.now() / 1000) - 60); // 1 minute ago
      const db = buildMockDb();
      mockGetDb.mockReturnValue(db);

      const res = await onRequestPost(
        makeCtx('test-secret', undefined, { 'X-Cron-Timestamp': freshTs }),
      );
      expect(res.status).toBe(200);
    });

    it('allows request without X-Cron-Timestamp (timestamp check is optional)', async () => {
      const db = buildMockDb();
      mockGetDb.mockReturnValue(db);

      const res = await onRequestPost(makeCtx('test-secret'));
      expect(res.status).toBe(200);
    });
  });

  // ─── Expiring trials (7 days out) ─────────────────────────────────────────

  describe('expiring trials', () => {
    it('sends email when trial expires in ~7 days with subscription_status=none', async () => {
      const org = makeExpiringOrg();
      const db = buildMockDb({
        expiringOrgs: [org],
        expiringDedupCounts: [{ cnt: 0 }],
      });
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true, id: 'resend-1' });

      const res = await onRequestPost(makeCtx('test-secret'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.expiring.sent).toBe(1);
      expect(json.expiring.failed).toBe(0);
      expect(json.expiring.results).toHaveLength(1);
      expect(json.expiring.results[0]).toMatchObject({
        email: 'owner@acme.com',
        orgName: 'Acme Corp',
        success: true,
      });

      // Verify trialExpiringEmail was called with correct params
      expect(mockTrialExpiringEmail).toHaveBeenCalledOnce();
      expect(mockTrialExpiringEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Alice',
          orgName: 'Acme Corp',
          assessmentsUsed: 0,
        }),
      );

      // Verify sendEmail was called for the user email
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          to: 'owner@acme.com',
          subject: 'Your trial expires in 7 days',
          html: '<p>expiring html</p>',
          text: 'expiring text',
        }),
      );
    });

    it('skips if newsletter_logs already has trial_expiring entry (dedup)', async () => {
      const org = makeExpiringOrg();
      const db = buildMockDb({
        expiringOrgs: [org],
        expiringDedupCounts: [{ cnt: 1 }], // already sent
      });
      mockGetDb.mockReturnValue(db);

      const res = await onRequestPost(makeCtx('test-secret'));
      const json = await res.json();

      expect(json.expiring.sent).toBe(0);
      expect(json.expiring.results).toHaveLength(0);
      // No user email should have been sent
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockTrialExpiringEmail).not.toHaveBeenCalled();
    });

    it('skips orgs with active subscription (query filters subscription_status=none)', async () => {
      // The SQL query itself filters subscription_status='none', so orgs with active
      // subscriptions never appear in results. We verify by passing empty results.
      const db = buildMockDb({ expiringOrgs: [] });
      mockGetDb.mockReturnValue(db);

      const res = await onRequestPost(makeCtx('test-secret'));
      const json = await res.json();

      expect(json.expiring.sent).toBe(0);
      expect(json.expiring.results).toHaveLength(0);
    });

    it('logs send to newsletter_logs on success', async () => {
      const org = makeExpiringOrg();
      const db = buildMockDb({
        expiringOrgs: [org],
        expiringDedupCounts: [{ cnt: 0 }],
      });
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true, id: 'resend-1' });

      await onRequestPost(makeCtx('test-secret'));

      // db.run should have been called for the newsletter_logs INSERT
      expect(db.run).toHaveBeenCalled();
    });

    it('handles multiple expiring orgs', async () => {
      const org1 = makeExpiringOrg({ org_id: 'org-1', owner_id: 'u1', owner_email: 'a@a.com' });
      const org2 = makeExpiringOrg({ org_id: 'org-2', owner_id: 'u2', owner_email: 'b@b.com', org_name: 'Gamma LLC' });

      // Build call sequence manually for 2 expiring orgs
      const allFn = vi.fn()
        .mockResolvedValueOnce([org1, org2])   // expiring orgs query
        .mockResolvedValueOnce([{ cnt: 0 }])   // dedup check org1
        .mockResolvedValueOnce([{ cnt: 0 }])   // dedup check org2
        .mockResolvedValueOnce([]);             // expired orgs query (none)

      mockGetDb.mockReturnValue({ all: allFn, run: vi.fn().mockResolvedValue({}) });
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });

      const res = await onRequestPost(makeCtx('test-secret'));
      const json = await res.json();

      expect(json.expiring.sent).toBe(2);
      expect(json.expiring.results).toHaveLength(2);
      expect(json.expiring.results[0].email).toBe('a@a.com');
      expect(json.expiring.results[1].email).toBe('b@b.com');
    });

    it('reports failure when sendEmail fails for expiring email', async () => {
      const org = makeExpiringOrg();
      const db = buildMockDb({
        expiringOrgs: [org],
        expiringDedupCounts: [{ cnt: 0 }],
      });
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: false, error: 'Rate limit' });

      const res = await onRequestPost(makeCtx('test-secret'));
      const json = await res.json();

      expect(json.expiring.sent).toBe(0);
      expect(json.expiring.failed).toBe(1);
      expect(json.expiring.results[0].success).toBe(false);
      expect(json.expiring.results[0].error).toBe('Rate limit');
    });
  });

  // ─── Expired trials (0–24h ago) ───────────────────────────────────────────

  describe('expired trials', () => {
    it('sends email when trial ended in last 24 hours with subscription_status=none', async () => {
      const org = makeExpiredOrg();
      const db = buildMockDb({
        expiredOrgs: [org],
        expiredDedupCounts: [{ cnt: 0 }],
      });
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true, id: 'resend-2' });

      const res = await onRequestPost(makeCtx('test-secret'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.expired.sent).toBe(1);
      expect(json.expired.failed).toBe(0);
      expect(json.expired.results[0]).toMatchObject({
        email: 'owner@beta.com',
        orgName: 'Beta Inc',
        success: true,
      });

      // Verify trialExpiredEmail was called with correct params
      expect(mockTrialExpiredEmail).toHaveBeenCalledOnce();
      expect(mockTrialExpiredEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Bob',
          orgName: 'Beta Inc',
          assessmentsUsed: 1,
        }),
      );

      // Verify sendEmail was called for the user email
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          to: 'owner@beta.com',
          subject: 'Your trial has ended',
        }),
      );
    });

    it('skips if newsletter_logs already has trial_expired entry (dedup)', async () => {
      const org = makeExpiredOrg();
      const db = buildMockDb({
        expiredOrgs: [org],
        expiredDedupCounts: [{ cnt: 1 }], // already sent
      });
      mockGetDb.mockReturnValue(db);

      const res = await onRequestPost(makeCtx('test-secret'));
      const json = await res.json();

      expect(json.expired.sent).toBe(0);
      expect(json.expired.results).toHaveLength(0);
      // sendEmail should not be called for expired at all
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockTrialExpiredEmail).not.toHaveBeenCalled();
    });

    it('skips orgs with active subscription (query filters subscription_status=none)', async () => {
      const db = buildMockDb({ expiredOrgs: [] });
      mockGetDb.mockReturnValue(db);

      const res = await onRequestPost(makeCtx('test-secret'));
      const json = await res.json();

      expect(json.expired.sent).toBe(0);
      expect(json.expired.results).toHaveLength(0);
    });

    it('reports failure when sendEmail fails for expired email', async () => {
      const org = makeExpiredOrg();
      const db = buildMockDb({
        expiredOrgs: [org],
        expiredDedupCounts: [{ cnt: 0 }],
      });
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: false, error: 'Quota exceeded' });

      const res = await onRequestPost(makeCtx('test-secret'));
      const json = await res.json();

      expect(json.expired.sent).toBe(0);
      expect(json.expired.failed).toBe(1);
      expect(json.expired.results[0].error).toBe('Quota exceeded');
    });

    it('handles multiple expired orgs', async () => {
      const org1 = makeExpiredOrg({ org_id: 'org-a', owner_id: 'u-a', owner_email: 'x@x.com' });
      const org2 = makeExpiredOrg({ org_id: 'org-b', owner_id: 'u-b', owner_email: 'y@y.com', org_name: 'Delta Co' });

      const allFn = vi.fn()
        .mockResolvedValueOnce([])             // expiring orgs (none)
        .mockResolvedValueOnce([org1, org2])   // expired orgs query
        .mockResolvedValueOnce([{ cnt: 0 }])   // dedup check org1
        .mockResolvedValueOnce([{ cnt: 0 }]);  // dedup check org2

      mockGetDb.mockReturnValue({ all: allFn, run: vi.fn().mockResolvedValue({}) });
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });

      const res = await onRequestPost(makeCtx('test-secret'));
      const json = await res.json();

      expect(json.expired.sent).toBe(2);
      expect(json.expired.results).toHaveLength(2);
    });
  });

  // ─── Empty state ───────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('returns success with zero counts when no orgs match', async () => {
      const db = buildMockDb();
      mockGetDb.mockReturnValue(db);

      const res = await onRequestPost(makeCtx('test-secret'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.expiring.sent).toBe(0);
      expect(json.expiring.failed).toBe(0);
      expect(json.expiring.results).toHaveLength(0);
      expect(json.expired.sent).toBe(0);
      expect(json.expired.failed).toBe(0);
      expect(json.expired.results).toHaveLength(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  // ─── Admin alert emails ────────────────────────────────────────────────────

  describe('admin alert emails', () => {
    it('sends admin alert email for expiring trial', async () => {
      const org = makeExpiringOrg();
      const db = buildMockDb({
        expiringOrgs: [org],
        expiringDedupCounts: [{ cnt: 0 }],
      });
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });

      await onRequestPost(makeCtx('test-secret'));

      // Should have 2 sendEmail calls: 1 user email + 1 admin alert
      expect(mockSendEmail).toHaveBeenCalledTimes(2);

      // Second call should be the admin alert
      const adminCall = mockSendEmail.mock.calls[1];
      expect(adminCall[1].to).toBe('admin@test.com');
      expect(adminCall[1].subject).toContain('Trial expiring');
      expect(adminCall[1].subject).toContain('Acme Corp');
      expect(adminCall[1].from).toContain('alerts@ruwt.dev');
      expect(adminCall[1].html).toContain('Acme Corp');
      expect(adminCall[1].html).toContain('Alice');
    });

    it('sends admin alert email for expired trial', async () => {
      const org = makeExpiredOrg();
      const db = buildMockDb({
        expiredOrgs: [org],
        expiredDedupCounts: [{ cnt: 0 }],
      });
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-2' });

      await onRequestPost(makeCtx('test-secret'));

      // Should have 2 sendEmail calls: 1 user email + 1 admin alert
      expect(mockSendEmail).toHaveBeenCalledTimes(2);

      const adminCall = mockSendEmail.mock.calls[1];
      expect(adminCall[1].to).toBe('admin@test.com');
      expect(adminCall[1].subject).toContain('Trial expired');
      expect(adminCall[1].subject).toContain('Beta Inc');
      expect(adminCall[1].from).toContain('alerts@ruwt.dev');
      expect(adminCall[1].html).toContain('Beta Inc');
      expect(adminCall[1].html).toContain('Bob');
    });

    it('sends admin alerts for both expiring and expired in same run', async () => {
      const expiringOrg = makeExpiringOrg();
      const expiredOrg = makeExpiredOrg();

      const allFn = vi.fn()
        .mockResolvedValueOnce([expiringOrg])  // expiring query
        .mockResolvedValueOnce([{ cnt: 0 }])   // dedup for expiring
        .mockResolvedValueOnce([expiredOrg])   // expired query
        .mockResolvedValueOnce([{ cnt: 0 }]);  // dedup for expired

      mockGetDb.mockReturnValue({ all: allFn, run: vi.fn().mockResolvedValue({}) });
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });

      const res = await onRequestPost(makeCtx('test-secret'));
      const json = await res.json();

      expect(json.expiring.sent).toBe(1);
      expect(json.expired.sent).toBe(1);

      // 4 emails total: expiring user + expiring admin + expired user + expired admin
      expect(mockSendEmail).toHaveBeenCalledTimes(4);

      // Verify admin emails
      const adminCalls = mockSendEmail.mock.calls.filter(
        (call: unknown[]) => (call[1] as { to: string }).to === 'admin@test.com',
      );
      expect(adminCalls).toHaveLength(2);
      expect((adminCalls[0][1] as { subject: string }).subject).toContain('Trial expiring');
      expect((adminCalls[1][1] as { subject: string }).subject).toContain('Trial expired');
    });
  });

  // ─── No ERROR_ALERT_EMAIL ─────────────────────────────────────────────────

  describe('handles no ERROR_ALERT_EMAIL gracefully', () => {
    it('still sends user emails when ERROR_ALERT_EMAIL is not configured', async () => {
      const org = makeExpiringOrg();
      const db = buildMockDb({
        expiringOrgs: [org],
        expiringDedupCounts: [{ cnt: 0 }],
      });
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });

      const envWithoutAlert = makeEnv({ ERROR_ALERT_EMAIL: undefined });
      const res = await onRequestPost(makeCtx('test-secret', envWithoutAlert));
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.expiring.sent).toBe(1);

      // Only 1 email call (user email), no admin alert
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][1].to).toBe('owner@acme.com');
    });

    it('still sends expired user emails when ERROR_ALERT_EMAIL is not configured', async () => {
      const org = makeExpiredOrg();
      const db = buildMockDb({
        expiredOrgs: [org],
        expiredDedupCounts: [{ cnt: 0 }],
      });
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-2' });

      const envWithoutAlert = makeEnv({ ERROR_ALERT_EMAIL: undefined });
      const res = await onRequestPost(makeCtx('test-secret', envWithoutAlert));
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.expired.sent).toBe(1);

      // Only 1 email call (user email), no admin alert
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][1].to).toBe('owner@beta.com');
    });
  });

  // ─── Error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns 500 on unexpected error', async () => {
      mockGetDb.mockImplementation(() => { throw new Error('DB connection failed'); });

      const res = await onRequestPost(makeCtx('test-secret'));
      expect(res.status).toBe(500);
      expect((await res.json()).error).toBe('DB connection failed');
    });

    it('returns 500 with "Unknown error" when error has no message', async () => {
      mockGetDb.mockImplementation(() => { throw {}; });

      const res = await onRequestPost(makeCtx('test-secret'));
      expect(res.status).toBe(500);
      expect((await res.json()).error).toBe('Unknown error');
    });
  });

  // ─── Response shape ────────────────────────────────────────────────────────

  describe('response shape', () => {
    it('returns correct response structure with both expiring and expired counts', async () => {
      const expiringOrg = makeExpiringOrg();
      const expiredOrg = makeExpiredOrg();

      const allFn = vi.fn()
        .mockResolvedValueOnce([expiringOrg])  // expiring query
        .mockResolvedValueOnce([{ cnt: 0 }])   // dedup for expiring
        .mockResolvedValueOnce([expiredOrg])   // expired query
        .mockResolvedValueOnce([{ cnt: 0 }]);  // dedup for expired

      mockGetDb.mockReturnValue({ all: allFn, run: vi.fn().mockResolvedValue({}) });
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });

      const res = await onRequestPost(makeCtx('test-secret'));
      const json = await res.json();

      expect(json).toMatchObject({
        success: true,
        expiring: {
          sent: 1,
          failed: 0,
          results: expect.arrayContaining([
            expect.objectContaining({
              email: 'owner@acme.com',
              orgName: 'Acme Corp',
              success: true,
            }),
          ]),
        },
        expired: {
          sent: 1,
          failed: 0,
          results: expect.arrayContaining([
            expect.objectContaining({
              email: 'owner@beta.com',
              orgName: 'Beta Inc',
              success: true,
            }),
          ]),
        },
      });
    });

    it('includes error field in results when email send fails', async () => {
      const org = makeExpiringOrg();
      const db = buildMockDb({
        expiringOrgs: [org],
        expiringDedupCounts: [{ cnt: 0 }],
      });
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: false, error: 'Resend API down' });

      const res = await onRequestPost(makeCtx('test-secret'));
      const json = await res.json();

      expect(json.expiring.results[0]).toMatchObject({
        email: 'owner@acme.com',
        orgName: 'Acme Corp',
        success: false,
        error: 'Resend API down',
      });
    });
  });

  // ─── Template parameters ───────────────────────────────────────────────────

  describe('template parameters', () => {
    it('passes TRIAL_MAX_ASSESSMENTS and TRIAL_MAX_INVITES to trialExpiringEmail', async () => {
      const org = makeExpiringOrg({ trial_assessments_used: 1 });
      const db = buildMockDb({
        expiringOrgs: [org],
        expiringDedupCounts: [{ cnt: 0 }],
      });
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });

      await onRequestPost(makeCtx('test-secret'));

      expect(mockTrialExpiringEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          assessmentsUsed: 1,
          assessmentLimit: expect.any(Number),
          inviteLimit: expect.any(Number),
          daysRemaining: expect.any(Number),
          invitesUsed: expect.any(Number),
          trialEndsAt: expect.any(String),
        }),
      );
    });

    it('passes TRIAL_MAX_ASSESSMENTS to trialExpiredEmail', async () => {
      const org = makeExpiredOrg({ trial_assessments_used: 1 });
      const db = buildMockDb({
        expiredOrgs: [org],
        expiredDedupCounts: [{ cnt: 0 }],
      });
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });

      await onRequestPost(makeCtx('test-secret'));

      expect(mockTrialExpiredEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          assessmentsUsed: 1,
          invitesUsed: expect.any(Number),
        }),
      );
    });

    it('passes null owner_name to template when owner has no name', async () => {
      const org = makeExpiringOrg({ owner_name: null });
      const db = buildMockDb({
        expiringOrgs: [org],
        expiringDedupCounts: [{ cnt: 0 }],
      });
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });

      await onRequestPost(makeCtx('test-secret'));

      expect(mockTrialExpiringEmail).toHaveBeenCalledWith(
        expect.objectContaining({ name: null }),
      );
    });
  });

  // ─── Dedup with mixed results ──────────────────────────────────────────────

  describe('dedup with mixed results', () => {
    it('sends to some orgs and skips deduped ones in same batch', async () => {
      const org1 = makeExpiringOrg({ org_id: 'org-1', owner_id: 'u1', owner_email: 'a@a.com' });
      const org2 = makeExpiringOrg({ org_id: 'org-2', owner_id: 'u2', owner_email: 'b@b.com', org_name: 'Already Sent Corp' });
      const org3 = makeExpiringOrg({ org_id: 'org-3', owner_id: 'u3', owner_email: 'c@c.com', org_name: 'Fresh Corp' });

      const allFn = vi.fn()
        .mockResolvedValueOnce([org1, org2, org3])  // expiring orgs
        .mockResolvedValueOnce([{ cnt: 0 }])         // u1: not sent yet
        .mockResolvedValueOnce([{ cnt: 1 }])         // u2: already sent (skip)
        .mockResolvedValueOnce([{ cnt: 0 }])         // u3: not sent yet
        .mockResolvedValueOnce([]);                   // expired orgs (none)

      mockGetDb.mockReturnValue({ all: allFn, run: vi.fn().mockResolvedValue({}) });
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });

      const res = await onRequestPost(makeCtx('test-secret'));
      const json = await res.json();

      expect(json.expiring.sent).toBe(2);
      expect(json.expiring.results).toHaveLength(2);
      expect(json.expiring.results.map((r: { email: string }) => r.email)).toEqual([
        'a@a.com',
        'c@c.com',
      ]);
    });
  });
});
