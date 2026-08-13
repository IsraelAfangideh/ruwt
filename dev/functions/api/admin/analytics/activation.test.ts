import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/infra/db', () => ({ getDb: mockGetDb }));

import { onRequestGet } from './activation';

const ADMIN_USER = { id: 'admin-1', email: 'admin@ruwt.dev' };
const REGULAR_USER = { id: 'user-1', email: 'dev@ruwt.dev' };

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'u',
    VITE_SUPABASE_ANON_KEY: 'k',
    ADMIN_USER_IDS: 'admin-1,admin-2',
    ...overrides,
  } as Env;
}

function makeCtx(url = 'https://ruwt.dev/api/admin/analytics/activation', env?: Env) {
  return { request: new Request(url), env: env ?? makeEnv() };
}

function mockDb(summary: unknown[], weekly: unknown[]) {
  const db = { all: vi.fn().mockResolvedValueOnce(summary).mockResolvedValueOnce(weekly) };
  mockGetDb.mockReturnValue(db);
  return db;
}

describe('GET /api/admin/analytics/activation', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not an admin', async () => {
    mockGetUser.mockResolvedValue(REGULAR_USER);
    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Forbidden');
  });

  it('returns 403 when ADMIN_USER_IDS is not set', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);
    const res = await onRequestGet(makeCtx(undefined, makeEnv({ ADMIN_USER_IDS: undefined })));
    expect(res.status).toBe(403);
  });

  it('computes the funnel, headline pass-rate, and weekly trend', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);
    mockDb(
      [{ signups: 8, opened: 6, used_ai_first_attempt: 4, passed_first_session: 5, returned: 2 }],
      [
        { week: '2026-32', signups: 5, passed_first_session: 3 },
        { week: '2026-31', signups: 3, passed_first_session: 2 },
      ],
    );

    const res = await onRequestGet(makeCtx());
    const json = await res.json();

    expect(json.windowDays).toBe(30);
    expect(json.headline).toEqual({
      metric: 'first-session pass-rate',
      value: 62.5,
      target: 50,
      meetsTarget: true,
    });
    expect(json.funnel).toEqual({
      signups: 8,
      openedChallenge: 6,
      usedAiOnFirstAttempt: 4,
      passedFirstSession: 5,
      returnedAfterFirstSession: 2,
    });
    expect(json.rates.firstSessionPassRate).toBe(62.5);
    expect(json.rates.openRate).toBe(75);
    expect(json.rates.aiUseRateOfOpeners).toBe(66.7);
    expect(json.rates.returnRate).toBe(25);
    expect(json.weekly).toHaveLength(2);
    expect(json.weekly[0]).toEqual({ week: '2026-32', signups: 5, passedFirstSession: 3, firstSessionPassRate: 60 });
  });

  it('flags meetsTarget false below the 50% target', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);
    mockDb([{ signups: 10, opened: 4, used_ai_first_attempt: 1, passed_first_session: 3, returned: 0 }], []);

    const json = await (await onRequestGet(makeCtx())).json();
    expect(json.headline.value).toBe(30);
    expect(json.headline.meetsTarget).toBe(false);
  });

  it('clamps the days window param (default 30, max 365, min 1, zero -> 1, non-numeric -> 30)', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    mockDb([{ signups: 0, opened: 0, used_ai_first_attempt: 0, passed_first_session: 0, returned: 0 }], []);
    expect((await (await onRequestGet(makeCtx('https://ruwt.dev/api/admin/analytics/activation?days=7'))).json()).windowDays).toBe(7);

    mockDb([{ signups: 0, opened: 0, used_ai_first_attempt: 0, passed_first_session: 0, returned: 0 }], []);
    expect((await (await onRequestGet(makeCtx('https://ruwt.dev/api/admin/analytics/activation?days=0'))).json()).windowDays).toBe(1);

    mockDb([{ signups: 0, opened: 0, used_ai_first_attempt: 0, passed_first_session: 0, returned: 0 }], []);
    expect((await (await onRequestGet(makeCtx('https://ruwt.dev/api/admin/analytics/activation?days=9999'))).json()).windowDays).toBe(365);

    mockDb([{ signups: 0, opened: 0, used_ai_first_attempt: 0, passed_first_session: 0, returned: 0 }], []);
    expect((await (await onRequestGet(makeCtx('https://ruwt.dev/api/admin/analytics/activation?days=abc'))).json()).windowDays).toBe(30);
  });

  it('handles an empty cohort gracefully', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);
    mockDb([], []);

    const json = await (await onRequestGet(makeCtx())).json();
    expect(json.funnel.signups).toBe(0);
    expect(json.headline.value).toBe(0);
    expect(json.headline.meetsTarget).toBe(false);
    expect(json.rates.firstSessionPassRate).toBe(0);
    expect(json.weekly).toEqual([]);
  });
});
