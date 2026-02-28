import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb, mockEnsureProfile, mockBuyStreakFreeze } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockEnsureProfile: vi.fn().mockResolvedValue(undefined),
  mockBuyStreakFreeze: vi.fn(),
}));

vi.mock('../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../_shared/ensure-profile', () => ({ ensureProfile: mockEnsureProfile }));
vi.mock('../_shared/streaks', () => ({
  buyStreakFreeze: mockBuyStreakFreeze,
  STREAK_FREEZE_COST: 5000,
}));
vi.mock('../../drizzle/schema.d1', () => ({
  profiles: { id: 'id', currentStreak: 'current_streak', longestStreak: 'longest_streak', lastStreakDate: 'last_streak_date', streakFreezes: 'streak_freezes' },
}));

import { onRequestGet, onRequestPost } from './streak';

const FAKE_USER = { id: 'user-1', email: 'dev@ruwt.dev' };

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeGetCtx() {
  return { request: new Request('https://ruwt.dev/api/streak'), env: makeEnv() };
}

function makePostCtx(body: unknown) {
  return {
    request: new Request('https://ruwt.dev/api/streak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
  };
}

function setupDbProfile(profile: Record<string, any> | null = null) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(profile ? [profile] : []),
  };
  mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });
  return chain;
}

describe('GET /api/streak', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(401);
  });

  it('returns 404 when profile not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    setupDbProfile(null);
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(404);
  });

  it('returns streak info on happy path', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    setupDbProfile({
      currentStreak: 5,
      longestStreak: 12,
      lastStreakDate: '2024-01-05',
      streakFreezes: 2,
    });

    const res = await onRequestGet(makeGetCtx());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.currentStreak).toBe(5);
    expect(json.longestStreak).toBe(12);
    expect(json.lastStreakDate).toBe('2024-01-05');
    expect(json.streakFreezes).toBe(2);
    expect(json.freezeCost).toBe(5000);
  });

  it('returns 500 on error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(500);
  });
});

describe('POST /api/streak', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestPost(makePostCtx({ action: 'buy_freeze' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when action is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const res = await onRequestPost(makePostCtx({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Missing action');
  });

  it('returns 400 for unknown action', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const res = await onRequestPost(makePostCtx({ action: 'nope' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Unknown action');
  });

  it('returns 400 when buyStreakFreeze fails', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockBuyStreakFreeze.mockResolvedValue({ success: false, error: 'Not enough credits' });
    mockGetDb.mockReturnValue({});

    const res = await onRequestPost(makePostCtx({ action: 'buy_freeze' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Not enough credits');
  });

  it('buys freeze and returns updated streak info on happy path', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockBuyStreakFreeze.mockResolvedValue({ success: true });

    const profile = { currentStreak: 5, longestStreak: 10, lastStreakDate: '2024-01-05', streakFreezes: 3 };
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([profile]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestPost(makePostCtx({ action: 'buy_freeze' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.currentStreak).toBe(5);
    expect(json.streakFreezes).toBe(3);
    expect(json.freezeCost).toBe(5000);
  });

  it('handles invalid JSON body gracefully', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const ctx = {
      request: new Request('https://ruwt.dev/api/streak', {
        method: 'POST',
        body: 'not json',
      }),
      env: makeEnv(),
    };
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Missing action');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestPost(makePostCtx({ action: 'buy_freeze' }));
    expect(res.status).toBe(500);
  });
});
