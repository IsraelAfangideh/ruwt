import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock('../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../../drizzle/schema.d1', () => ({
  profiles: {},
  attempts: {},
  challenges: {},
}));

import { onRequestGet } from './stats';

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeContext() {
  return {
    request: new Request('https://ruwt.dev/api/stats'),
    env: makeEnv(),
  };
}

describe('GET /api/stats (public)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns platform statistics on happy path', async () => {
    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        const chain = { from: vi.fn().mockReturnThis() };

        if (selectCall === 1) {
          // user count
          (chain.from as any).mockResolvedValue([{ count: 150 }]);
        } else if (selectCall === 2) {
          // challenge count
          (chain.from as any).mockResolvedValue([{ count: 30 }]);
        } else {
          // solve stats
          (chain.from as any).mockResolvedValue([{ solves: 500, totalSpend: 100000, avgSolveCost: 200 }]);
        }
        return chain;
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.users).toBe(150);
    expect(json.challenges).toBe(30);
    expect(json.solves).toBe(500);
    expect(json.totalSpend).toBe(100000);
    expect(json.avgSolveCost).toBe(200);
  });

  it('handles null counts gracefully', async () => {
    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        const chain = { from: vi.fn().mockReturnThis() };
        if (selectCall <= 2) {
          (chain.from as any).mockResolvedValue([{ count: null }]);
        } else {
          (chain.from as any).mockResolvedValue([{ solves: null, totalSpend: null, avgSolveCost: null }]);
        }
        return chain;
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext());
    const json = await res.json();
    expect(json.users).toBe(0);
    expect(json.challenges).toBe(0);
    expect(json.solves).toBe(0);
    expect(json.totalSpend).toBe(0);
    expect(json.avgSolveCost).toBe(0);
  });

  it('handles empty result array (undefined row)', async () => {
    const db = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockResolvedValue([undefined]),
      })),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext());
    const json = await res.json();
    expect(json.users).toBe(0);
  });

  it('returns 500 on error', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeContext());
    expect(res.status).toBe(500);
  });
});
