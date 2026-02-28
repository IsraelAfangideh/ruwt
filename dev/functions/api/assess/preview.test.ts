import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));

import { onRequestGet } from './preview';

// ── Helpers ──────────────────────────────────────────────────────────

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeContext(token?: string) {
  const url = token
    ? `https://ruwt.dev/api/assess/preview?token=${token}`
    : 'https://ruwt.dev/api/assess/preview';
  return {
    request: new Request(url, { method: 'GET' }),
    env: makeEnv(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('GET /api/assess/preview', () => {
  beforeEach(() => {
    mockGetDb.mockReset();
  });

  it('returns 400 when token query param is missing', async () => {
    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Missing token');
  });

  it('returns 404 when invite token does not exist', async () => {
    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('nonexistent'));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Invalid invite');
  });

  it('returns expired:true when invite status is completed', async () => {
    const invite = { id: 'inv-1', assessmentId: 'a-1', token: 'tok', status: 'completed', expiresAt: null };
    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([invite]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('tok'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.expired).toBe(true);
    expect(json.status).toBe('completed');
  });

  it('returns expired:true when invite status is expired', async () => {
    const invite = { id: 'inv-1', assessmentId: 'a-1', token: 'tok', status: 'expired', expiresAt: null };
    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([invite]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('tok'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.expired).toBe(true);
    expect(json.status).toBe('expired');
  });

  it('returns expired:true when expiresAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const invite = { id: 'inv-1', assessmentId: 'a-1', token: 'tok', status: 'pending', expiresAt: pastDate };
    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([invite]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('tok'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.expired).toBe(true);
    expect(json.status).toBe('expired');
  });

  it('returns 400 when assessment is not active', async () => {
    const invite = { id: 'inv-1', assessmentId: 'a-1', token: 'tok', status: 'pending', expiresAt: null };
    const draftAssessment = { id: 'a-1', status: 'draft', title: 'Test', timeLimit: 3600 };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([invite]);
        if (selectCallCount === 2) return Promise.resolve([draftAssessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('tok'));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Assessment unavailable');
  });

  it('returns assessment preview with challenge breakdown on success', async () => {
    const invite = { id: 'inv-1', assessmentId: 'a-1', token: 'tok', status: 'pending', expiresAt: null };
    const assessment = {
      id: 'a-1',
      status: 'active',
      title: 'Senior Dev Assessment',
      description: 'Test your skills',
      timeLimit: 5400, // 90 minutes
      companyName: 'Acme Corp',
      companyLogoUrl: 'https://example.com/logo.png',
      welcomeMessage: 'Good luck!',
    };
    const challengeList = [
      { difficulty: 'easy', category: 'model_selection' },
      { difficulty: 'easy', category: 'model_selection' },
      { difficulty: 'medium', category: 'prompt_efficiency' },
      { difficulty: 'hard', category: 'iterative_debugging' },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation((fields?: any) => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 3) return Promise.resolve(challengeList);
        return chain;
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([invite]);
        if (selectCallCount === 2) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('tok'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.title).toBe('Senior Dev Assessment');
    expect(json.description).toBe('Test your skills');
    expect(json.challengeCount).toBe(4);
    expect(json.timeLimitMinutes).toBe(90);
    expect(json.expired).toBe(false);
    expect(json.companyName).toBe('Acme Corp');
    expect(json.companyLogoUrl).toBe('https://example.com/logo.png');
    expect(json.welcomeMessage).toBe('Good luck!');
    expect(json.difficultyBreakdown).toEqual({ easy: 2, medium: 1, hard: 1 });
    expect(json.categoryBreakdown).toEqual({
      model_selection: 2,
      prompt_efficiency: 1,
      iterative_debugging: 1,
    });
  });

  it('uses "practice" for challenges with null category', async () => {
    const invite = { id: 'inv-1', assessmentId: 'a-1', token: 'tok', status: 'pending', expiresAt: null };
    const assessment = {
      id: 'a-1',
      status: 'active',
      title: 'Test',
      description: null,
      timeLimit: 600,
      companyName: null,
      companyLogoUrl: null,
      welcomeMessage: null,
    };
    const challengeList = [
      { difficulty: 'easy', category: null },
      { difficulty: 'easy', category: null },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 3) return Promise.resolve(challengeList);
        return chain;
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([invite]);
        if (selectCallCount === 2) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('tok'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.categoryBreakdown).toEqual({ practice: 2 });
  });

  it('does not require auth (public endpoint)', async () => {
    // This test verifies no getUser mock is needed — preview has no auth check.
    // If auth were required, this would fail since we never configured mockGetUser.
    const invite = { id: 'inv-1', assessmentId: 'a-1', token: 'tok', status: 'completed', expiresAt: null };
    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([invite]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('tok'));
    expect(res.status).toBe(200); // returned expired data — no 401
  });
});
