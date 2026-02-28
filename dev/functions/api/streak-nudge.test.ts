import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb, mockSendEmail } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockSendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../_shared/newsletter/resend', () => ({ sendEmail: mockSendEmail }));

import { onRequestPost } from './streak-nudge';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'u',
    VITE_SUPABASE_ANON_KEY: 'k',
    CRON_SECRET: 'secret-123',
    ...overrides,
  } as Env;
}

function makeCtx(token?: string, env?: Env) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return {
    request: new Request('https://ruwt.dev/api/streak-nudge', { method: 'POST', headers }),
    env: env ?? makeEnv(),
  };
}

describe('POST /api/streak-nudge (cron-secured)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when no auth token', async () => {
    const res = await onRequestPost(makeCtx());
    expect(res.status).toBe(401);
  });

  it('returns 401 when token does not match CRON_SECRET', async () => {
    const res = await onRequestPost(makeCtx('wrong'));
    expect(res.status).toBe(401);
  });

  it('returns success when no daily challenge exists', async () => {
    mockGetDb.mockReturnValue({
      all: vi.fn().mockResolvedValueOnce([]),
      run: vi.fn().mockResolvedValue({}),
    });

    const res = await onRequestPost(makeCtx('secret-123'));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe('No daily challenge today');
    expect(json.sent).toBe(0);
  });

  it('returns success when no eligible users exist', async () => {
    const db = {
      all: vi.fn()
        .mockResolvedValueOnce([{ challenge_id: 'ch-1', title: 'Test', difficulty: 'easy' }])
        .mockResolvedValueOnce([]),
      run: vi.fn().mockResolvedValue({}),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx('secret-123'));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe('No users need nudging');
  });

  it('sends emails and creates notifications for eligible users', async () => {
    const daily = { challenge_id: 'ch-1', title: 'FizzBuzz', difficulty: 'easy' };
    const users = [
      { id: 'u-1', email: 'alice@a.com', name: 'Alice Smith', current_streak: 5 },
    ];

    const db = {
      all: vi.fn()
        .mockResolvedValueOnce([daily])
        .mockResolvedValueOnce(users),
      run: vi.fn().mockResolvedValue({}),
    };
    mockGetDb.mockReturnValue(db);
    mockSendEmail.mockResolvedValue({ success: true });

    const res = await onRequestPost(makeCtx('secret-123'));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.sent).toBe(1);
    expect(json.failed).toBe(0);
    expect(json.results).toHaveLength(1);

    // Verify email content
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const emailArgs = mockSendEmail.mock.calls[0][1];
    expect(emailArgs.to).toBe('alice@a.com');
    expect(emailArgs.subject).toContain('day 5');
    expect(emailArgs.text).toContain('FizzBuzz');

    // Verify in-app notification was created
    expect(db.run).toHaveBeenCalled();
  });

  it('handles users with null name gracefully', async () => {
    const db = {
      all: vi.fn()
        .mockResolvedValueOnce([{ challenge_id: 'ch-1', title: 'T', difficulty: 'easy' }])
        .mockResolvedValueOnce([{ id: 'u-1', email: 'a@a.com', name: null, current_streak: 3 }]),
      run: vi.fn().mockResolvedValue({}),
    };
    mockGetDb.mockReturnValue(db);
    mockSendEmail.mockResolvedValue({ success: true });

    const res = await onRequestPost(makeCtx('secret-123'));
    const json = await res.json();
    expect(json.sent).toBe(1);
    // Subject should not include name prefix
    const subject = mockSendEmail.mock.calls[0][1].subject;
    expect(subject).toBe('day 3. don\'t break the streak.');
  });

  it('tracks failed email sends', async () => {
    const db = {
      all: vi.fn()
        .mockResolvedValueOnce([{ challenge_id: 'ch-1', title: 'T', difficulty: 'easy' }])
        .mockResolvedValueOnce([
          { id: 'u-1', email: 'a@a.com', name: null, current_streak: 3 },
          { id: 'u-2', email: 'b@b.com', name: 'Bob', current_streak: 7 },
        ]),
      run: vi.fn().mockResolvedValue({}),
    };
    mockGetDb.mockReturnValue(db);
    mockSendEmail
      .mockResolvedValueOnce({ success: false, error: 'Rate limit' })
      .mockResolvedValueOnce({ success: true });

    const res = await onRequestPost(makeCtx('secret-123'));
    const json = await res.json();
    expect(json.sent).toBe(1);
    expect(json.failed).toBe(1);
    expect(json.results[0].success).toBe(false);
    expect(json.results[0].error).toBe('Rate limit');
  });

  it('skips in-app notification when streak is 0 or null', async () => {
    const db = {
      all: vi.fn()
        .mockResolvedValueOnce([{ challenge_id: 'ch-1', title: 'T', difficulty: 'easy' }])
        .mockResolvedValueOnce([{ id: 'u-1', email: 'a@a.com', name: null, current_streak: 0 }]),
      run: vi.fn().mockResolvedValue({}),
    };
    mockGetDb.mockReturnValue(db);
    mockSendEmail.mockResolvedValue({ success: true });

    await onRequestPost(makeCtx('secret-123'));
    // db.run should NOT be called because streak is 0
    expect(db.run).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('boom'); });
    const res = await onRequestPost(makeCtx('secret-123'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('boom');
  });
});
