import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb, mockSendEmail } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockSendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../_shared/newsletter/resend', () => ({ sendEmail: mockSendEmail }));

import { onRequestPost } from './dormant-alert';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'u',
    VITE_SUPABASE_ANON_KEY: 'k',
    CRON_SECRET: 'secret-123',
    ERROR_ALERT_EMAIL: 'admin@ruwt.dev',
    ...overrides,
  } as Env;
}

function makeCtx(token?: string, env?: Env) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return {
    request: new Request('https://ruwt.dev/api/dormant-alert', { method: 'POST', headers }),
    env: env ?? makeEnv(),
  };
}

describe('POST /api/dormant-alert (cron-secured)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when no Authorization header', async () => {
    const res = await onRequestPost(makeCtx());
    expect(res.status).toBe(401);
  });

  it('returns 401 when token does not match CRON_SECRET', async () => {
    const res = await onRequestPost(makeCtx('wrong-token'));
    expect(res.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is not set', async () => {
    const res = await onRequestPost(makeCtx('any', makeEnv({ CRON_SECRET: undefined })));
    expect(res.status).toBe(401);
  });

  it('returns success with sent=0 when no dormant users found', async () => {
    mockGetDb.mockReturnValue({
      all: vi.fn().mockResolvedValue([]),
    });

    const res = await onRequestPost(makeCtx('secret-123'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.sent).toBe(0);
    expect(json.message).toBe('No newly dormant users');
  });

  it('returns success with sent=0 when ERROR_ALERT_EMAIL is not configured', async () => {
    mockGetDb.mockReturnValue({
      all: vi.fn().mockResolvedValue([{ id: 'u1', name: 'A', email: 'a@a.com', solve_count: 5, last_challenge: 'X', last_activity: '2024-01-01' }]),
    });

    const res = await onRequestPost(makeCtx('secret-123', makeEnv({ ERROR_ALERT_EMAIL: undefined })));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.sent).toBe(0);
    expect(json.message).toBe('No ERROR_ALERT_EMAIL configured');
  });

  it('sends alert email with dormant user info on happy path', async () => {
    const dormantUsers = [
      { id: 'u1', name: 'Alice', email: 'alice@a.com', solve_count: 10, last_challenge: 'FizzBuzz', last_activity: '2024-01-01' },
      { id: 'u2', name: null, email: 'bob@b.com', solve_count: 3, last_challenge: null, last_activity: null },
    ];
    mockGetDb.mockReturnValue({
      all: vi.fn().mockResolvedValue(dormantUsers),
    });
    mockSendEmail.mockResolvedValue({ success: true });

    const res = await onRequestPost(makeCtx('secret-123'));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.dormantUsers).toBe(2);
    expect(json.sent).toBe(1);

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const emailArgs = mockSendEmail.mock.calls[0][1];
    expect(emailArgs.to).toBe('admin@ruwt.dev');
    expect(emailArgs.subject).toContain('2 users went dormant');
    expect(emailArgs.from).toContain('alerts@ruwt.dev');
  });

  it('reports email send failure in response', async () => {
    mockGetDb.mockReturnValue({
      all: vi.fn().mockResolvedValue([
        { id: 'u1', name: 'X', email: 'x@x.com', solve_count: 1, last_challenge: 'Y', last_activity: '2024-01-01' },
      ]),
    });
    mockSendEmail.mockResolvedValue({ success: false, error: 'Rate limit' });

    const res = await onRequestPost(makeCtx('secret-123'));
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.error).toBe('Rate limit');
  });

  it('singular subject when only 1 dormant user', async () => {
    mockGetDb.mockReturnValue({
      all: vi.fn().mockResolvedValue([
        { id: 'u1', name: 'Solo', email: 's@s.com', solve_count: 1, last_challenge: 'X', last_activity: '2024-01-01' },
      ]),
    });
    mockSendEmail.mockResolvedValue({ success: true });

    await onRequestPost(makeCtx('secret-123'));
    const subject = mockSendEmail.mock.calls[0][1].subject;
    expect(subject).toBe('1 user went dormant');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('DB fail'); });
    const res = await onRequestPost(makeCtx('secret-123'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('DB fail');
  });

  describe('?send_user=true (re-engagement)', () => {
    function makeCtxWithSendUser(token?: string, env?: Env) {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return {
        request: new Request('https://ruwt.dev/api/dormant-alert?send_user=true', { method: 'POST', headers }),
        env: env ?? makeEnv(),
      };
    }

    it('sends re-engagement email to dormant user who is subscribed', async () => {
      const dormantUsers = [
        { id: 'u1', name: 'Alice', email: 'alice@a.com', solve_count: 3, last_challenge: 'FizzBuzz', last_activity: new Date(Date.now() - 7 * 86400000).toISOString() },
      ];
      const db = {
        all: vi.fn()
          .mockResolvedValueOnce(dormantUsers)          // dormant query
          .mockResolvedValueOnce([{ newsletter_subscribed: 1 }])  // subscription check
          .mockResolvedValueOnce([{ cnt: 0 }]),          // recent re-engagement check
        run: vi.fn().mockResolvedValue({}),
      };
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });

      const res = await onRequestPost(makeCtxWithSendUser('secret-123'));
      const json = await res.json();
      expect(json.reEngagement).toBeDefined();
      expect(json.reEngagement.sent).toBe(1);

      // First call is the admin alert, second is the user re-engagement
      expect(mockSendEmail).toHaveBeenCalledTimes(2);
      const userEmailArgs = mockSendEmail.mock.calls[1][1];
      expect(userEmailArgs.to).toBe('alice@a.com');
      expect(userEmailArgs.subject).toContain("it's been");
      expect(userEmailArgs.text).toContain("3 challenges");
    });

    it('skips users who unsubscribed from newsletter', async () => {
      const dormantUsers = [
        { id: 'u1', name: 'Unsub', email: 'u@u.com', solve_count: 1, last_challenge: 'X', last_activity: new Date(Date.now() - 7 * 86400000).toISOString() },
      ];
      const db = {
        all: vi.fn()
          .mockResolvedValueOnce(dormantUsers)
          .mockResolvedValueOnce([{ newsletter_subscribed: 0 }]),
        run: vi.fn().mockResolvedValue({}),
      };
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true });

      const res = await onRequestPost(makeCtxWithSendUser('secret-123'));
      const json = await res.json();
      expect(json.reEngagement.sent).toBe(0);
      // Only the admin alert should be sent
      expect(mockSendEmail).toHaveBeenCalledOnce();
    });

    it('skips users who were re-engaged within last 14 days', async () => {
      const dormantUsers = [
        { id: 'u1', name: 'Recent', email: 'r@r.com', solve_count: 2, last_challenge: 'X', last_activity: new Date(Date.now() - 7 * 86400000).toISOString() },
      ];
      const db = {
        all: vi.fn()
          .mockResolvedValueOnce(dormantUsers)
          .mockResolvedValueOnce([{ newsletter_subscribed: 1 }])
          .mockResolvedValueOnce([{ cnt: 1 }]),  // already re-engaged recently
        run: vi.fn().mockResolvedValue({}),
      };
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true });

      const res = await onRequestPost(makeCtxWithSendUser('secret-123'));
      const json = await res.json();
      expect(json.reEngagement.sent).toBe(0);
    });

    it('uses different body for users with zero solves', async () => {
      const dormantUsers = [
        { id: 'u1', name: 'Zero', email: 'z@z.com', solve_count: 0, last_challenge: null, last_activity: new Date(Date.now() - 7 * 86400000).toISOString() },
      ];
      const db = {
        all: vi.fn()
          .mockResolvedValueOnce(dormantUsers)
          .mockResolvedValueOnce([{ newsletter_subscribed: 1 }])
          .mockResolvedValueOnce([{ cnt: 0 }]),
        run: vi.fn().mockResolvedValue({}),
      };
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });

      const res = await onRequestPost(makeCtxWithSendUser('secret-123'));
      const json = await res.json();
      expect(json.reEngagement.sent).toBe(1);

      const userEmailArgs = mockSendEmail.mock.calls[1][1];
      expect(userEmailArgs.text).toContain('never solved a challenge');
    });
  });
});
