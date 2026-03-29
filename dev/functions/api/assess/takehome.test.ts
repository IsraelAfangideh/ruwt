import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (hoisted before vi.mock factories) ─────────────────────────
const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../_shared/infra/db', () => ({ getDb: mockGetDb }));

import { onRequestPost as startHandler } from './takehome/start';
import { onRequestPost as telemetryHandler } from './takehome/telemetry';
import { onRequestPost as submitHandler } from './takehome/submit';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = {
  id: 'user-123',
  email: 'candidate@test.com',
  user_metadata: { full_name: 'Test User', avatar_url: 'https://example.com/avatar.png' },
};

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeContext(body: unknown) {
  return {
    request: new Request('https://ruwt.dev/api/assess/takehome/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
  };
}

// ── Tests: POST /api/assess/takehome/start ────────────────────────

describe('POST /api/assess/takehome/start', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await startHandler(makeContext({ token: 'abc123' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Unauthorized');
  });

  it('returns 400 when token is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    });
    const res = await startHandler(makeContext({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid request');
  });

  it('returns 400 when body is invalid JSON', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const ctx = {
      request: new Request('https://ruwt.dev/api/assess/takehome/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      env: makeEnv(),
    };
    const res = await startHandler(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 404 when invite token does not exist', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await startHandler(makeContext({ token: 'nonexistent' }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Invalid invite link');
  });

  it('returns 400 when invite status is completed', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const invite = { id: 'inv-1', assessmentId: 'assess-1', token: 'tok-1', status: 'completed', expiresAt: null };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue(selectCallCount === 1 ? [invite] : []);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await startHandler(makeContext({ token: 'tok-1' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('This invite has already been used or expired');
  });

  it('returns 400 and marks invite expired when past expiresAt', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const invite = { id: 'inv-1', assessmentId: 'assess-1', token: 'tok-1', status: 'pending', expiresAt: pastDate };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue(selectCallCount === 1 ? [invite] : []);
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await startHandler(makeContext({ token: 'tok-1' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('This invite has expired');
    expect(db.update).toHaveBeenCalled();
  });

  it('returns 400 when assessment is not active', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const invite = { id: 'inv-1', assessmentId: 'assess-1', token: 'tok-1', status: 'pending', expiresAt: null };
    const draftAssessment = { id: 'assess-1', status: 'draft', type: 'takehome', timeLimit: 3600 };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([invite]);
        if (selectCallCount === 2) return Promise.resolve([draftAssessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await startHandler(makeContext({ token: 'tok-1' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Assessment is not available');
  });

  it('returns 400 when assessment is not a take-home type', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const invite = { id: 'inv-1', assessmentId: 'assess-1', token: 'tok-1', status: 'pending', expiresAt: null };
    const assessment = { id: 'assess-1', status: 'active', type: 'challenge_based', timeLimit: 3600 };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([invite]);
        if (selectCallCount === 2) return Promise.resolve([assessment]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await startHandler(makeContext({ token: 'tok-1' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('This is not a take-home assessment');
  });

  it('returns existing session when user already has one', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const invite = { id: 'inv-1', assessmentId: 'assess-1', token: 'tok-1', status: 'pending', expiresAt: null };
    const assessment = {
      id: 'assess-1', status: 'active', type: 'takehome', timeLimit: 3600,
      repoUrl: 'https://github.com/org/repo', instructions: 'Build it', allowedModels: '["gpt-4"]',
    };
    const existingSession = { id: 'sess-1', assessmentId: 'assess-1', userId: 'user-123', status: 'in_progress' };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([invite]);
        if (selectCallCount === 2) return Promise.resolve([assessment]);
        if (selectCallCount === 3) return Promise.resolve([existingSession]);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await startHandler(makeContext({ token: 'tok-1' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.isExisting).toBe(true);
    expect(json.sessionId).toBe('sess-1');
    expect(json.repoUrl).toBe('https://github.com/org/repo');
    expect(json.instructions).toBe('Build it');
    expect(json.allowedModels).toEqual(['gpt-4']);
  });

  it('creates session and returns 201 on success', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const invite = { id: 'inv-1', assessmentId: 'assess-1', token: 'tok-1', status: 'pending', expiresAt: null };
    const assessment = {
      id: 'assess-1', status: 'active', type: 'takehome', timeLimit: 7200,
      repoUrl: 'https://github.com/org/repo', instructions: 'Build a REST API',
      allowedModels: null,
    };

    // Flow:
    // 1. invite lookup -> .limit(1)
    // 2. assessment lookup -> .limit(1)
    // 3. existing session lookup -> .limit(1) (empty)
    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.insert = vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => ({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      })),
    }));
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([invite]);
        if (currentCall === 2) return Promise.resolve([assessment]);
        if (currentCall === 3) return Promise.resolve([]); // no existing session
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await startHandler(makeContext({ token: 'tok-1' }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.isExisting).toBe(false);
    expect(json.sessionId).toBeDefined();
    expect(json.repoUrl).toBe('https://github.com/org/repo');
    expect(json.instructions).toBe('Build a REST API');
    expect(json.timeLimit).toBe(7200);
    expect(json.allowedModels).toBeNull();

    // Verify session insert + invite update
    expect(db.insert).toHaveBeenCalledTimes(2); // profile + session
    expect(db.update).toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await startHandler(makeContext({ token: 'tok-1' }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });
});

// ── Tests: POST /api/assess/takehome/telemetry ──────────────────────

describe('POST /api/assess/takehome/telemetry', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
  });

  function makeTelemetryContext(body: unknown) {
    return {
      request: new Request('https://ruwt.dev/api/assess/takehome/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      env: makeEnv(),
    };
  }

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await telemetryHandler(makeTelemetryContext({ sessionId: 'x', eventType: 'ai_call', data: {} }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when body is invalid', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const res = await telemetryHandler(makeTelemetryContext({ bad: true }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when eventType is invalid', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const res = await telemetryHandler(makeTelemetryContext({ sessionId: 'x', eventType: 'invalid' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when session not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await telemetryHandler(makeTelemetryContext({ sessionId: 'x', eventType: 'ai_call', data: {} }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when session is not in progress', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const session = { id: 'sess-1', userId: 'user-123', status: 'completed', totalCost: 0, totalTokens: 0 };
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([session]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await telemetryHandler(makeTelemetryContext({ sessionId: 'sess-1', eventType: 'ai_call', data: {} }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Session is not active');
  });

  it('records telemetry and updates session totals for ai_call', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const session = { id: 'sess-1', userId: 'user-123', status: 'in_progress', totalCost: 100, totalTokens: 500 };
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([session]);
      return chain;
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await telemetryHandler(makeTelemetryContext({
      sessionId: 'sess-1',
      eventType: 'ai_call',
      data: { model: 'gpt-4', cost: 50, inputTokens: 100, outputTokens: 200 },
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(db.insert).toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });

  it('records telemetry without updating totals for file_change', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const session = { id: 'sess-1', userId: 'user-123', status: 'in_progress', totalCost: 0, totalTokens: 0 };
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([session]);
      return chain;
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await telemetryHandler(makeTelemetryContext({
      sessionId: 'sess-1',
      eventType: 'file_change',
      data: { file: 'index.js' },
    }));
    expect(res.status).toBe(200);
    expect(db.insert).toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await telemetryHandler(makeTelemetryContext({ sessionId: 'x', eventType: 'ai_call', data: {} }));
    expect(res.status).toBe(500);
  });
});

// ── Tests: POST /api/assess/takehome/submit ─────────────────────────

describe('POST /api/assess/takehome/submit', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
  });

  function makeSubmitContext(body: unknown) {
    return {
      request: new Request('https://ruwt.dev/api/assess/takehome/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      env: makeEnv(),
    };
  }

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await submitHandler(makeSubmitContext({ sessionId: 'x', files: {} }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when body is invalid', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    const res = await submitHandler(makeSubmitContext({}));
    expect(res.status).toBe(400);
  });

  it('returns 404 when session not found', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await submitHandler(makeSubmitContext({ sessionId: 'x', files: {} }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when session is not in progress', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const session = { id: 'sess-1', userId: 'user-123', status: 'completed', shareToken: 'abc' };
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([session]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await submitHandler(makeSubmitContext({ sessionId: 'sess-1', files: { 'index.js': 'code' } }));
    expect(res.status).toBe(400);
  });

  it('submits successfully with telemetry summary', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    const session = { id: 'sess-1', userId: 'user-123', status: 'in_progress', shareToken: 'share123' };
    const telemetryEvents = [
      { id: 't1', sessionId: 'sess-1', eventType: 'ai_call', data: JSON.stringify({ model: 'gpt-4', cost: 50 }) },
      { id: 't2', sessionId: 'sess-1', eventType: 'ai_call', data: JSON.stringify({ model: 'claude-3', cost: 30 }) },
      { id: 't3', sessionId: 'sess-1', eventType: 'file_change', data: '{}' },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (currentCall === 1) {
          chain.limit = vi.fn().mockResolvedValue([session]);
        } else {
          // telemetry events query (no limit)
          return Promise.resolve(telemetryEvents);
        }
        return chain;
      });
      chain.limit = vi.fn().mockResolvedValue([session]);
      return chain;
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await submitHandler(makeSubmitContext({
      sessionId: 'sess-1',
      files: { 'index.js': 'console.log("done")', 'utils.js': 'export {}' },
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.shareToken).toBe('share123');
    expect(json.summary.aiCallCount).toBe(2);
    expect(json.summary.totalCost).toBe(80);
    expect(json.summary.modelsUsed).toEqual(expect.arrayContaining(['gpt-4', 'claude-3']));
    expect(json.summary.fileCount).toBe(2);
    expect(db.update).toHaveBeenCalled(); // session marked completed
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await submitHandler(makeSubmitContext({ sessionId: 'x', files: {} }));
    expect(res.status).toBe(500);
  });
});
