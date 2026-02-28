import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb, mockSendEmail } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockSendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
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
});
