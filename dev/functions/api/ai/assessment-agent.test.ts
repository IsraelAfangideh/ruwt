/**
 * Tests for POST /api/ai/assessment-agent — AI assessment builder agent.
 *
 * Verifies auth gating, request validation, SSE streaming structure,
 * tool call execution loop, conversation persistence, and error handling.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { onRequestPost, onRequestDelete } from './assessment-agent';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../_shared/infra/auth', () => ({
  getUser: vi.fn(),
}));

vi.mock('../../_shared/infra/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('../../_shared/org', () => ({
  getUserOrg: vi.fn(),
}));

vi.mock('../../_shared/ai/ai-pricing', () => ({
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

import { getUser } from '../../_shared/infra/auth';
import { getDb } from '../../_shared/infra/db';
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

  it('accepts null conversationId and assessmentId (initial message from client)', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    mockCFAI([
      { ok: true, body: { result: { response: 'Hello!' } } },
    ]);

    // Client sends null (not undefined) for these fields on first message
    const res = await onRequestPost(
      makeContext(validBody({ conversationId: null, assessmentId: null }))
    );

    expect(res.status).toBe(200);
    const events = await readSSEEvents(res);
    const doneEvent = events.find((e: any) => e.type === 'done');
    expect(doneEvent).toBeDefined();
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

  it('wraps tools in OpenAI-compatible format for Cloudflare AI', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    mockCFAI([{ ok: true, body: { result: { response: 'OK' } } }]);

    await onRequestPost(makeContext(validBody()));

    const fetchMock = globalThis.fetch as Mock;
    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools[0]).toEqual({
      type: 'function',
      function: {
        name: 'search_challenges',
        description: 'Search',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });
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

  it('extracts tool_calls from OpenAI choices[0].message.tool_calls format', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    (executeToolCall as Mock).mockResolvedValue({
      tool: 'search_challenges',
      success: true,
      result: { count: 2, challenges: [] },
    });

    // GPT-OSS 120B returns tool_calls nested under choices[0].message
    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            choices: [{
              message: {
                content: null,
                tool_calls: [
                  { function: { name: 'search_challenges', arguments: '{"category":"debugging"}' } },
                ],
              },
            }],
          },
        },
      },
      { ok: true, body: { result: { response: 'Found 2 debugging challenges.' } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const toolCalls = events.filter((e: any) => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    expect((toolCalls[0] as any).tool).toBe('search_challenges');
    expect((toolCalls[0] as any).params).toEqual({ category: 'debugging' });
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

  // ------------------------------------------------------------------
  // Fallback: extract tool calls from text when native format fails
  // ------------------------------------------------------------------

  it('extracts tool calls from text when model outputs JSON instead of native tool_calls', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    (executeToolCall as Mock).mockResolvedValue({
      tool: 'set_weights',
      success: true,
      result: { modelSelection: 20, promptEfficiency: 20, debugging: 20, strategy: 20, speed: 20 },
    });

    // Model outputs text with JSON tool calls instead of native format
    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            response: 'Here is the correctly formatted function call: {"name": "setweights", "parameters": {"modelSelection": "20", "promptEfficiency": "20", "debugging": "20", "strategy": "20", "speed": "20"}}',
          },
        },
      },
      { ok: true, body: { result: { response: 'Weights configured.' } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const toolCalls = events.filter((e: any) => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    // Tool name should be normalized from "setweights" to "set_weights"
    expect((toolCalls[0] as any).tool).toBe('set_weights');
  });

  it('normalizes tool names from text fallback (selectchallenges → select_challenges)', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    (executeToolCall as Mock).mockResolvedValue({
      tool: 'select_challenges',
      success: true,
      result: { added: 2 },
    });

    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            response: '{"name": "selectchallenges", "parameters": {"challengeIds": ["ch-1", "ch-2"]}}',
          },
        },
      },
      { ok: true, body: { result: { response: 'Challenges added.' } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const toolCalls = events.filter((e: any) => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    expect((toolCalls[0] as any).tool).toBe('select_challenges');
    expect((toolCalls[0] as any).params).toEqual({ challengeIds: ['ch-1', 'ch-2'] });
  });

  it('does not extract from text when native tool_calls are present', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    (executeToolCall as Mock).mockResolvedValue({
      tool: 'search_challenges',
      success: true,
      result: { count: 0 },
    });

    // Model provides BOTH native tool_calls AND text with JSON
    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            response: '{"name": "setweights", "parameters": {"modelSelection": "50"}}',
            tool_calls: [
              { name: 'search_challenges', arguments: { category: 'frontend' } },
            ],
          },
        },
      },
      { ok: true, body: { result: { response: 'Done.' } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    // Only the native tool_call should be executed, not the text one
    const toolCalls = events.filter((e: any) => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    expect((toolCalls[0] as any).tool).toBe('search_challenges');
  });

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

  // ------------------------------------------------------------------
  // Forbidden assessment (ownership check)
  // ------------------------------------------------------------------

  it('returns 403 when assessment belongs to different user', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog
    // Assessment owned by a different user
    mockDb.selectResults.push([{
      id: 'asmt-1',
      title: 'Other User Assessment',
      description: null,
      timeLimit: 3600,
      categoryWeights: null,
      companyName: null,
      welcomeMessage: null,
      createdBy: 'other-user-id',
    }]);

    const res = await onRequestPost(
      makeContext(validBody({ assessmentId: 'asmt-1' }))
    );

    expect(res.status).toBe(403);
    const json = await res.json() as any;
    expect(json.error).toBe('Forbidden');
  });

  // ------------------------------------------------------------------
  // Message truncation
  // ------------------------------------------------------------------

  it('truncates messages when exceeding MAX_CONVERSATION_MESSAGES', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    // Create 25 messages (over the 20 limit)
    const manyMessages = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }));

    mockCFAI([
      { ok: true, body: { result: { response: 'Handled truncated messages.' } } },
    ]);

    const res = await onRequestPost(makeContext({ messages: manyMessages }));
    expect(res.status).toBe(200);
    const events = await readSSEEvents(res);
    const doneEvent = events.find((e: any) => e.type === 'done');
    expect(doneEvent).toBeDefined();

    // Verify that the fetch was called with truncated messages
    const fetchMock = globalThis.fetch as Mock;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // messages should be system + last 20 user/assistant messages = 21 total
    expect(body.messages.length).toBe(21);
  });

  // ------------------------------------------------------------------
  // Auto-create assessment
  // ------------------------------------------------------------------

  it('auto-creates draft assessment when tool needs one and assessmentId is null', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    (executeToolCall as Mock).mockResolvedValue({
      tool: 'select_challenges',
      success: true,
      result: { added: 2 },
    });

    // Tool call that requires assessment
    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            response: '',
            tool_calls: [
              { name: 'select_challenges', arguments: { challengeIds: ['ch-1'] } },
            ],
          },
        },
      },
      { ok: true, body: { result: { response: 'Assessment created and challenges added.' } } },
    ]);

    const res = await onRequestPost(makeContext(validBody({ assessmentId: null })));
    const events = await readSSEEvents(res);

    const createdEvent = events.find((e: any) => e.type === 'assessment_created');
    expect(createdEvent).toBeDefined();
    expect((createdEvent as any).assessmentId).toBeDefined();

    // Verify assessment was inserted
    expect(mockDb.insertedValues.length).toBeGreaterThanOrEqual(1);
    const assessmentInsert = mockDb.insertedValues.find((v: any) => v.title);
    expect(assessmentInsert).toBeDefined();
    expect(assessmentInsert.status).toBe('draft');
  });

  // ------------------------------------------------------------------
  // Tool call with arguments as object (not string)
  // ------------------------------------------------------------------

  it('handles tool_calls with arguments as object (not string)', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    (executeToolCall as Mock).mockResolvedValue({
      tool: 'search_challenges',
      success: true,
      result: { count: 1 },
    });

    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            response: '',
            tool_calls: [
              { name: 'search_challenges', arguments: { category: 'debugging' } },
            ],
          },
        },
      },
      { ok: true, body: { result: { response: 'Found it.' } } },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const toolCalls = events.filter((e: any) => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    expect((toolCalls[0] as any).params).toEqual({ category: 'debugging' });
  });

  // ------------------------------------------------------------------
  // Choices format with boolean content
  // ------------------------------------------------------------------

  it('handles choices format with boolean content', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            choices: [{ message: { content: true } }],
          },
        },
      },
    ]);

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const chunks = events.filter((e: any) => e.type === 'chunk');
    expect(chunks.length).toBeGreaterThan(0);
    expect((chunks[0] as any).content).toContain('true');
  });

  // ------------------------------------------------------------------
  // normalizeToolName identity (name not in map)
  // ------------------------------------------------------------------

  it('passes through tool names not in normalization map', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.selectResults.push([]); // catalog

    (executeToolCall as Mock).mockResolvedValue({
      tool: 'search_challenges',
      success: true,
      result: {},
    });

    // Model uses the correct tool name — no normalization needed
    mockCFAI([
      {
        ok: true,
        body: {
          result: {
            response: '',
            tool_calls: [
              { name: 'search_challenges', arguments: {} },
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
    expect((toolCalls[0] as any).tool).toBe('search_challenges');
  });
});

// ---------------------------------------------------------------------------
// Tests: DELETE /api/ai/assessment-agent
// ---------------------------------------------------------------------------

describe('DELETE /api/ai/assessment-agent', () => {
  function makeDeleteCtx(params = '') {
    return {
      request: new Request(`https://ruwt.dev/api/ai/assessment-agent${params}`, { method: 'DELETE' }),
      env: makeEnv() as any,
    };
  }

  it('returns 401 when not authenticated', async () => {
    (getUser as Mock).mockResolvedValue(null);
    const res = await onRequestDelete(makeDeleteCtx('?conversationId=conv-1'));
    expect(res.status).toBe(401);
    const json = await res.json() as any;
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when conversationId is missing', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const res = await onRequestDelete(makeDeleteCtx());
    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Missing conversationId');
  });

  it('deletes conversation and returns ok', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb();
    (getDb as Mock).mockReturnValue(mockDb);
    // Need to add delete mock
    mockDb.delete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const res = await onRequestDelete(makeDeleteCtx('?conversationId=conv-123'));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.ok).toBe(true);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    (getUser as Mock).mockRejectedValue(new Error('Auth crashed'));
    const res = await onRequestDelete(makeDeleteCtx('?conversationId=conv-1'));
    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.error).toBe('Internal error');
  });
});
