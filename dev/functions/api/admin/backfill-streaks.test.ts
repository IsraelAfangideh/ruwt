import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../drizzle/schema.d1', () => ({
  profiles: { id: 'id', currentStreak: 'current_streak', longestStreak: 'longest_streak', lastStreakDate: 'last_streak_date' },
  attempts: { userId: 'user_id', status: 'status', submittedAt: 'submitted_at' },
}));

import { onRequestPost } from './backfill-streaks';

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

function makeCtx(env?: Env) {
  return {
    request: new Request('https://ruwt.dev/api/admin/backfill-streaks', { method: 'POST' }),
    env: env ?? makeEnv(),
  };
}

describe('POST /api/admin/backfill-streaks', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestPost(makeCtx());
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not an admin', async () => {
    mockGetUser.mockResolvedValue(REGULAR_USER);
    const res = await onRequestPost(makeCtx());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Forbidden');
  });

  it('returns 403 when ADMIN_USER_IDS is not set', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);
    const res = await onRequestPost(makeCtx(makeEnv({ ADMIN_USER_IDS: undefined })));
    expect(res.status).toBe(403);
  });

  it('computes and updates streaks for users with solve history', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    const today = new Date().toISOString().split('T')[0];
    const yesterday = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().split('T')[0]; })();
    const twoDaysAgo = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 2); return d.toISOString().split('T')[0]; })();

    const allProfiles = [{ id: 'u-1' }, { id: 'u-2' }];

    // u-1: 3-day streak ending today
    const u1Dates = [{ date: today }, { date: yesterday }, { date: twoDaysAgo }];
    // u-2: no solves
    const u2Dates: any[] = [];

    const updateSetWhere = vi.fn().mockResolvedValue({});

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          // allProfiles
          return { from: vi.fn().mockResolvedValue(allProfiles) };
        }
        if (selectCall === 2) {
          // u-1 solve dates
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockResolvedValue(u1Dates),
          };
        }
        if (selectCall === 3) {
          // u-2 solve dates
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockResolvedValue(u2Dates),
          };
        }
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          groupBy: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue([]),
        };
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: updateSetWhere }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.total).toBe(2);
    expect(json.updated).toBe(1);
    expect(json.results).toHaveLength(1);
    expect(json.results[0].userId).toBe('u-1');
    expect(json.results[0].currentStreak).toBe(3);
    expect(json.results[0].longestStreak).toBe(3);
    expect(json.results[0].lastStreakDate).toBe(today);
  });

  it('detects broken streak when last solve was more than 1 day ago', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    const threeDaysAgo = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 3); return d.toISOString().split('T')[0]; })();
    const fourDaysAgo = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 4); return d.toISOString().split('T')[0]; })();

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockResolvedValue([{ id: 'u-1' }]) };
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          groupBy: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue([{ date: threeDaysAgo }, { date: fourDaysAgo }]),
        };
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx());
    const json = await res.json();
    // Streak broken: last solve was 3 days ago -> currentStreak should be 0
    // But longestStreak was 2 (threeDaysAgo + fourDaysAgo consecutive), so it shows in updated
    expect(json.results[0].currentStreak).toBe(0);
    expect(json.results[0].longestStreak).toBe(2);
  });

  it('handles non-consecutive dates correctly (break in streak, longest streak detection)', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    const today = new Date().toISOString().split('T')[0];
    const yesterday = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().split('T')[0]; })();
    // Gap of 1 day, then another pair of consecutive days
    const fourDaysAgo = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 4); return d.toISOString().split('T')[0]; })();
    const fiveDaysAgo = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 5); return d.toISOString().split('T')[0]; })();
    const sixDaysAgo = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 6); return d.toISOString().split('T')[0]; })();

    // Dates (most recent first): today, yesterday, [gap], 4 days ago, 5 days ago, 6 days ago
    // Current streak: 2 (today + yesterday), then gap breaks it
    // Longest streak: 3 (4-5-6 days ago are consecutive)
    const dates = [
      { date: today },
      { date: yesterday },
      { date: fourDaysAgo },
      { date: fiveDaysAgo },
      { date: sixDaysAgo },
    ];

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockResolvedValue([{ id: 'u-1' }]) };
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          groupBy: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue(dates),
        };
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx());
    const json = await res.json();
    expect(json.results[0].currentStreak).toBe(2);
    expect(json.results[0].longestStreak).toBe(3);
  });

  it('handles users with no solves', async () => {
    mockGetUser.mockResolvedValue(ADMIN_USER);

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockResolvedValue([{ id: 'u-1' }]) };
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          groupBy: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue([]),
        };
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx());
    const json = await res.json();
    expect(json.total).toBe(1);
    expect(json.updated).toBe(0);
    expect(json.results).toEqual([]);
  });
});
