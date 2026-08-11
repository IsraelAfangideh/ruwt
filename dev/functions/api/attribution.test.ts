import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../_shared/infra/db', () => ({ getDb: mockGetDb }));

const { onRequestPost } = await import('./attribution');

const FAKE_USER = { id: 'u1', email: 'new@example.com' };

/** Update chain that reports how many rows it touched. */
function makeDb(changes: number) {
  const setSpy = vi.fn();
  const whereSpy = vi.fn();
  const chain: Record<string, unknown> = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockImplementation((v: unknown) => { setSpy(v); return chain; });
  chain.where = vi.fn().mockImplementation((w: unknown) => {
    whereSpy(w);
    return Promise.resolve({ meta: { changes } });
  });
  return { db: chain, setSpy, whereSpy };
}

function post(body: unknown) {
  return {
    request: new Request('https://ruwt.dev/api/attribution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: {} as Env,
  };
}

const VALID = {
  referrer: 'news.ycombinator.com',
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  landingPath: '/challenges',
};

describe('POST /api/attribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(FAKE_USER);
  });

  it('rejects an unauthenticated request', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestPost(post(VALID));
    expect(res.status).toBe(401);
  });

  it('records the first report', async () => {
    const { db, setSpy } = makeDb(1);
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(post(VALID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.recorded).toBe(true);
    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({
      referrer: 'news.ycombinator.com',
      landingPath: '/challenges',
      attributedAt: expect.any(String),
    }));
  });

  it('reports recorded:false when a source is already stored', async () => {
    // changes === 0 means the isNull guard matched no row: first touch wins.
    const { db } = makeDb(0);
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(post({ ...VALID, referrer: 'github.com' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.recorded).toBe(false);
  });

  it('stores utm parameters when present', async () => {
    const { db, setSpy } = makeDb(1);
    mockGetDb.mockReturnValue(db);

    await onRequestPost(post({
      ...VALID,
      utmSource: 'twitter',
      utmMedium: 'social',
      utmCampaign: 'launch',
    }));

    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({
      utmSource: 'twitter',
      utmMedium: 'social',
      utmCampaign: 'launch',
    }));
  });

  it('rejects a missing referrer', async () => {
    const res = await onRequestPost(post({ landingPath: '/' }));
    expect(res.status).toBe(400);
  });

  it('rejects an over-long referrer', async () => {
    const res = await onRequestPost(post({ ...VALID, referrer: 'a'.repeat(256) }));
    expect(res.status).toBe(400);
  });

  it('returns 500 when the database throws', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('d1 down'); });
    const res = await onRequestPost(post(VALID));
    expect(res.status).toBe(500);
  });
});
