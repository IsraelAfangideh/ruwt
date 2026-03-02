/**
 * Tests for POST /api/ai/assessment-agent — AI assessment builder agent.
 *
 * Verifies auth gating, request validation, SSE streaming structure,
 * tool call execution loop, conversation persistence, and error handling.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { onRequestPost } from './assessment-agent';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../_shared/auth', () => ({
  getUser: vi.fn(),
}));

vi.mock('../../_shared/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('../../_shared/org', () => ({
  getUserOrg: vi.fn(),
}));

vi.mock('../../_shared/ai-pricing', () => ({
  getToolCapableFallbackChain: vi.fn().mockReturnValue([
    '@cf/meta/llama-3.1-8b-instruct',
  ]),
}));

vi.mock('../../_shared/assessment-agent/system-prompt', () => ({
  buildAssessmentAgentPrompt: vi.fn().mockReturnValue('You are the assessment builder.'),
  getAssessmentAgentTools: vi.fn().mockReturnValue([
    { name: 'search_challenges', description: 'Search', parameters: { type: 'object', properties: {}, required: [] } },
  ]),
}));

vi.mock('../../_shared/assessment-agent/tool-executor', () => ({
  executeToolCall: vi.fn(),
}));

vi.mock('../../../drizzle/schema.d1', () => ({
  challenges: { id: 'id', title: 'title', difficulty: 'difficulty', category: 'category', skillTested: 'skill_tested', language: 'language', tags: 'tags' },
  assessments: { id: 'id', title: 'title', description: 'description', timeLimit: 'time_limit', categoryWeights: 'category_weights', companyName: 'company_name', welcomeMessage: 'welcome_message' },
  assessmentChallenges: { assessmentId: 'assessment_id', challengeId: 'challenge_id' },
  customChallenges: { id: 'id', orgId: 'org_id', title: 'title', difficulty: 'difficulty', category: 'category', status: 'status' },
  agentConversations: { id: 'id', assessmentId: 'assessment_id', orgId: 'org_id', userId: 'user_id', messages: 'messages', updatedAt: 'updated_at' },
}));

import { getUser } from '../../_shared/auth';
import { getDb } from '../../_shared/db';
import { getUserOrg } from '../../_shared/org';
import { executeToolCall } from '../../_shared/assessment-agent/tool-executor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER = { id: 'user-1', email: 'test@ruwt.dev' };

function makeRequest(body: unknown): Request {
  return new Request('https://ruwt.dev/api/ai/assessment-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeEnv(): Record<string, unknown> {
  return {
    DB: {},
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-key',
    CLOUDFLARE_ACCOUNT_ID: 'acct-123',
    CLOUDFLARE_API_TOKEN: 'token-456',
  };
}

function makeContext(body: unknown) {
  return { request: makeRequest(body), env: makeEnv() as any };
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    messages: [{ role: 'user', content: 'Help me build an assessment' }],
    ...overrides,
  };
}

async function readSSEEvents(response: Response): Promise<unknown[]> {
  const text = await response.text();
  const events: unknown[] = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        events.push(JSON.parse(line.slice(6)));
      } catch {
        // skip
      }
    }
  }
  return events;
}

/**
 * Build a mock db that tracks operations. Uses the same FIFO pattern as chat tests.
 */
function createMockDb() {
  const selectResults: unknown[][] = [];
  const insertedValues: unknown[] = [];
  const updateCalls: unknown[] = [];

  function mockWhereResult(rows: unknown[]) {
    return {
      limit: vi.fn().mockResolvedValue(rows),
      then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
        Promise.resolve(rows).then(resolve, reject),
    };
  }

  const db = {
    selectResults,
    insertedValues,
    updateCalls,
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          const rows = selectResults.shift() || [];
          return mockWhereResult(rows);
        }),
        // For selects without .where() (e.g., catalog fetch)
        then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) => {
          const rows = selectResults.shift() || [];
          return Promise.resolve(rows).then(resolve, reject);
        },
      }),
    })),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((val: unknown) => {
        insertedValues.push(val);
        return Promise.resolve(undefined);
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((val: unknown) => {
        updateCalls.push(val);
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      }),
    }),
  };

  return db;
}

/**
 * Mock the global fetch used by callWithTools to simulate the Cloudflare AI API.
 */
function mockCFAI(responses: Array<{ ok: boolean; body?: unknown; status?: number; text?: string }>) {
  let callIdx = 0;
  vi.stubGlobal('fetch', vi.fn(async () => {
    const resp = responses[callIdx] || responses[responses.length - 1];
    callIdx++;
    if (!resp.ok) {
      return {
        ok: false,
        status: resp.status || 500,
        text: async () => resp.text || 'error',
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => resp.body,
    };
  }));
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockDb: ReturnType<typeof createMockDb>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mockDb = createMockDb();
  (getDb as Mock).mockReturnValue(mockDb);
  (getUserOrg as Mock).mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// Tests: Auth gating
// ---------------------------------------------------------------------------

describe('POST /api/ai/assessment-agent', () => {
  it('returns 401 when user is not authenticated', async () => {
    (getUser as Mock).mockResolvedValue(null);

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(401);
    const json = await res.json() as any;
    expect(json.error).toBe('Unauthorized');
  });

  // ------------------------------------------------------------------
  // Request validation
  // ------------------------------------------------------------------

  it('returns 400 for invalid request body (missing messages)', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const res = await onRequestPost(makeContext({ foo: 'bar' }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Invalid request');
    expect(json.details).toBeDefined();
  });

  it('returns 400 for unparseable JSON body', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    // Push empty results for catalog, assessment, org lookups
    mockDb.selectResults.push([]); // catalog

    const req = new Request('https://ruwt.dev/api/ai/assessment-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{invalid',
    });

    const res = await onRequestPost({ request: req, env: makeEnv() as any });

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 for messages with invalid role', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const res = await onRequestPost(
      makeContext({ messages: [{ role: 'system', content: 'hack' }] })
    );

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Invalid request');
  });

  // ------------------------------------------------------------------
  // SSE stream: basic no-tool response
  // ------------------------------------------------------------------

  it('streams response with thinking, chunks, and done events', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    // catalog (no where), assessmentChallenges N/A, custom challenges N/A
    mockDb.selectResults.push([]); // challenge catalog

    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            response: 'Here is my recommendation for your assessment.',
          },
        },
      },
    ]);

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');

    const events = await readSSEEvents(res);
    const types = events.map((e: any) => e.type);

    expect(types).toContain('thinking');
    expect(types).toContain('chunk');
    expect(types).toContain('done');

    const doneEvent = events.find((e: any) => e.type === 'done') as any;
    expect(doneEvent.conversationId).toBeDefined();
    expect(doneEvent.toolCallCount).toBe(0);
  });

  // ------------------------------------------------------------------
  // SSE stream: with tool calls
  // ------------------------------------------------------------------

  it('executes tool calls and emits tool_call and tool_result events', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    (executeToolCall as Mock).mockResolvedValue({
      tool: 'search_challenges',
      success: true,
      result: { count: 3, challenges: [] },
    });

    // First call returns tool_calls, second call returns final response
    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            response: 'Let me search for challenges.',
            tool_calls: [
              { name: 'search_challenges', arguments: { category: 'debugging' } },
            ],
          },
        },
      },
      {
        ok: true,
        body: {
          result: {
            response: 'I found 3 challenges for you.',
          },
        },
      },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);
    const types = events.map((e: any) => e.type);

    expect(types).toContain('tool_call');
    expect(types).toContain('tool_result');
    expect(types).toContain('done');

    const toolCallEvent = events.find((e: any) => e.type === 'tool_call') as any;
    expect(toolCallEvent.tool).toBe('search_challenges');
    expect(toolCallEvent.params).toEqual({ category: 'debugging' });

    const toolResultEvent = events.find((e: any) => e.type === 'tool_result') as any;
    expect(toolResultEvent.success).toBe(true);

    const doneEvent = events.find((e: any) => e.type === 'done') as any;
    expect(doneEvent.toolCallCount).toBe(1);
  });

  // ------------------------------------------------------------------
  // Conversation persistence: new conversation
  // ------------------------------------------------------------------

  it('creates new conversation when conversationId is not provided', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    mockCFAI([
      { ok: true, body: { result: { response: 'Hello.' } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    await res.text(); // consume stream

    // Should insert a new conversation
    expect(mockDb.insertedValues.length).toBeGreaterThanOrEqual(1);
    const convInsert = mockDb.insertedValues.find(
      (v: any) => v.userId === TEST_USER.id && v.messages
    );
    expect(convInsert).toBeDefined();
  });

  // ------------------------------------------------------------------
  // Conversation persistence: update existing conversation
  // ------------------------------------------------------------------

  it('updates existing conversation when conversationId is provided', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    mockCFAI([
      { ok: true, body: { result: { response: 'Updated.' } } },
    ]);

    const res = await onRequestPost(
      makeContext(validBody({ conversationId: 'conv-123' }))
    );
    await res.text();

    // Should update, not insert
    expect(mockDb.updateCalls.length).toBeGreaterThanOrEqual(1);
    const msgUpdate = mockDb.updateCalls.find((v: any) => v.messages);
    expect(msgUpdate).toBeDefined();
  });

  // ------------------------------------------------------------------
  // Assessment state loading
  // ------------------------------------------------------------------

  it('loads assessment state when assessmentId is provided', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog
    // Assessment lookup
    mockDb.selectResults.push([{
      id: 'asmt-1',
      title: 'Test Assessment',
      description: 'A test',
      timeLimit: 3600,
      categoryWeights: JSON.stringify({ modelSelection: 30, promptEfficiency: 20, debugging: 20, strategy: 15, speed: 15 }),
      companyName: 'Ruwt',
      welcomeMessage: 'Welcome!',
      createdBy: 'user-1',
    }]);
    // Assessment challenges
    mockDb.selectResults.push([
      { challengeId: 'ch-1' },
      { challengeId: 'ch-2' },
    ]);

    mockCFAI([
      { ok: true, body: { result: { response: 'Assessment loaded.' } } },
    ]);

    const res = await onRequestPost(
      makeContext(validBody({ assessmentId: 'asmt-1' }))
    );
    const events = await readSSEEvents(res);

    const doneEvent = events.find((e: any) => e.type === 'done');
    expect(doneEvent).toBeDefined();
  });

  it('handles assessment with invalid categoryWeights JSON gracefully', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog
    // Assessment with broken JSON weights
    mockDb.selectResults.push([{
      id: 'asmt-1',
      title: 'Broken Weights',
      description: null,
      timeLimit: 1800,
      categoryWeights: '{invalid json}',
      companyName: null,
      welcomeMessage: null,
      createdBy: 'user-1',
    }]);
    mockDb.selectResults.push([]); // assessment challenges

    mockCFAI([
      { ok: true, body: { result: { response: 'OK' } } },
    ]);

    const res = await onRequestPost(
      makeContext(validBody({ assessmentId: 'asmt-1' }))
    );
    const events = await readSSEEvents(res);

    // Should still succeed using default weights
    const doneEvent = events.find((e: any) => e.type === 'done');
    expect(doneEvent).toBeDefined();
  });

  it('handles no assessment found for assessmentId', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog
    // Assessment lookup returns empty
    mockDb.selectResults.push([]);

    mockCFAI([
      { ok: true, body: { result: { response: 'No assessment yet.' } } },
    ]);

    const res = await onRequestPost(
      makeContext(validBody({ assessmentId: 'nonexistent' }))
    );
    const events = await readSSEEvents(res);

    // Should still work, just no assessment state loaded
    const doneEvent = events.find((e: any) => e.type === 'done');
    expect(doneEvent).toBeDefined();
  });

  // ------------------------------------------------------------------
  // Org custom challenges loading
  // ------------------------------------------------------------------

  it('loads org custom challenges when user belongs to an org', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    (getUserOrg as Mock).mockResolvedValue({
      org: { id: 'org-1', name: 'Test Org' },
      role: 'admin',
    });

    mockDb.selectResults.push([]); // catalog
    // Custom challenges for org
    mockDb.selectResults.push([
      { id: 'custom-1', title: 'Custom Bug', difficulty: 'hard', category: 'debugging', status: 'active' },
    ]);

    mockCFAI([
      { ok: true, body: { result: { response: 'Found custom challenges.' } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const doneEvent = events.find((e: any) => e.type === 'done');
    expect(doneEvent).toBeDefined();
  });

  // ------------------------------------------------------------------
  // Cloudflare AI: response format variations
  // ------------------------------------------------------------------

  it('handles response as number type from Cloudflare AI', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    mockCFAI([
      { ok: true, body: { result: { response: 42 } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const chunks = events.filter((e: any) => e.type === 'chunk');
    expect(chunks.length).toBeGreaterThan(0);
    expect((chunks[0] as any).content).toContain('42');
  });

  it('handles response as boolean type from Cloudflare AI', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    mockCFAI([
      { ok: true, body: { result: { response: true } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const chunks = events.filter((e: any) => e.type === 'chunk');
    expect(chunks.length).toBeGreaterThan(0);
    expect((chunks[0] as any).content).toContain('true');
  });

  it('handles choices format from Cloudflare AI', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            choices: [{ message: { content: 'Choices format response.' } }],
          },
        },
      },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const chunks = events.filter((e: any) => e.type === 'chunk');
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('handles choices format with numeric content', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            choices: [{ message: { content: 99 } }],
          },
        },
      },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const chunks = events.filter((e: any) => e.type === 'chunk');
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('handles tool_calls with arguments as string (JSON)', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    (executeToolCall as Mock).mockResolvedValue({
      tool: 'search_challenges',
      success: true,
      result: { count: 0, challenges: [] },
    });

    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            response: '',
            tool_calls: [
              { name: 'search_challenges', arguments: '{"category":"backend_api"}' },
            ],
          },
        },
      },
      { ok: true, body: { result: { response: 'Done.' } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const toolCalls = events.filter((e: any) => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    expect((toolCalls[0] as any).params).toEqual({ category: 'backend_api' });
  });

  it('handles tool_calls with unparseable string arguments', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    (executeToolCall as Mock).mockResolvedValue({
      tool: 'search_challenges',
      success: true,
      result: {},
    });

    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            response: '',
            tool_calls: [
              { name: 'search_challenges', arguments: '{broken json' },
            ],
          },
        },
      },
      { ok: true, body: { result: { response: 'Recovered.' } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    // Should still work, passing empty args
    const toolCalls = events.filter((e: any) => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    expect((toolCalls[0] as any).params).toEqual({});
  });

  it('skips tool_calls entries with empty name', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            response: 'No valid tools.',
            tool_calls: [
              { name: '', arguments: {} },
            ],
          },
        },
      },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    // No tool_call events since name was empty
    const toolCalls = events.filter((e: any) => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(0);
  });

  // ------------------------------------------------------------------
  // Cloudflare AI: error and fallback handling
  // ------------------------------------------------------------------

  it('emits error event when all AI models fail', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    // All models return 404 or similar
    mockCFAI([
      { ok: false, status: 404, text: 'Model not found' },
      { ok: false, status: 404, text: 'Model not found' },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const errorEvents = events.filter((e: any) => e.type === 'error');
    expect(errorEvents.length).toBeGreaterThan(0);
  });

  it('falls back to next model on 400 error', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    mockCFAI([
      { ok: false, status: 400, text: 'Bad request' },
      { ok: true, body: { result: { response: 'Fallback worked.' } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const doneEvent = events.find((e: any) => e.type === 'done');
    expect(doneEvent).toBeDefined();
  });

  it('falls back when result is empty from first model', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    mockCFAI([
      { ok: true, body: {} }, // no result field
      { ok: true, body: { result: { response: 'Got it.' } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const doneEvent = events.find((e: any) => e.type === 'done');
    expect(doneEvent).toBeDefined();
  });

  it('throws when last model returns empty result', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    // Only one model in chain (the primary), and it returns empty
    // We need both the primary and fallback to fail
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}), // no result
    })));

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const errorEvents = events.filter((e: any) => e.type === 'error');
    expect(errorEvents.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------
  // Cloudflare AI: missing credentials
  // ------------------------------------------------------------------

  it('emits error when Cloudflare AI credentials are missing', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    const env = makeEnv();
    delete env.CLOUDFLARE_ACCOUNT_ID;
    delete env.CLOUDFLARE_API_TOKEN;

    const res = await onRequestPost({
      request: makeRequest(validBody()),
      env: env as any,
    });
    const events = await readSSEEvents(res);

    const errorEvents = events.filter((e: any) => e.type === 'error');
    expect(errorEvents.length).toBeGreaterThan(0);
    expect((errorEvents[0] as any).message).toContain('credentials');
  });

  // ------------------------------------------------------------------
  // Top-level error handling (500)
  // ------------------------------------------------------------------

  it('returns 500 when an unexpected error occurs before streaming starts', async () => {
    (getUser as Mock).mockRejectedValue(new Error('Auth service crashed'));

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.error).toBe('Internal server error');
    expect(json.details).toBe('Auth service crashed');
  });

  it('returns 500 for non-Error thrown values', async () => {
    (getUser as Mock).mockRejectedValue('string-error');

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.details).toBe('string-error');
  });

  // ------------------------------------------------------------------
  // emitChunked: text is emitted in chunks of 20 chars
  // ------------------------------------------------------------------

  it('emits long text in chunks of ~20 characters', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    const longText = 'A'.repeat(50); // 50 chars = 3 chunks (20+20+10)
    mockCFAI([
      { ok: true, body: { result: { response: longText } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const chunks = events.filter((e: any) => e.type === 'chunk');
    expect(chunks).toHaveLength(3);
    expect((chunks[0] as any).content).toHaveLength(20);
    expect((chunks[1] as any).content).toHaveLength(20);
    expect((chunks[2] as any).content).toHaveLength(10);
  });

  // ------------------------------------------------------------------
  // Stream error handling: non-Error thrown in stream
  // ------------------------------------------------------------------

  it('handles non-Error thrown in stream gracefully', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    // Make getDb throw a non-Error after auth passes
    (getDb as Mock).mockImplementation(() => {
      throw 'db-string-error';
    });

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.details).toBe('db-string-error');

    // Restore
    (getDb as Mock).mockReturnValue(mockDb);
  });

  // ------------------------------------------------------------------
  // Multiple tool calls in a single response
  // ------------------------------------------------------------------

  it('handles multiple tool calls in a single AI response', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    (executeToolCall as Mock)
      .mockResolvedValueOnce({ tool: 'search_challenges', success: true, result: { count: 5 } })
      .mockResolvedValueOnce({ tool: 'set_weights', success: true, result: { modelSelection: 30 } });

    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            response: 'Setting up...',
            tool_calls: [
              { name: 'search_challenges', arguments: { category: 'debugging' } },
              { name: 'set_weights', arguments: { modelSelection: 30 } },
            ],
          },
        },
      },
      { ok: true, body: { result: { response: 'All done!' } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const toolCalls = events.filter((e: any) => e.type === 'tool_call');
    const toolResults = events.filter((e: any) => e.type === 'tool_result');
    expect(toolCalls).toHaveLength(2);
    expect(toolResults).toHaveLength(2);

    const doneEvent = events.find((e: any) => e.type === 'done') as any;
    expect(doneEvent.toolCallCount).toBe(2);
  });

  // ------------------------------------------------------------------
  // Tool call with text response before tools
  // ------------------------------------------------------------------

  it('emits text chunks before tool calls when model provides both', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    (executeToolCall as Mock).mockResolvedValue({
      tool: 'search_challenges',
      success: true,
      result: { count: 0 },
    });

    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            response: 'Searching now...',
            tool_calls: [
              { name: 'search_challenges', arguments: {} },
            ],
          },
        },
      },
      { ok: true, body: { result: { response: 'Found nothing.' } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const chunks = events.filter((e: any) => e.type === 'chunk');
    // Should have chunks from "Searching now..." AND "Found nothing."
    expect(chunks.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------
  // Non-streaming error when Cloudflare AI returns a non-404 error on last model
  // ------------------------------------------------------------------

  it('throws with status details when last model returns a non-recoverable error', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    // Primary fails with 500, fallback also fails with 500
    mockCFAI([
      { ok: false, status: 500, text: 'Internal server error from CF' },
      { ok: false, status: 500, text: 'Internal server error from CF' },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const errorEvents = events.filter((e: any) => e.type === 'error');
    expect(errorEvents.length).toBeGreaterThan(0);
    expect((errorEvents[0] as any).message).toContain('Cloudflare AI error');
  });
});
