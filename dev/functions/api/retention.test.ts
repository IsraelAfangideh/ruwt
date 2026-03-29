import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb, mockSendEmail, mockGetOrSeedDailyChallenge } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockSendEmail: vi.fn().mockResolvedValue({ success: true, id: 'resend-id' }),
  mockGetOrSeedDailyChallenge: vi.fn(),
}));

vi.mock('../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../_shared/newsletter/resend', () => ({ sendEmail: mockSendEmail }));
vi.mock('../_shared/scoring/daily-seed', () => ({ getOrSeedDailyChallenge: mockGetOrSeedDailyChallenge }));

import { onRequestPost } from './retention';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'u',
    VITE_SUPABASE_ANON_KEY: 'k',
    CRON_SECRET: 'secret-123',
    ...overrides,
  } as Env;
}

function makeCtx(action: string, token?: string, env?: Env) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return {
    request: new Request(`https://ruwt.dev/api/retention?action=${action}`, { method: 'POST', headers }),
    env: env ?? makeEnv(),
  };
}

describe('POST /api/retention', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when no auth token', async () => {
    const res = await onRequestPost(makeCtx('drip'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when no action param', async () => {
    const res = await onRequestPost({
      request: new Request('https://ruwt.dev/api/retention', {
        method: 'POST',
        headers: { Authorization: 'Bearer secret-123' },
      }),
      env: makeEnv(),
    });
    expect(res.status).toBe(400);
  });

  describe('?action=drip', () => {
    it('sends 24h drip to eligible users', async () => {
      const db = {
        all: vi.fn()
          .mockResolvedValueOnce([{ id: 'u-1', email: 'new@test.com', name: 'New User' }]) // 24h users
          .mockResolvedValueOnce([]), // 48h users
        run: vi.fn().mockResolvedValue({}),
      };
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });

      const res = await onRequestPost(makeCtx('drip', 'secret-123'));
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.sent).toBe(1);
      expect(json.results[0].type).toBe('drip_24h');

      const emailArgs = mockSendEmail.mock.calls[0][1];
      expect(emailArgs.to).toBe('new@test.com');
      expect(emailArgs.subject).toBe('the arena is waiting for you');
      expect(emailArgs.text).toContain('CSV Parser');

      // Verify log was written
      expect(db.run).toHaveBeenCalled();
    });

    it('sends 48h drip to users without passes', async () => {
      const db = {
        all: vi.fn()
          .mockResolvedValueOnce([]) // no 24h users
          .mockResolvedValueOnce([{ id: 'u-2', email: 'stuck@test.com', name: null }]), // 48h users
        run: vi.fn().mockResolvedValue({}),
      };
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-2' });

      const res = await onRequestPost(makeCtx('drip', 'secret-123'));
      const json = await res.json();
      expect(json.sent).toBe(1);
      expect(json.results[0].type).toBe('drip_48h');

      const emailArgs = mockSendEmail.mock.calls[0][1];
      expect(emailArgs.subject).toBe('one solve, then you\'ll get it');
    });

    it('returns success with zero sent when no eligible users', async () => {
      const db = {
        all: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
        run: vi.fn(),
      };
      mockGetDb.mockReturnValue(db);

      const res = await onRequestPost(makeCtx('drip', 'secret-123'));
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.sent).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('handles name-less users without prefix', async () => {
      const db = {
        all: vi.fn()
          .mockResolvedValueOnce([{ id: 'u-1', email: 'a@b.com', name: null }])
          .mockResolvedValueOnce([]),
        run: vi.fn().mockResolvedValue({}),
      };
      mockGetDb.mockReturnValue(db);
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });

      await onRequestPost(makeCtx('drip', 'secret-123'));
      const text = mockSendEmail.mock.calls[0][1].text;
      expect(text).not.toContain(' — ');
      expect(text).toMatch(/^you signed up/);
    });
  });

  describe('?action=daily', () => {
    it('sends daily challenge email to all subscribed users', async () => {
      const db = {
        all: vi.fn()
          .mockResolvedValueOnce([
            { id: 'u-1', email: 'a@test.com', name: 'Alice' },
            { id: 'u-2', email: 'b@test.com', name: null },
          ]),
        run: vi.fn().mockResolvedValue({}),
      };
      mockGetDb.mockReturnValue(db);
      mockGetOrSeedDailyChallenge.mockResolvedValue({ challenge_id: 'ch-daily', title: 'FizzBuzz', difficulty: 'easy' });
      mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });

      const res = await onRequestPost(makeCtx('daily', 'secret-123'));
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.sent).toBe(2);
      expect(json.challengeTitle).toBe('FizzBuzz');

      expect(mockSendEmail.mock.calls[0][1].subject).toBe('today\'s challenge: FizzBuzz');
      expect(mockSendEmail.mock.calls[0][1].text).toContain('ruwt.dev/arena/ch-daily');
    });

    it('returns success when no daily challenge available', async () => {
      const db = { all: vi.fn(), run: vi.fn() };
      mockGetDb.mockReturnValue(db);
      mockGetOrSeedDailyChallenge.mockResolvedValue(null);

      const res = await onRequestPost(makeCtx('daily', 'secret-123'));
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('No eligible challenges for daily');
    });

    it('returns success when no eligible users', async () => {
      const db = {
        all: vi.fn().mockResolvedValueOnce([]),
        run: vi.fn(),
      };
      mockGetDb.mockReturnValue(db);
      mockGetOrSeedDailyChallenge.mockResolvedValue({ challenge_id: 'ch-1', title: 'T', difficulty: 'easy' });

      const res = await onRequestPost(makeCtx('daily', 'secret-123'));
      const json = await res.json();
      expect(json.message).toBe('No users due for daily email');
    });
  });

  it('returns 500 on unexpected error', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('db down'); });
    const res = await onRequestPost(makeCtx('drip', 'secret-123'));
    expect(res.status).toBe(500);
  });
});
