import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb, mockBuildAfiShareSvg } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockBuildAfiShareSvg: vi.fn().mockReturnValue('<svg>test-afi</svg>'),
}));

vi.mock('../../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../_shared/og-afi-svg', () => ({ buildAfiShareSvg: mockBuildAfiShareSvg }));
vi.mock('../../../_shared/scoring', () => ({
  determineCertification: vi.fn().mockReturnValue(null),
}));
// Mock resvg-wasm to always fail (SVG fallback path)
vi.mock('@aspect-run/resvg-wasm', () => ({
  Resvg: vi.fn().mockImplementation(() => { throw new Error('no wasm'); }),
  initWasm: vi.fn().mockRejectedValue(new Error('no wasm')),
}));
vi.mock('../../../../drizzle/schema.d1', () => ({
  profiles: { id: 'id', name: 'name', username: 'username', afiScore: 'afi_score', afiTier: 'afi_tier' },
  attempts: { userId: 'user_id', challengeId: 'challenge_id', status: 'status' },
}));

import { onRequestGet } from './[username]';

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx(username: string) {
  return {
    request: new Request(`https://ruwt.dev/api/og/afi/${username}`),
    env: makeEnv(),
    params: { username },
  };
}

describe('GET /api/og/afi/:username', () => {
  beforeEach(() => vi.resetAllMocks());

  it('redirects when username is empty', async () => {
    const res = await onRequestGet(makeCtx(''));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://ruwt.dev/og-image.png');
  });

  it('redirects when profile not found', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });
    const res = await onRequestGet(makeCtx('nonexistent'));
    expect(res.status).toBe(302);
  });

  it('redirects when profile has no afiScore', async () => {
    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ id: 'u1', name: 'Alice', username: 'alice', afiScore: null, afiTier: null }]),
          };
        }
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ solved: 0 }]),
        };
      }),
    };
    mockGetDb.mockReturnValue(db);
    const res = await onRequestGet(makeCtx('alice'));
    expect(res.status).toBe(302);
  });

  it('returns SVG with correct headers on happy path (resvg fallback)', async () => {
    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ id: 'u1', name: 'Alice', username: 'alice', afiScore: 600, afiTier: 'advanced' }]),
          };
        }
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ solved: 20 }]),
        };
      }),
    };
    mockGetDb.mockReturnValue(db);
    mockBuildAfiShareSvg.mockReturnValue('<svg>afi-card</svg>');

    const res = await onRequestGet(makeCtx('alice'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(res.headers.get('Cache-Control')).toContain('public');
    const body = await res.text();
    expect(body).toBe('<svg>afi-card</svg>');
  });

  it('uses profile name for SVG, falls back to username then Anonymous', async () => {
    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ id: 'u1', name: null, username: null, afiScore: 300, afiTier: 'developing' }]),
          };
        }
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ solved: 5 }]),
        };
      }),
    };
    mockGetDb.mockReturnValue(db);

    await onRequestGet(makeCtx('test'));
    expect(mockBuildAfiShareSvg).toHaveBeenCalledWith(expect.objectContaining({ name: 'Anonymous' }));
  });

  it('computes certification category count threshold correctly for 50+ solves', async () => {
    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ id: 'u1', name: 'Pro', username: 'pro', afiScore: 700, afiTier: 'exceptional' }]),
          };
        }
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ solved: 60 }]),
        };
      }),
    };
    mockGetDb.mockReturnValue(db);

    await onRequestGet(makeCtx('pro'));
    // solveCount=60 >= 50, so categoryCount should be 5
    const { determineCertification } = await import('../../../_shared/scoring');
    expect(determineCertification).toHaveBeenCalledWith(60, 5, 700);
  });

  it('computes certification category count threshold for 25-49 solves', async () => {
    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ id: 'u1', name: 'Mid', username: 'mid', afiScore: 500, afiTier: 'proficient' }]),
          };
        }
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ solved: 30 }]),
        };
      }),
    };
    mockGetDb.mockReturnValue(db);

    await onRequestGet(makeCtx('mid'));
    const { determineCertification } = await import('../../../_shared/scoring');
    expect(determineCertification).toHaveBeenCalledWith(30, 3, 500);
  });

  it('computes certification category count threshold for <25 solves', async () => {
    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ id: 'u1', name: 'New', username: 'new', afiScore: 200, afiTier: 'developing' }]),
          };
        }
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ solved: 10 }]),
        };
      }),
    };
    mockGetDb.mockReturnValue(db);

    await onRequestGet(makeCtx('new'));
    const { determineCertification } = await import('../../../_shared/scoring');
    expect(determineCertification).toHaveBeenCalledWith(10, 1, 200);
  });

  it('handles null stats gracefully', async () => {
    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ id: 'u1', name: 'Test', username: 'test', afiScore: 100, afiTier: 'novice' }]),
          };
        }
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([null]),
        };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('test'));
    // Should still succeed with solveCount=0
    expect(res.status).toBe(200);
  });
});
