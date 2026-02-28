import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb, mockEnsureProfile } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockEnsureProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../_shared/ensure-profile', () => ({ ensureProfile: mockEnsureProfile }));
vi.mock('../_shared/badges', () => ({
  BADGE_DEFS: {
    first_solve: { type: 'first_solve', title: 'First Blood', description: 'Solved your first challenge', icon: 'target' },
    penny_pincher: { type: 'penny_pincher', title: 'Penny Pincher', description: 'Under $0.01', icon: 'money' },
  },
}));
vi.mock('../../drizzle/schema.d1', () => ({
  badges: { userId: 'user_id', earnedAt: 'earned_at' },
}));

import { onRequestGet } from './badges';

const FAKE_USER = { id: 'user-1', email: 'dev@ruwt.dev' };

function makeCtx() {
  return {
    request: new Request('https://ruwt.dev/api/badges'),
    env: { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env,
  };
}

describe('GET /api/badges', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Unauthorized');
  });

  it('returns earned badges and full catalog on happy path', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const earned = [{ id: 'b-1', userId: 'user-1', badgeType: 'first_solve', earnedAt: '2024-01-01' }];

    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(earned),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.earned).toHaveLength(1);
    expect(json.earned[0].badgeType).toBe('first_solve');
    expect(json.catalog).toHaveLength(2);
    expect(json.catalog.map((c: any) => c.type)).toContain('first_solve');
    expect(json.catalog.map((c: any) => c.type)).toContain('penny_pincher');
  });

  it('calls ensureProfile before querying badges', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    await onRequestGet(makeCtx());
    expect(mockEnsureProfile).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(500);
  });
});
