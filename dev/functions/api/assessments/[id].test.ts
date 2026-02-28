import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const { mockGetUser, mockGetDb, mockCanManageAssessment } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockCanManageAssessment: vi.fn(),
}));

vi.mock('../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../_shared/org', () => ({ canManageAssessment: mockCanManageAssessment }));

import { onRequestGet, onRequestPut } from './[id]';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = { id: 'user-123', email: 'admin@test.com' };

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeGetContext(id: string) {
  return {
    request: new Request(`https://ruwt.dev/api/assessments/${id}`, { method: 'GET' }),
    env: makeEnv(),
    params: { id },
  };
}

function makePutContext(id: string, body: unknown) {
  return {
    request: new Request(`https://ruwt.dev/api/assessments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
    params: { id },
  };
}

// ── GET tests ────────────────────────────────────────────────────────

describe('GET /api/assessments/:id', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockCanManageAssessment.mockReset();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestGet(makeGetContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 404 when user does not have access', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(false);
    mockGetDb.mockReturnValue({});

    const res = await onRequestGet(makeGetContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Assessment not found');
  });

  it('returns assessment with linked challenges on success', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const assessment = {
      id: 'a-1',
      title: 'Test Assessment',
      description: 'A test',
      timeLimit: 3600,
      status: 'active',
    };
    const linkedChallenges = [
      { sortOrder: 0, challenge: { id: 'ch-1', title: 'Easy', difficulty: 'easy' } },
      { sortOrder: 1, challenge: { id: 'ch-2', title: 'Hard', difficulty: 'hard' } },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue(linkedChallenges);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeGetContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.title).toBe('Test Assessment');
    expect(json.challenges).toHaveLength(2);
    expect(json.challenges[0].sortOrder).toBe(0);
    expect(json.challenges[0].id).toBe('ch-1');
    expect(json.challenges[1].id).toBe('ch-2');
  });
});

// ── PUT tests ────────────────────────────────────────────────────────

describe('PUT /api/assessments/:id', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockCanManageAssessment.mockReset();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPut(makePutContext('a-1', { title: 'New' }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 for invalid update payload', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPut(makePutContext('a-1', { timeLimit: 'not a number' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 404 when user does not have access', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(false);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPut(makePutContext('a-1', { title: 'Updated' }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Assessment not found');
  });

  it('updates only provided fields', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const updatedAssessment = {
      id: 'a-1',
      title: 'New Title',
      description: 'Old desc',
      timeLimit: 3600,
      status: 'active',
    };

    let updateSetValue: any = null;
    const db: Record<string, any> = {};
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((val: any) => {
        updateSetValue = val;
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      }),
    });
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([updatedAssessment]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPut(makePutContext('a-1', { title: 'New Title' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.title).toBe('New Title');
    expect(updateSetValue).toEqual({ title: 'New Title' });
  });

  it('handles status update to active', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    let updateSetValue: any = null;
    const db: Record<string, any> = {};
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((val: any) => {
        updateSetValue = val;
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      }),
    });
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'a-1', status: 'active' }]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    await onRequestPut(makePutContext('a-1', { status: 'active' }));

    expect(updateSetValue).toEqual({ status: 'active' });
  });

  it('allows nullable fields like companyName and welcomeMessage', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    let updateSetValue: any = null;
    const db: Record<string, any> = {};
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((val: any) => {
        updateSetValue = val;
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      }),
    });
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'a-1' }]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    await onRequestPut(makePutContext('a-1', {
      companyName: null,
      companyLogoUrl: 'https://logo.png',
      welcomeMessage: 'Welcome!',
    }));

    expect(updateSetValue.companyName).toBeNull();
    expect(updateSetValue.companyLogoUrl).toBe('https://logo.png');
    expect(updateSetValue.welcomeMessage).toBe('Welcome!');
  });

  it('skips update when no fields are provided', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const db: Record<string, any> = {};
    db.update = vi.fn();
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'a-1', title: 'Unchanged' }]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPut(makePutContext('a-1', {}));
    const json = await res.json();

    expect(res.status).toBe(200);
    // No update call should happen
    expect(db.update).not.toHaveBeenCalled();
    expect(json.title).toBe('Unchanged');
  });

  it('rejects invalid status value', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPut(makePutContext('a-1', { status: 'invalid_status' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 500 on unexpected error in PUT handler', async () => {
    mockGetUser.mockRejectedValue(new Error('DB connection lost'));

    const res = await onRequestPut(makePutContext('a-1', { title: 'Test' }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});

// ── GET error handling ──────────────────────────────────────────────

describe('GET /api/assessments/:id — error handling', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockCanManageAssessment.mockReset();
  });

  it('returns 500 on unexpected error in GET handler', async () => {
    mockGetUser.mockRejectedValue(new Error('Unexpected failure'));

    const res = await onRequestGet(makeGetContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
