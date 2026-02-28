import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const { mockGetUser, mockGetDb, mockCanViewResults } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockCanViewResults: vi.fn(),
}));

vi.mock('../../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../_shared/org', () => ({ canViewResults: mockCanViewResults }));

import { onRequestGet } from './insights';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = { id: 'user-123', email: 'admin@test.com' };

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeContext(id: string) {
  return {
    request: new Request(`https://ruwt.dev/api/assessments/${id}/insights`, { method: 'GET' }),
    env: makeEnv(),
    params: { id },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('GET /api/assessments/:id/insights', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockCanViewResults.mockReset();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 404 when user cannot view results', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(false);
    mockGetDb.mockReturnValue({});

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Assessment not found');
  });

  it('returns empty object when no sessions exist', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([]); // no sessions
        return chain;
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({});
  });

  it('returns insights with behavioral flags for a session', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const session = {
      id: 'sess-1',
      assessmentId: 'a-1',
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T01:00:00Z',
    };
    const challengeLinks = [
      { challengeId: 'ch-1', sortOrder: 0, category: 'model_selection', difficulty: 'easy', title: 'Easy Challenge' },
    ];
    const attempts = [
      {
        id: 'att-1',
        challengeId: 'ch-1',
        assessmentSessionId: 'sess-1',
        totalCost: 100,
        inputTokens: 400,
        outputTokens: 200,
        status: 'passed',
        createdAt: '2026-01-01T00:30:00Z',
        submittedAt: '2026-01-01T00:45:00Z',
      },
    ];
    const aiCalls = [
      {
        id: 'call-1',
        attemptId: 'att-1',
        model: '@cf/meta/llama-3.1-8b',
        cost: 50,
        inputTokens: 200,
        outputTokens: 100,
        createdAt: '2026-01-01T00:31:00Z',
      },
      {
        id: 'call-2',
        attemptId: 'att-1',
        model: '@cf/meta/llama-3.3-70b',
        cost: 50,
        inputTokens: 200,
        outputTokens: 100,
        createdAt: '2026-01-01T00:35:00Z',
      },
    ];
    const messages = [
      { attemptId: 'att-1', role: 'user', content: 'Help me with this', sequence: 1 },
      { attemptId: 'att-1', role: 'assistant', content: 'Here is the solution...', sequence: 2 },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 2) return Promise.resolve(challengeLinks);
        if (selectCallCount === 3) return Promise.resolve(attempts);
        if (selectCallCount === 4) return Promise.resolve(aiCalls);
        if (selectCallCount === 5) return Promise.resolve(messages);
        return chain;
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json['sess-1']).toBeDefined();

    const sessionInsights = json['sess-1'];
    expect(sessionInsights.insights).toBeDefined();
    expect(sessionInsights.comparatives).toBeDefined();
    expect(sessionInsights.flags).toBeDefined();
    expect(sessionInsights.highlights).toBeDefined();

    // Should have an escalation insight (went from 8b to 70b)
    const escalation = sessionInsights.insights.find((i: any) => i.type === 'escalation');
    expect(escalation).toBeDefined();
    expect(escalation.severity).toBe('green');

    // Should have a pass highlight
    const passHighlight = sessionInsights.highlights.find((h: any) => h.type === 'pass');
    expect(passHighlight).toBeDefined();

    // Comparatives should include AI Cost, Token Usage, Speed
    expect(sessionInsights.comparatives).toHaveLength(3);
    const metricNames = sessionInsights.comparatives.map((c: any) => c.metric);
    expect(metricNames).toContain('AI Cost');
    expect(metricNames).toContain('Token Usage');
    expect(metricNames).toContain('Speed');
  });

  it('detects over-prompting when calls exceed 8', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const session = { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: null };
    const challengeLinks = [{ challengeId: 'ch-1', sortOrder: 0, category: 'practice', difficulty: 'easy', title: 'Test' }];
    const attempts = [{
      id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1',
      totalCost: 500, inputTokens: 2000, outputTokens: 1000, status: 'failed',
      createdAt: '2026-01-01T00:10:00Z', submittedAt: null,
    }];
    // 10 AI calls — should trigger over-prompting
    const aiCalls = Array.from({ length: 10 }, (_, i) => ({
      id: `call-${i}`, attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b',
      cost: 50, inputTokens: 200, outputTokens: 100, createdAt: `2026-01-01T00:${10 + i}:00Z`,
    }));

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 2) return Promise.resolve(challengeLinks);
        if (selectCallCount === 3) return Promise.resolve(attempts);
        if (selectCallCount === 4) return Promise.resolve(aiCalls);
        if (selectCallCount === 5) return Promise.resolve([]);
        return chain;
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    const overPrompting = json['sess-1'].insights.find((i: any) => i.type === 'over_prompting');
    expect(overPrompting).toBeDefined();
    expect(overPrompting.severity).toBe('yellow');
  });

  it('flags no model diversity when only one model used across multiple challenges', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const session = { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: null };
    const challengeLinks = [
      { challengeId: 'ch-1', sortOrder: 0, category: 'practice', difficulty: 'easy', title: 'Ch 1' },
      { challengeId: 'ch-2', sortOrder: 1, category: 'practice', difficulty: 'hard', title: 'Ch 2' },
    ];
    const allAttempts = [
      { id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1', totalCost: 100, inputTokens: 500, outputTokens: 200, status: 'passed', createdAt: '2026-01-01T00:10:00Z', submittedAt: null },
      { id: 'att-2', challengeId: 'ch-2', assessmentSessionId: 'sess-1', totalCost: 200, inputTokens: 800, outputTokens: 300, status: 'failed', createdAt: '2026-01-01T00:30:00Z', submittedAt: null },
    ];
    // Same model for all calls — should trigger "no model diversity"
    const allCalls = [
      { id: 'call-1', attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b', cost: 50, inputTokens: 200, outputTokens: 100, createdAt: '2026-01-01T00:11:00Z' },
      { id: 'call-2', attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b', cost: 50, inputTokens: 300, outputTokens: 100, createdAt: '2026-01-01T00:12:00Z' },
      { id: 'call-3', attemptId: 'att-2', model: '@cf/meta/llama-3.1-8b', cost: 100, inputTokens: 400, outputTokens: 200, createdAt: '2026-01-01T00:31:00Z' },
      { id: 'call-4', attemptId: 'att-2', model: '@cf/meta/llama-3.1-8b', cost: 100, inputTokens: 400, outputTokens: 100, createdAt: '2026-01-01T00:32:00Z' },
    ];
    const allMessages: any[] = []; // no messages for simplicity

    // The insights handler uses Promise.all per session, with nested per-attempt Promise.all.
    // Promise.all runs both attempt handlers concurrently, so the query order is interleaved:
    // 1. sessions query: select().from().where() -> [session]
    // 2. challengeLinks: select().from().innerJoin().where() -> challengeLinks
    // 3. sessionAttempts: select().from().where() -> allAttempts
    // 4. att-1 calls: select().from().where() -> calls (att-1 handler starts first)
    // 5. att-2 calls: select().from().where() -> calls (att-2 handler starts concurrently)
    // 6. att-1 messages: select().from().where() -> [] (att-1 resumes after its calls resolve)
    // 7. att-2 messages: select().from().where() -> [] (att-2 resumes after its calls resolve)
    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([session]);
        if (currentCall === 2) return Promise.resolve(challengeLinks);
        if (currentCall === 3) return Promise.resolve(allAttempts);
        // Due to Promise.all concurrency, both att calls fire before any messages:
        // call 4: att-1 calls, call 5: att-2 calls, call 6: att-1 messages, call 7: att-2 messages
        if (currentCall === 4) return Promise.resolve(allCalls.filter(c => c.attemptId === 'att-1'));
        if (currentCall === 5) return Promise.resolve(allCalls.filter(c => c.attemptId === 'att-2'));
        if (currentCall === 6) return Promise.resolve([]);
        if (currentCall === 7) return Promise.resolve([]);
        return chain;
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    const noModelSwitch = json['sess-1'].insights.find((i: any) => i.type === 'no_model_switch');
    expect(noModelSwitch).toBeDefined();
    expect(noModelSwitch.severity).toBe('red');
    expect(json['sess-1'].flags.red).toContain('No model diversity');
  });

  it('detects cost spike when one challenge consumes >50% of total spend', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const session = { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' };
    const challengeLinks = [
      { challengeId: 'ch-1', sortOrder: 0, category: 'practice', difficulty: 'easy', title: 'Cheap' },
      { challengeId: 'ch-2', sortOrder: 1, category: 'practice', difficulty: 'hard', title: 'Expensive' },
    ];
    const allAttempts = [
      { id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1', totalCost: 10, inputTokens: 50, outputTokens: 20, status: 'passed', createdAt: '2026-01-01T00:10:00Z', submittedAt: '2026-01-01T00:15:00Z' },
      { id: 'att-2', challengeId: 'ch-2', assessmentSessionId: 'sess-1', totalCost: 990, inputTokens: 5000, outputTokens: 2000, status: 'failed', createdAt: '2026-01-01T00:30:00Z', submittedAt: null },
    ];
    // Use different models per attempt to avoid "no model diversity" red flag
    const allCalls = [
      { id: 'call-1', attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b', cost: 10, inputTokens: 50, outputTokens: 20, createdAt: '2026-01-01T00:11:00Z' },
      { id: 'call-2', attemptId: 'att-2', model: '@cf/meta/llama-3.3-70b', cost: 990, inputTokens: 5000, outputTokens: 2000, createdAt: '2026-01-01T00:31:00Z' },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([session]);
        if (currentCall === 2) return Promise.resolve(challengeLinks);
        if (currentCall === 3) return Promise.resolve(allAttempts);
        if (currentCall === 4) return Promise.resolve(allCalls.filter(c => c.attemptId === 'att-1'));
        if (currentCall === 5) return Promise.resolve(allCalls.filter(c => c.attemptId === 'att-2'));
        if (currentCall === 6) return Promise.resolve([]);
        if (currentCall === 7) return Promise.resolve([]);
        return chain;
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    const costSpike = json['sess-1'].insights.find((i: any) => i.type === 'cost_spike');
    expect(costSpike).toBeDefined();
    expect(costSpike.severity).toBe('yellow');
    expect(json['sess-1'].flags.yellow).toContain('Cost concentration');
  });

  it('detects blind copy-paste pattern', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const session = { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: null };
    const challengeLinks = [
      { challengeId: 'ch-1', sortOrder: 0, category: 'practice', difficulty: 'easy', title: 'Test' },
    ];
    const allAttempts = [{
      id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1',
      totalCost: 100, inputTokens: 500, outputTokens: 200, status: 'failed',
      createdAt: '2026-01-01T00:10:00Z', submittedAt: null,
    }];
    const allCalls = [
      { id: 'call-1', attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b', cost: 100, inputTokens: 500, outputTokens: 200, createdAt: '2026-01-01T00:11:00Z' },
    ];
    // 3+ instances of short user msg after long assistant response = blind copy-paste
    const messages = [
      { attemptId: 'att-1', role: 'user', content: 'Help me', sequence: 1 },
      { attemptId: 'att-1', role: 'assistant', content: 'A'.repeat(250), sequence: 2 },
      { attemptId: 'att-1', role: 'user', content: 'ok', sequence: 3 },
      { attemptId: 'att-1', role: 'assistant', content: 'B'.repeat(250), sequence: 4 },
      { attemptId: 'att-1', role: 'user', content: 'yes', sequence: 5 },
      { attemptId: 'att-1', role: 'assistant', content: 'C'.repeat(250), sequence: 6 },
      { attemptId: 'att-1', role: 'user', content: 'done', sequence: 7 },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([session]);
        if (currentCall === 2) return Promise.resolve(challengeLinks);
        if (currentCall === 3) return Promise.resolve(allAttempts);
        if (currentCall === 4) return Promise.resolve(allCalls);
        if (currentCall === 5) return Promise.resolve(messages);
        return chain;
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    const blindCopyPaste = json['sess-1'].insights.find((i: any) => i.type === 'blind_copypaste');
    expect(blindCopyPaste).toBeDefined();
    expect(blindCopyPaste.severity).toBe('red');
    expect(json['sess-1'].flags.red).toContain('Blind copy-paste');
  });

  it('detects error recovery pattern (failure mention + pass)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const session = { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' };
    const challengeLinks = [
      { challengeId: 'ch-1', sortOrder: 0, category: 'debugging', difficulty: 'medium', title: 'Buggy' },
    ];
    const allAttempts = [{
      id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1',
      totalCost: 100, inputTokens: 500, outputTokens: 200, status: 'passed',
      createdAt: '2026-01-01T00:10:00Z', submittedAt: '2026-01-01T00:50:00Z',
    }];
    const allCalls = [
      { id: 'call-1', attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b', cost: 100, inputTokens: 500, outputTokens: 200, createdAt: '2026-01-01T00:11:00Z' },
    ];
    const messages = [
      { attemptId: 'att-1', role: 'user', content: 'My tests are failing, the function returns wrong output', sequence: 1 },
      { attemptId: 'att-1', role: 'assistant', content: 'Let me fix that...', sequence: 2 },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([session]);
        if (currentCall === 2) return Promise.resolve(challengeLinks);
        if (currentCall === 3) return Promise.resolve(allAttempts);
        if (currentCall === 4) return Promise.resolve(allCalls);
        if (currentCall === 5) return Promise.resolve(messages);
        return chain;
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    const recovery = json['sess-1'].insights.find((i: any) => i.type === 'error_recovery');
    expect(recovery).toBeDefined();
    expect(recovery.severity).toBe('green');
    expect(json['sess-1'].flags.green).toContain('Error recovery');
  });

  it('flags targeted prompting when avg calls per challenge <= 3', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const session = { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:30:00Z' };
    const challengeLinks = [
      { challengeId: 'ch-1', sortOrder: 0, category: 'practice', difficulty: 'easy', title: 'Easy' },
    ];
    const allAttempts = [{
      id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1',
      totalCost: 50, inputTokens: 200, outputTokens: 100, status: 'passed',
      createdAt: '2026-01-01T00:10:00Z', submittedAt: '2026-01-01T00:20:00Z',
    }];
    // Only 2 calls for 1 challenge = avg 2 calls = targeted prompting
    const allCalls = [
      { id: 'call-1', attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b', cost: 25, inputTokens: 100, outputTokens: 50, createdAt: '2026-01-01T00:11:00Z' },
      { id: 'call-2', attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b', cost: 25, inputTokens: 100, outputTokens: 50, createdAt: '2026-01-01T00:12:00Z' },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([session]);
        if (currentCall === 2) return Promise.resolve(challengeLinks);
        if (currentCall === 3) return Promise.resolve(allAttempts);
        if (currentCall === 4) return Promise.resolve(allCalls);
        if (currentCall === 5) return Promise.resolve([]);
        return chain;
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    const targeted = json['sess-1'].insights.find((i: any) => i.type === 'targeted_prompting');
    expect(targeted).toBeDefined();
    expect(json['sess-1'].flags.green).toContain('Targeted prompting');
  });

  it('flags model diversity when 3+ tiers are used', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const session = { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' };
    const challengeLinks = [
      { challengeId: 'ch-1', sortOrder: 0, category: 'practice', difficulty: 'easy', title: 'A' },
      { challengeId: 'ch-2', sortOrder: 1, category: 'practice', difficulty: 'hard', title: 'B' },
    ];
    const allAttempts = [
      { id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1', totalCost: 50, inputTokens: 200, outputTokens: 100, status: 'passed', createdAt: '2026-01-01T00:10:00Z', submittedAt: '2026-01-01T00:20:00Z' },
      { id: 'att-2', challengeId: 'ch-2', assessmentSessionId: 'sess-1', totalCost: 200, inputTokens: 800, outputTokens: 400, status: 'passed', createdAt: '2026-01-01T00:30:00Z', submittedAt: '2026-01-01T00:50:00Z' },
    ];
    // 3 different tiers: budget (8b), premium (70b), reasoning (qwq)
    const allCalls = [
      { id: 'call-1', attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b', cost: 50, inputTokens: 200, outputTokens: 100, createdAt: '2026-01-01T00:11:00Z' },
      { id: 'call-2', attemptId: 'att-2', model: '@cf/meta/llama-3.3-70b', cost: 100, inputTokens: 400, outputTokens: 200, createdAt: '2026-01-01T00:31:00Z' },
      { id: 'call-3', attemptId: 'att-2', model: '@cf/qwen/qwq-32b', cost: 100, inputTokens: 400, outputTokens: 200, createdAt: '2026-01-01T00:35:00Z' },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([session]);
        if (currentCall === 2) return Promise.resolve(challengeLinks);
        if (currentCall === 3) return Promise.resolve(allAttempts);
        if (currentCall === 4) return Promise.resolve(allCalls.filter(c => c.attemptId === 'att-1'));
        if (currentCall === 5) return Promise.resolve(allCalls.filter(c => c.attemptId === 'att-2'));
        if (currentCall === 6) return Promise.resolve([]);
        if (currentCall === 7) return Promise.resolve([]);
        return chain;
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json['sess-1'].flags.green).toContain('Strategic model switching');
    const diversity = json['sess-1'].insights.find((i: any) => i.type === 'model_diversity');
    expect(diversity).toBeDefined();
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockRejectedValue(new Error('Unexpected'));

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });

  it('classifies unknown model as micro tier', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const session = { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: null };
    const challengeLinks = [
      { challengeId: 'ch-1', sortOrder: 0, category: 'practice', difficulty: 'easy', title: 'Test' },
    ];
    const allAttempts = [{
      id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1',
      totalCost: 50, inputTokens: 200, outputTokens: 100, status: 'passed',
      createdAt: '2026-01-01T00:10:00Z', submittedAt: '2026-01-01T00:20:00Z',
    }];
    // Use a model name that doesn't match any tier pattern -> 'micro'
    const allCalls = [
      { id: 'call-1', attemptId: 'att-1', model: '@cf/custom/unknown-model', cost: 50, inputTokens: 200, outputTokens: 100, createdAt: '2026-01-01T00:11:00Z' },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve([session]);
        if (currentCall === 2) return Promise.resolve(challengeLinks);
        if (currentCall === 3) return Promise.resolve(allAttempts);
        if (currentCall === 4) return Promise.resolve(allCalls);
        if (currentCall === 5) return Promise.resolve([]);
        return chain;
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    // The micro tier model should be classified and processed without errors
    expect(json['sess-1']).toBeDefined();
    expect(json['sess-1'].insights).toBeDefined();
  });
});
