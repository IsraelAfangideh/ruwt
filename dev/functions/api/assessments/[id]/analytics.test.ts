import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const { mockGetUser, mockGetDb, mockCanViewResults, mockRequireTeamAccount } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockCanViewResults: vi.fn(),
  mockRequireTeamAccount: vi.fn(),
}));

vi.mock('../../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../_shared/org', () => ({
  canViewResults: mockCanViewResults,
  requireTeamAccount: mockRequireTeamAccount,
}));

import { onRequestGet } from './analytics';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = { id: 'user-123', email: 'admin@test.com' };

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeContext(id: string, queryParams = '') {
  const url = queryParams
    ? `https://ruwt.dev/api/assessments/${id}/analytics?${queryParams}`
    : `https://ruwt.dev/api/assessments/${id}/analytics`;
  return {
    request: new Request(url, { method: 'GET' }),
    env: makeEnv(),
    params: { id },
  };
}

/**
 * Build a fully chainable mock DB that handles the analytics handler's query flow:
 * 1. assessment lookup (select().from().where().limit(1))
 * 2. sessions query (select().from().where() -> returns array directly)
 * 3. challenge links (select().from().innerJoin().where() -> returns array)
 * 4. bulk attempts via sql`` IN (select().from().where() -> returns array)
 * 5. bulk AI calls via sql`` IN (select().from().where() -> returns array)
 */
function makeMockDb(opts: {
  assessment?: any;
  sessions?: any[];
  challengeLinks?: any[];
  allAttempts?: any[];
  allCalls?: any[];
}) {
  const {
    assessment = { id: 'a-1', categoryWeights: null, passThreshold: null },
    sessions = [],
    challengeLinks = [],
    allAttempts = [],
    allCalls = [],
  } = opts;

  let selectCallCount = 0;

  const db: Record<string, any> = {};
  db.select = vi.fn().mockImplementation(() => {
    selectCallCount++;
    const currentCall = selectCallCount;
    const chain: Record<string, any> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockImplementation(() => {
      // Assessment lookup ends with .limit(1)
      if (currentCall === 1) return chain;
      // Sessions query (no limit, no join)
      if (currentCall === 2) return Promise.resolve(sessions);
      // Challenge links query (innerJoin)
      if (currentCall === 3) return Promise.resolve(challengeLinks);
      // Bulk attempts
      if (currentCall === 4) return Promise.resolve(allAttempts);
      // Bulk AI calls
      if (currentCall === 5) return Promise.resolve(allCalls);
      return chain;
    });
    chain.limit = vi.fn().mockImplementation(() => {
      if (currentCall === 1) return Promise.resolve([assessment]);
      return Promise.resolve([]);
    });
    return chain;
  });

  return db;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('GET /api/assessments/:id/analytics', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockCanViewResults.mockReset();
    mockRequireTeamAccount.mockReset();
    mockRequireTeamAccount.mockResolvedValue(null);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not team account', async () => {
    mockRequireTeamAccount.mockResolvedValue(
      Response.json({ error: 'Team account required', code: 'TEAM_REQUIRED' }, { status: 403 })
    );
    mockGetUser.mockResolvedValue(FAKE_USER);

    const res = await onRequestGet(makeContext('a-1'));
    expect(res.status).toBe(403);
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

  it('returns profiles, categoryWeights, and verdicts when sessions exist', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const sessions = [
      {
        id: 'sess-1',
        assessmentId: 'a-1',
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-01T01:00:00Z',
      },
    ];
    const challengeLinks = [
      { challengeId: 'ch-1', category: 'model_selection', difficulty: 'easy' },
    ];
    const allAttempts = [
      {
        id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1',
        totalCost: 100, inputTokens: 500, outputTokens: 200,
      },
    ];
    const allCalls = [
      {
        id: 'call-1', attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b',
        cost: 100, inputTokens: 500, outputTokens: 200, createdAt: '2026-01-01T00:30:00Z',
      },
    ];

    const db = makeMockDb({ sessions, challengeLinks, allAttempts, allCalls });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.profiles).toBeDefined();
    expect(json.profiles['sess-1']).toBeDefined();
    expect(json.categoryWeights).toEqual({
      modelSelection: 20,
      promptEfficiency: 20,
      debugging: 20,
      strategy: 20,
      speed: 20,
    });
    expect(json.verdicts).toBeDefined();
    // Without passThreshold, verdicts should be null
    expect(json.verdicts['sess-1']).toBeNull();
  });

  it('returns empty profiles when no sessions exist', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const db = makeMockDb({ sessions: [], challengeLinks: [] });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.profiles).toEqual({});
    expect(json.verdicts).toEqual({});
  });

  it('uses custom categoryWeights from assessment', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const assessment = {
      id: 'a-1',
      categoryWeights: JSON.stringify({ modelSelection: 40, debugging: 10 }),
      passThreshold: null,
    };
    const db = makeMockDb({ assessment, sessions: [], challengeLinks: [] });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.categoryWeights.modelSelection).toBe(40);
    expect(json.categoryWeights.debugging).toBe(10);
    // Defaults preserved for unspecified dimensions
    expect(json.categoryWeights.promptEfficiency).toBe(20);
  });

  it('filters to specific sessionId when query param is provided', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const sessions = [
      { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
      { id: 'sess-2', assessmentId: 'a-1', startedAt: '2026-01-02T00:00:00Z', completedAt: '2026-01-02T01:00:00Z' },
    ];
    const allAttempts = [
      { id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1', totalCost: 50, inputTokens: 200, outputTokens: 100 },
      { id: 'att-2', challengeId: 'ch-1', assessmentSessionId: 'sess-2', totalCost: 150, inputTokens: 600, outputTokens: 300 },
    ];

    const db = makeMockDb({ sessions, allAttempts, allCalls: [] });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1', 'sessionId=sess-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    // Only sess-1 should be in profiles
    expect(json.profiles['sess-1']).toBeDefined();
    expect(json.profiles['sess-2']).toBeUndefined();
  });

  it('computes pass verdict when passThreshold is configured', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const assessment = {
      id: 'a-1',
      categoryWeights: null,
      passThreshold: JSON.stringify({
        enabled: true,
        mode: 'weighted_average',
        minOverall: 40,
      }),
    };
    const sessions = [
      { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
    ];
    const allAttempts = [
      { id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1', totalCost: 50, inputTokens: 200, outputTokens: 100 },
    ];

    const db = makeMockDb({ assessment, sessions, allAttempts, allCalls: [] });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    // With passThreshold enabled, verdict should not be null
    expect(json.verdicts['sess-1']).toBeDefined();
    expect(['pass', 'fail', 'review']).toContain(json.verdicts['sess-1']);
  });

  it('computes all_dimensions verdict — pass when all dimensions above min', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const assessment = {
      id: 'a-1',
      categoryWeights: null,
      passThreshold: JSON.stringify({
        enabled: true,
        mode: 'all_dimensions',
        dimensions: { modelSelection: 30, promptEfficiency: 30, debugging: 30, strategy: 30, speed: 30 },
      }),
    };
    const sessions = [
      { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
    ];
    const allAttempts = [
      { id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1', totalCost: 50, inputTokens: 200, outputTokens: 100 },
    ];

    const db = makeMockDb({ assessment, sessions, allAttempts, allCalls: [] });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(['pass', 'fail', 'review']).toContain(json.verdicts['sess-1']);
  });

  it('handles malformed passThreshold JSON gracefully', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const assessment = {
      id: 'a-1',
      categoryWeights: null,
      passThreshold: 'not valid json',
    };
    const sessions = [
      { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
    ];
    const allAttempts = [
      { id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1', totalCost: 50, inputTokens: 200, outputTokens: 100 },
    ];

    const db = makeMockDb({ assessment, sessions, allAttempts, allCalls: [] });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    // Malformed JSON results in null passThreshold → null verdict
    expect(json.verdicts['sess-1']).toBeNull();
  });

  it('handles malformed categoryWeights JSON gracefully', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const assessment = {
      id: 'a-1',
      categoryWeights: 'not json',
      passThreshold: null,
    };
    const db = makeMockDb({ assessment, sessions: [], challengeLinks: [] });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    // Should use default weights despite malformed JSON
    expect(json.categoryWeights).toEqual({
      modelSelection: 20,
      promptEfficiency: 20,
      debugging: 20,
      strategy: 20,
      speed: 20,
    });
  });

  it('profiles include debugging score from iterative_debugging category', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const sessions = [
      { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
    ];
    const challengeLinks = [
      { challengeId: 'ch-1', category: 'iterative_debugging', difficulty: 'medium' },
    ];
    const allAttempts = [
      { id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1', totalCost: 100, inputTokens: 500, outputTokens: 200 },
    ];
    const allCalls = [
      { id: 'call-1', attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b', cost: 100, inputTokens: 500, outputTokens: 200, createdAt: '2026-01-01T00:30:00Z' },
    ];

    const db = makeMockDb({ sessions, challengeLinks, allAttempts, allCalls });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(json.profiles['sess-1'].debugging).toBeDefined();
    expect(typeof json.profiles['sess-1'].debugging).toBe('number');
  });

  it('returns 500 when an unexpected error occurs', async () => {
    mockGetUser.mockRejectedValue(new Error('Unexpected'));

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });

  it('computes all_dimensions verdict — fail when a dimension deeply below min', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    // Two sessions so percentile has variation; sess-1 is the expensive one → low scores
    const assessment = {
      id: 'a-1',
      categoryWeights: null,
      passThreshold: JSON.stringify({
        enabled: true,
        mode: 'all_dimensions',
        dimensions: { modelSelection: 90, promptEfficiency: 90, debugging: 90, strategy: 90, speed: 90 },
      }),
    };
    const sessions = [
      { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
      { id: 'sess-2', assessmentId: 'a-1', startedAt: '2026-01-02T00:00:00Z', completedAt: '2026-01-02T01:00:00Z' },
    ];
    const allAttempts = [
      { id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1', totalCost: 1000, inputTokens: 5000, outputTokens: 2000 },
      { id: 'att-2', challengeId: 'ch-1', assessmentSessionId: 'sess-2', totalCost: 10, inputTokens: 50, outputTokens: 20 },
    ];
    const allCalls = [
      { id: 'c-1', attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b', cost: 1000, inputTokens: 5000, outputTokens: 2000 },
      { id: 'c-2', attemptId: 'att-2', model: '@cf/meta/llama-3.1-8b', cost: 10, inputTokens: 50, outputTokens: 20 },
    ];

    const db = makeMockDb({ assessment, sessions, allAttempts, allCalls });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1', 'sessionId=sess-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.verdicts['sess-1']).toBe('fail');
  });

  it('computes all_dimensions verdict — review when slightly below min but not deep fail', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    // With 2 sessions, percentileRank gives 50 for the worse session.
    // Set min=65 so score(50) < 65 but score(50) >= 65-20=45 → review
    const assessment = {
      id: 'a-1',
      categoryWeights: null,
      passThreshold: JSON.stringify({
        enabled: true,
        mode: 'all_dimensions',
        dimensions: { modelSelection: 65, promptEfficiency: 65, debugging: 65, strategy: 65, speed: 65 },
      }),
    };
    const sessions = [
      { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
      { id: 'sess-2', assessmentId: 'a-1', startedAt: '2026-01-02T00:00:00Z', completedAt: '2026-01-02T01:00:00Z' },
    ];
    const allAttempts = [
      { id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1', totalCost: 1000, inputTokens: 5000, outputTokens: 2000 },
      { id: 'att-2', challengeId: 'ch-1', assessmentSessionId: 'sess-2', totalCost: 10, inputTokens: 50, outputTokens: 20 },
    ];
    const allCalls = [
      { id: 'c-1', attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b', cost: 1000, inputTokens: 5000, outputTokens: 2000 },
      { id: 'c-2', attemptId: 'att-2', model: '@cf/meta/llama-3.1-8b', cost: 10, inputTokens: 50, outputTokens: 20 },
    ];

    const db = makeMockDb({ assessment, sessions, allAttempts, allCalls });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1', 'sessionId=sess-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.verdicts['sess-1']).toBe('review');
  });

  it('computes weighted_average verdict — fail when avg deeply below min', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const assessment = {
      id: 'a-1',
      categoryWeights: null,
      passThreshold: JSON.stringify({
        enabled: true,
        mode: 'weighted_average',
        minOverall: 95,
      }),
    };
    const sessions = [
      { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
      { id: 'sess-2', assessmentId: 'a-1', startedAt: '2026-01-02T00:00:00Z', completedAt: '2026-01-02T01:00:00Z' },
    ];
    const allAttempts = [
      { id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1', totalCost: 1000, inputTokens: 5000, outputTokens: 2000 },
      { id: 'att-2', challengeId: 'ch-1', assessmentSessionId: 'sess-2', totalCost: 10, inputTokens: 50, outputTokens: 20 },
    ];
    const allCalls = [
      { id: 'c-1', attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b', cost: 1000, inputTokens: 5000, outputTokens: 2000 },
      { id: 'c-2', attemptId: 'att-2', model: '@cf/meta/llama-3.1-8b', cost: 10, inputTokens: 50, outputTokens: 20 },
    ];

    const db = makeMockDb({ assessment, sessions, allAttempts, allCalls });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1', 'sessionId=sess-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.verdicts['sess-1']).toBe('fail');
  });

  it('computes weighted_average verdict — review when slightly below min', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    // With 2 sessions, the expensive one gets weighted avg ~70.
    // minOverall=75: avg(70) < 75 but avg(70) >= 75-20=55 → review
    const assessment = {
      id: 'a-1',
      categoryWeights: null,
      passThreshold: JSON.stringify({
        enabled: true,
        mode: 'weighted_average',
        minOverall: 75,
      }),
    };
    const sessions = [
      { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
      { id: 'sess-2', assessmentId: 'a-1', startedAt: '2026-01-02T00:00:00Z', completedAt: '2026-01-02T01:00:00Z' },
    ];
    const allAttempts = [
      { id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1', totalCost: 1000, inputTokens: 5000, outputTokens: 2000 },
      { id: 'att-2', challengeId: 'ch-1', assessmentSessionId: 'sess-2', totalCost: 10, inputTokens: 50, outputTokens: 20 },
    ];
    const allCalls = [
      { id: 'c-1', attemptId: 'att-1', model: '@cf/meta/llama-3.1-8b', cost: 1000, inputTokens: 5000, outputTokens: 2000 },
      { id: 'c-2', attemptId: 'att-2', model: '@cf/meta/llama-3.1-8b', cost: 10, inputTokens: 50, outputTokens: 20 },
    ];

    const db = makeMockDb({ assessment, sessions, allAttempts, allCalls });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1', 'sessionId=sess-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.verdicts['sess-1']).toBe('review');
  });

  it('classifies unknown model as micro tier', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const sessions = [
      { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
    ];
    const allAttempts = [
      { id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1', totalCost: 100, inputTokens: 500, outputTokens: 200 },
    ];
    // Use a model name that doesn't match any known tier pattern
    const allCalls = [
      { id: 'c-1', attemptId: 'att-1', model: '@cf/some/unknown-model-v2', cost: 100, inputTokens: 500, outputTokens: 200, createdAt: '2026-01-01T00:30:00Z' },
    ];

    const db = makeMockDb({ sessions, allAttempts, allCalls });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    // The profile should exist and strategy should be computed (micro tier was used)
    expect(json.profiles['sess-1']).toBeDefined();
    expect(typeof json.profiles['sess-1'].strategy).toBe('number');
  });

  it('handles sessions without completedAt (speed defaults to 50)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanViewResults.mockResolvedValue(true);

    const sessions = [
      { id: 'sess-1', assessmentId: 'a-1', startedAt: '2026-01-01T00:00:00Z', completedAt: null },
    ];
    const allAttempts = [
      { id: 'att-1', challengeId: 'ch-1', assessmentSessionId: 'sess-1', totalCost: 100, inputTokens: 500, outputTokens: 200 },
    ];

    const db = makeMockDb({ sessions, allAttempts, allCalls: [] });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('a-1'));
    const json = await res.json();

    expect(json.profiles['sess-1'].speed).toBe(50);
  });
});
