/**
 * Integration tests for critical API routes.
 * Tests handler functions with real logic, only mocking D1 binding and auth.
 * Validates wiring: auth gating → query logic → response shaping in one flow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared Mocks ──────────────────────────────────────────────────────

const { mockGetUser, mockGetDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../drizzle/schema.d1', () => ({
  challenges: { id: 'id', title: 'title', description: 'description', difficulty: 'difficulty', starterCode: 'starter_code', testCases: 'test_cases', hiddenTestCases: 'hidden_test_cases', execTimeLimit: 'exec_time_limit', execMemoryLimit: 'exec_memory_limit', category: 'category', skillTested: 'skill_tested', language: 'language', creditCost: 'credit_cost', funcName: 'func_name', tags: 'tags', testHarness: 'test_harness', readonlyPrefix: 'readonly_prefix' },
  attempts: { id: 'id', userId: 'user_id', challengeId: 'challenge_id', status: 'status', totalCost: 'total_cost', inputTokens: 'input_tokens', outputTokens: 'output_tokens', passedTests: 'passed_tests', totalTests: 'total_tests', submittedAt: 'submitted_at', createdAt: 'created_at', assessmentSessionId: 'assessment_session_id', replayPublic: 'replay_public' },
  profiles: { id: 'id', name: 'name', email: 'email', avatarUrl: 'avatar_url', displayName: 'display_name', credits: 'credits' },
  assessmentSessions: { id: 'id', assessmentId: 'assessment_id', userId: 'user_id', shareToken: 'share_token', status: 'status', totalCost: 'total_cost', totalTokens: 'total_tokens', startedAt: 'started_at', completedAt: 'completed_at', inviteId: 'invite_id' },
  assessments: { id: 'id', title: 'title', description: 'description', companyName: 'company_name', companyLogoUrl: 'company_logo_url', createdBy: 'created_by' },
  assessmentChallenges: { assessmentId: 'assessment_id', challengeId: 'challenge_id', sortOrder: 'sort_order' },
  aiCalls: { attemptId: 'attempt_id', model: 'model', cost: 'cost', inputTokens: 'input_tokens', outputTokens: 'output_tokens' },
  attemptMessages: { attemptId: 'attempt_id', sequence: 'sequence', role: 'role', content: 'content', model: 'model', inputTokens: 'input_tokens', outputTokens: 'output_tokens', cost: 'cost', createdAt: 'created_at' },
  assessmentInvites: { id: 'id', token: 'token', status: 'status', expiresAt: 'expires_at' },
  emailLogs: { id: 'id', type: 'type', recipientEmail: 'recipient_email', assessmentId: 'assessment_id', subject: 'subject', status: 'status', errorMessage: 'error_message' },
}));

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k', RESEND_API_KEY: 'rk' } as Env;
}

// ── Results Endpoint Integration ──────────────────────────────────────

describe('Integration: GET /api/results/:shareToken', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns complete results with model usage aggregation from a single request', async () => {
    const { onRequestGet } = await import('./results/[shareToken]');

    const session = { id: 's1', assessmentId: 'a1', userId: 'u1', shareToken: 't1', status: 'completed', totalCost: 1000, totalTokens: 500, startedAt: '2026-01-01', completedAt: '2026-01-02' };
    const assessment = { id: 'a1', title: 'Full Stack QA', description: 'Test', companyName: 'Acme', companyLogoUrl: null };
    const candidate = { name: 'Alice', avatarUrl: 'https://img.com/alice.jpg' };
    const challengeList = [
      { sortOrder: 1, challenge: { id: 'ch-1', title: 'FizzBuzz', difficulty: 'easy', category: 'prompt_efficiency', skillTested: 'basic' } },
      { sortOrder: 2, challenge: { id: 'ch-2', title: 'LRU Cache', difficulty: 'hard', category: 'debugging', skillTested: 'data_structures' } },
    ];
    const sessionAttempts = [
      { id: 'att-1', challengeId: 'ch-1', status: 'passed', totalCost: 300, inputTokens: 100, outputTokens: 50, passedTests: 5, totalTests: 5, assessmentSessionId: 's1' },
      { id: 'att-2', challengeId: 'ch-2', status: 'failed', totalCost: 700, inputTokens: 300, outputTokens: 100, passedTests: 2, totalTests: 8, assessmentSessionId: 's1' },
    ];
    const aiCallsCh1 = [
      { model: 'claude-3-haiku', cost: 100, inputTokens: 50, outputTokens: 20 },
      { model: 'claude-3-haiku', cost: 200, inputTokens: 50, outputTokens: 30 },
    ];
    const aiCallsCh2 = [
      { model: 'gpt-4o', cost: 500, inputTokens: 200, outputTokens: 80 },
      { model: 'claude-3-haiku', cost: 200, inputTokens: 100, outputTokens: 20 },
    ];

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        const chain: Record<string, any> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.innerJoin = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockImplementation(() => {
          if (selectCall === 5) return Promise.resolve(sessionAttempts);
          // AI calls for each attempt
          if (selectCall === 6) return Promise.resolve(aiCallsCh1);
          if (selectCall === 7) return Promise.resolve(aiCallsCh2);
          return chain;
        });
        chain.limit = vi.fn().mockImplementation(() => {
          if (selectCall === 1) return Promise.resolve([session]);
          if (selectCall === 2) return Promise.resolve([assessment]);
          if (selectCall === 3) return Promise.resolve([candidate]);
          return Promise.resolve([]);
        });
        chain.orderBy = vi.fn().mockImplementation(() => {
          if (selectCall === 4) return Promise.resolve(challengeList);
          return Promise.resolve([]);
        });
        return chain;
      }),
    };
    mockGetDb.mockReturnValue(db);

    const ctx = {
      request: new Request('https://ruwt.dev/api/results/t1'),
      env: makeEnv(),
      params: { shareToken: 't1' },
    };

    const res = await onRequestGet(ctx);
    const json = await res.json();

    // Verify the entire response structure in one assertion chain
    expect(res.status).toBe(200);

    // Assessment info
    expect(json.assessment.title).toBe('Full Stack QA');
    expect(json.assessment.companyName).toBe('Acme');

    // Candidate
    expect(json.candidate.name).toBe('Alice');

    // Session
    expect(json.session.status).toBe('completed');

    // Summary
    expect(json.summary.challengesPassed).toBe(1);
    expect(json.summary.totalChallenges).toBe(2);

    // Per-challenge results
    expect(json.challengeResults).toHaveLength(2);

    // Challenge 1: passed with haiku usage
    const ch1 = json.challengeResults[0];
    expect(ch1.status).toBe('passed');
    expect(ch1.modelUsage['claude-3-haiku'].calls).toBe(2);
    expect(ch1.modelUsage['claude-3-haiku'].cost).toBe(300);

    // Challenge 2: failed with mixed model usage
    const ch2 = json.challengeResults[1];
    expect(ch2.status).toBe('failed');
    expect(ch2.modelUsage['gpt-4o'].calls).toBe(1);
    expect(ch2.modelUsage['claude-3-haiku'].calls).toBe(1);
  });
});

// ── Featured Replay Integration ───────────────────────────────────────

describe('Integration: GET /api/featured-replay', () => {
  beforeEach(() => vi.resetAllMocks());

  it('finds first available featured challenge with messages and returns full replay', async () => {
    const { onRequestGet } = await import('./featured-replay');

    const attempt = {
      attemptId: 'att-1', userId: 'u1', totalCost: 250,
      inputTokens: 100, outputTokens: 80, submittedAt: '2026-01-15',
      createdAt: '2026-01-15', challengeTitle: 'String Formatter',
      challengeDifficulty: 'easy', challengeCategory: 'prompt_efficiency',
    };
    const solver = { name: 'Bob', email: 'bob@test.com', avatarUrl: null };
    const messages = [
      { role: 'user', content: 'Solve this', model: null, inputTokens: 10, outputTokens: 0, cost: 0, createdAt: '2026-01-15T10:00:00Z', sequence: 1 },
      { role: 'assistant', content: 'Here is the solution...', model: 'claude-3-haiku', inputTokens: 10, outputTokens: 50, cost: 50, createdAt: '2026-01-15T10:00:01Z', sequence: 2 },
      { role: 'user', content: 'Run tests', model: null, inputTokens: 5, outputTokens: 0, cost: 0, createdAt: '2026-01-15T10:00:05Z', sequence: 3 },
      { role: 'assistant', content: 'All tests pass!', model: 'claude-3-haiku', inputTokens: 5, outputTokens: 20, cost: 30, createdAt: '2026-01-15T10:00:06Z', sequence: 4 },
    ];

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        const chain: Record<string, any> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.innerJoin = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.orderBy = vi.fn().mockImplementation(() => {
          if (selectCall === 3) return Promise.resolve(messages);
          return chain;
        });
        chain.limit = vi.fn().mockImplementation(() => {
          if (selectCall === 1) return Promise.resolve([attempt]);
          if (selectCall === 2) return Promise.resolve([solver]);
          return Promise.resolve([]);
        });
        return chain;
      }),
    };
    mockGetDb.mockReturnValue(db);

    const ctx = { request: new Request('https://ruwt.dev/api/featured-replay'), env: makeEnv() };
    const res = await onRequestGet(ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.attempt.id).toBe('att-1');
    expect(json.challenge.title).toBe('String Formatter');
    expect(json.solver.name).toBe('Bob');
    expect(json.messages).toHaveLength(4);
    expect(json.stats.messageCount).toBe(4);
    expect(json.stats.modelsUsed).toEqual(['claude-3-haiku']);
    expect(json.stats.totalCost).toBe(80);
  });
});
