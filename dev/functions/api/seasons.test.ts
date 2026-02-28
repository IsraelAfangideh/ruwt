import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../drizzle/schema.d1', () => ({
  seasons: { id: 'id', status: 'status', startsAt: 'starts_at' },
}));

import { onRequestGet } from './seasons';

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx(params = '') {
  return {
    request: new Request(`https://ruwt.dev/api/seasons${params}`),
    env: makeEnv(),
  };
}

describe('GET /api/seasons (public)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns current active season when ?current=true', async () => {
    const season = { id: 's-1', name: 'Season 1', status: 'active', startsAt: '2024-01-01' };
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([season]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestGet(makeCtx('?current=true'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.season).toEqual(season);
  });

  it('returns null season when no active season exists', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestGet(makeCtx('?current=true'));
    const json = await res.json();
    expect(json.season).toBeNull();
  });

  it('returns all seasons sorted by startsAt when no current param', async () => {
    const allSeasons = [
      { id: 's-2', name: 'S2', status: 'active', startsAt: '2024-07-01' },
      { id: 's-1', name: 'S1', status: 'ended', startsAt: '2024-01-01' },
    ];
    const chain = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(allSeasons),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestGet(makeCtx());
    const json = await res.json();
    expect(json.seasons).toHaveLength(2);
    expect(json.seasons[0].id).toBe('s-2');
  });

  it('returns 500 on error', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(500);
  });
});
