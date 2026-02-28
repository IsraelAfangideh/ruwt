/**
 * Tests for POST /api/ai/chat — streaming AI chat endpoint.
 *
 * Verifies SSE stream structure, credit deduction, auth gating,
 * constraint enforcement, message replay storage, and error handling.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { onRequestPost } from './chat';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../_shared/auth', () => ({
  getUser: vi.fn(),
}));

vi.mock('../../_shared/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('../../_shared/ai-stream', () => ({
  streamCloudflareAIWithFallback: vi.fn(),
}));

vi.mock('../../_shared/ai-pricing', () => ({
  getModelPricing: vi.fn(),
  calculateCost: vi.fn(),
  countMessageTokens: vi.fn(),
}));

vi.mock('../../_shared/constraints', () => ({
  validateConstraints: vi.fn(),
  checkPreCallConstraints: vi.fn(),
}));

vi.mock('../../_shared/error-monitor', () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

import { getUser } from '../../_shared/auth';
import { getDb } from '../../_shared/db';
import { streamCloudflareAIWithFallback } from '../../_shared/ai-stream';
import { getModelPricing, calculateCost, countMessageTokens } from '../../_shared/ai-pricing';
import { validateConstraints, checkPreCallConstraints } from '../../_shared/constraints';
import { logError } from '../../_shared/error-monitor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER = { id: 'user-1', email: 'test@ruwt.dev' };
const TEST_ATTEMPT_ID = 'a0000000-0000-4000-8000-000000000001';
const TEST_MODEL = '@cf/qwen/qwen2.5-coder-32b-instruct';

function makeRequest(body: unknown): Request {
  return new Request('https://ruwt.dev/api/ai/chat', {
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
    model: TEST_MODEL,
    messages: [{ role: 'user', content: 'Hello' }],
    attemptId: TEST_ATTEMPT_ID,
    userMessage: 'Hello',
    ...overrides,
  };
}

/**
 * Read a ReadableStream-based SSE response and parse all `data:` events
 * into an ordered array of parsed JSON objects.
 */
async function readSSEEvents(response: Response): Promise<unknown[]> {
  const text = await response.text();
  const events: unknown[] = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        events.push(JSON.parse(line.slice(6)));
      } catch {
        // skip unparseable lines
      }
    }
  }
  return events;
}

/**
 * Build a mock async generator that yields StreamChunks then returns
 * usage metadata, simulating streamCloudflareAIWithFallback.
 */
function makeMockStream(
  chunks: Array<{ text: string; phase: 'thinking' | 'content' }>,
  result: { inputTokens: number; outputTokens: number; model: string },
) {
  return async function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
    return result;
  };
}

/**
 * Create a mock "where" result that works as both:
 *  - An awaitable (resolves to `rows` array) for `db.select().from().where()`
 *  - A chainable with `.limit()` for `db.select().from().where().limit(1)`
 *
 * Drizzle query builders are thenables: awaiting them executes the query.
 */
function mockWhereResult(rows: unknown[]) {
  const result = {
    limit: vi.fn().mockResolvedValue(rows),
    then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return result;
}

/**
 * Build a mock drizzle db. Each test pushes query results into `selectResults`
 * before calling the handler. Results are consumed in FIFO order.
 */
function createMockDb() {
  const selectResults: unknown[][] = [];
  const insertedValues: unknown[] = [];

  const db = {
    selectResults,
    insertedValues,
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          const rows = selectResults.shift() || [];
          return mockWhereResult(rows);
        }),
      }),
    })),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((val: unknown) => {
        insertedValues.push(val);
        return Promise.resolve(undefined);
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  return db;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockDb: ReturnType<typeof createMockDb>;

beforeEach(() => {
  vi.clearAllMocks();

  mockDb = createMockDb();
  (getDb as Mock).mockReturnValue(mockDb);
  (getModelPricing as Mock).mockReturnValue({ input: 0.66, output: 1.00, tier: 'premium', provider: 'cloudflare', displayName: 'Qwen2.5 Coder 32B', description: '' });
  (countMessageTokens as Mock).mockReturnValue(50);
  (calculateCost as Mock).mockReturnValue(100);
  (checkPreCallConstraints as Mock).mockResolvedValue({ valid: true });
  (validateConstraints as Mock).mockResolvedValue({ valid: true });
  (logError as Mock).mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/ai/chat', () => {
  // ------------------------------------------------------------------
  // Auth gating
  // ------------------------------------------------------------------

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

  it('returns 400 for invalid request body (missing model)', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const res = await onRequestPost(makeContext({ messages: [] }));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Invalid request');
    expect(json.details).toBeDefined();
  });

  it('returns 400 for completely unparseable JSON body', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const req = new Request('https://ruwt.dev/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{invalid json',
    });

    const res = await onRequestPost({ request: req, env: makeEnv() as any });

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 for unknown model', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    (getModelPricing as Mock).mockReturnValue(undefined);

    const res = await onRequestPost(makeContext(validBody({ model: '@cf/nonexistent/model' })));

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Unknown model');
  });

  // ------------------------------------------------------------------
  // Profile not found
  // ------------------------------------------------------------------

  it('returns 404 when profile does not exist', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    // Profile lookup returns empty
    mockDb.selectResults.push([]);

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toBe('Profile not found');
  });

  // ------------------------------------------------------------------
  // Attempt ownership
  // ------------------------------------------------------------------

  it('returns 404 when attempt does not exist', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    // 1) Profile lookup
    mockDb.selectResults.push([{ id: TEST_USER.id, credits: 50000 }]);
    // 2) Attempt lookup — empty
    mockDb.selectResults.push([]);

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toBe('Attempt not found');
  });

  it('returns 403 when attempt belongs to a different user', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    // 1) Profile lookup
    mockDb.selectResults.push([{ id: TEST_USER.id, credits: 50000 }]);
    // 2) Attempt lookup — owned by someone else
    mockDb.selectResults.push([{ userId: 'other-user', assessmentSessionId: null }]);

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(403);
    const json = await res.json() as any;
    expect(json.error).toBe('Forbidden');
  });

  // ------------------------------------------------------------------
  // Credit checks (assessment vs practice)
  // ------------------------------------------------------------------

  it('returns 402 when assessment attempt has insufficient credits', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    (calculateCost as Mock).mockReturnValue(100);

    // 1) Profile — only 10 credits
    mockDb.selectResults.push([{ id: TEST_USER.id, credits: 10 }]);
    // 2) Attempt — assessment (has assessmentSessionId)
    mockDb.selectResults.push([{ userId: TEST_USER.id, assessmentSessionId: 'session-1' }]);

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(402);
    const json = await res.json() as any;
    expect(json.error).toBe('Insufficient credits');
    expect(json.required).toBe(100);
    expect(json.available).toBe(10);
  });

  it('does NOT check credits for practice attempts (no assessmentSessionId)', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    (calculateCost as Mock).mockReturnValue(100);

    // 1) Profile — low credits (would fail for assessment)
    mockDb.selectResults.push([{ id: TEST_USER.id, credits: 10 }]);
    // 2) Attempt — practice (no assessmentSessionId)
    mockDb.selectResults.push([{ userId: TEST_USER.id, assessmentSessionId: null }]);
    // 3) Max sequence for message replay
    mockDb.selectResults.push([{ maxSeq: -1 }]);

    const gen = makeMockStream(
      [{ text: 'Hi', phase: 'content' }],
      { inputTokens: 50, outputTokens: 10, model: TEST_MODEL },
    );
    (streamCloudflareAIWithFallback as Mock).mockReturnValue(gen());

    const res = await onRequestPost(makeContext(validBody()));

    // Should succeed (SSE stream), NOT 402
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });

  // ------------------------------------------------------------------
  // Constraint violation (pre-call)
  // ------------------------------------------------------------------

  it('returns 403 when pre-call constraint check fails', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    // 1) Profile
    mockDb.selectResults.push([{ id: TEST_USER.id, credits: 50000 }]);
    // 2) Attempt
    mockDb.selectResults.push([{ userId: TEST_USER.id, assessmentSessionId: 'session-1' }]);

    (checkPreCallConstraints as Mock).mockResolvedValue({
      valid: false,
      violation: 'cost',
      message: 'This call would exceed the cost limit',
    });

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(403);
    const json = await res.json() as any;
    expect(json.error).toBe('Constraint violation');
    expect(json.violation).toBe('cost');
  });

  // ------------------------------------------------------------------
  // SSE stream structure: content chunks
  // ------------------------------------------------------------------

  it('streams content chunks with correct SSE structure and "done" at the end', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    (calculateCost as Mock).mockReturnValue(42);

    // 1) Profile
    mockDb.selectResults.push([{ id: TEST_USER.id, credits: 50000 }]);
    // 2) Attempt — practice
    mockDb.selectResults.push([{ userId: TEST_USER.id, assessmentSessionId: null }]);
    // 3) Max sequence
    mockDb.selectResults.push([{ maxSeq: -1 }]);

    const gen = makeMockStream(
      [
        { text: 'Hello', phase: 'content' },
        { text: ' world', phase: 'content' },
      ],
      { inputTokens: 50, outputTokens: 20, model: TEST_MODEL },
    );
    (streamCloudflareAIWithFallback as Mock).mockReturnValue(gen());

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');

    const events = await readSSEEvents(res);

    const chunkEvents = events.filter((e: any) => e.type === 'chunk');
    const doneEvents = events.filter((e: any) => e.type === 'done');

    expect(chunkEvents).toHaveLength(2);
    expect((chunkEvents[0] as any).content).toBe('Hello');
    expect((chunkEvents[1] as any).content).toBe(' world');

    expect(doneEvents).toHaveLength(1);
    const done = doneEvents[0] as any;
    expect(done.inputTokens).toBe(50);
    expect(done.outputTokens).toBe(20);
    expect(done.cost).toBe(42);
    expect(done.model).toBe(TEST_MODEL);
  });

  // ------------------------------------------------------------------
  // SSE stream: thinking chunks + thinking_done transition
  // ------------------------------------------------------------------

  it('emits thinking chunks then thinking_done when transitioning to content', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    mockDb.selectResults.push([{ id: TEST_USER.id, credits: 50000 }]);
    mockDb.selectResults.push([{ userId: TEST_USER.id, assessmentSessionId: null }]);
    mockDb.selectResults.push([{ maxSeq: -1 }]);

    const gen = makeMockStream(
      [
        { text: 'Let me think...', phase: 'thinking' },
        { text: 'The answer is 42', phase: 'content' },
      ],
      { inputTokens: 50, outputTokens: 30, model: TEST_MODEL },
    );
    (streamCloudflareAIWithFallback as Mock).mockReturnValue(gen());

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const types = events.map((e: any) => e.type);
    expect(types).toContain('thinking');
    expect(types).toContain('thinking_done');
    expect(types).toContain('chunk');
    expect(types).toContain('done');

    // thinking_done must come after thinking and before chunk
    const thinkingIdx = types.indexOf('thinking');
    const thinkingDoneIdx = types.indexOf('thinking_done');
    const chunkIdx = types.indexOf('chunk');
    expect(thinkingDoneIdx).toBeGreaterThan(thinkingIdx);
    expect(chunkIdx).toBeGreaterThan(thinkingDoneIdx);
  });

  it('emits thinking_done at end of stream if only thinking chunks were produced', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    mockDb.selectResults.push([{ id: TEST_USER.id, credits: 50000 }]);
    mockDb.selectResults.push([{ userId: TEST_USER.id, assessmentSessionId: null }]);
    mockDb.selectResults.push([{ maxSeq: -1 }]);

    const gen = makeMockStream(
      [{ text: 'Reasoning only...', phase: 'thinking' }],
      { inputTokens: 50, outputTokens: 15, model: TEST_MODEL },
    );
    (streamCloudflareAIWithFallback as Mock).mockReturnValue(gen());

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const types = events.map((e: any) => e.type);
    expect(types).toContain('thinking');
    expect(types).toContain('thinking_done');
    expect(types).toContain('done');
    // thinking_done should appear before done
    expect(types.indexOf('thinking_done')).toBeLessThan(types.indexOf('done'));
  });

  // ------------------------------------------------------------------
  // Credit deduction for assessment attempts
  // ------------------------------------------------------------------

  it('deducts credits for assessment attempts after streaming', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    (calculateCost as Mock).mockReturnValue(75);

    // 1) Profile
    mockDb.selectResults.push([{ id: TEST_USER.id, credits: 50000 }]);
    // 2) Attempt — assessment
    mockDb.selectResults.push([{ userId: TEST_USER.id, assessmentSessionId: 'session-abc' }]);
    // 3) Max sequence
    mockDb.selectResults.push([{ maxSeq: 0 }]);

    const gen = makeMockStream(
      [{ text: 'answer', phase: 'content' }],
      { inputTokens: 100, outputTokens: 50, model: TEST_MODEL },
    );
    (streamCloudflareAIWithFallback as Mock).mockReturnValue(gen());

    const res = await onRequestPost(makeContext(validBody()));
    // Consume the stream fully to trigger the post-stream DB writes
    await res.text();

    // update() should be called: once for profiles (credit deduction), once for attempts
    expect(mockDb.update).toHaveBeenCalled();
    // insert() should be called: user message + ai call + assistant message
    expect(mockDb.insert).toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // Message replay storage
  // ------------------------------------------------------------------

  it('stores user and assistant messages for replay when attemptId and userMessage provided', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    // 1) Profile
    mockDb.selectResults.push([{ id: TEST_USER.id, credits: 50000 }]);
    // 2) Attempt — practice
    mockDb.selectResults.push([{ userId: TEST_USER.id, assessmentSessionId: null }]);
    // 3) Max sequence — existing messages up to seq 2
    mockDb.selectResults.push([{ maxSeq: 2 }]);

    const gen = makeMockStream(
      [{ text: 'Response text', phase: 'content' }],
      { inputTokens: 50, outputTokens: 20, model: TEST_MODEL },
    );
    (streamCloudflareAIWithFallback as Mock).mockReturnValue(gen());

    const res = await onRequestPost(
      makeContext(validBody({ userMessage: 'What is 2+2?' }))
    );
    await res.text();

    // Should have stored user message (sequence 3) and assistant message (sequence 4)
    const userMsg = mockDb.insertedValues.find(
      (v: any) => v.role === 'user' && v.content === 'What is 2+2?'
    );
    expect(userMsg).toBeDefined();
    expect((userMsg as any).sequence).toBe(3);

    const assistantMsg = mockDb.insertedValues.find((v: any) => v.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect((assistantMsg as any).content).toBe('Response text');
    expect((assistantMsg as any).sequence).toBe(4);
  });

  it('does NOT store messages when userMessage is omitted', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    mockDb.selectResults.push([{ id: TEST_USER.id, credits: 50000 }]);
    mockDb.selectResults.push([{ userId: TEST_USER.id, assessmentSessionId: null }]);

    const gen = makeMockStream(
      [{ text: 'Hi', phase: 'content' }],
      { inputTokens: 50, outputTokens: 10, model: TEST_MODEL },
    );
    (streamCloudflareAIWithFallback as Mock).mockReturnValue(gen());

    const res = await onRequestPost(
      makeContext(validBody({ userMessage: undefined }))
    );
    await res.text();

    // No user or assistant messages should be stored (only the aiCalls insert)
    const userMsgs = mockDb.insertedValues.filter((v: any) => v.role === 'user');
    const assistantMsgs = mockDb.insertedValues.filter((v: any) => v.role === 'assistant');
    expect(userMsgs).toHaveLength(0);
    expect(assistantMsgs).toHaveLength(0);
  });

  // ------------------------------------------------------------------
  // Post-call constraint warning via SSE
  // ------------------------------------------------------------------

  it('emits constraint_warning SSE event when post-call validation fails', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    mockDb.selectResults.push([{ id: TEST_USER.id, credits: 50000 }]);
    mockDb.selectResults.push([{ userId: TEST_USER.id, assessmentSessionId: 'session-1' }]);
    mockDb.selectResults.push([{ maxSeq: -1 }]);

    (validateConstraints as Mock).mockResolvedValue({
      valid: false,
      violation: 'cost',
      message: 'Cost limit exceeded',
    });

    const gen = makeMockStream(
      [{ text: 'done', phase: 'content' }],
      { inputTokens: 50, outputTokens: 10, model: TEST_MODEL },
    );
    (streamCloudflareAIWithFallback as Mock).mockReturnValue(gen());

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const warnings = events.filter((e: any) => e.type === 'constraint_warning');
    expect(warnings).toHaveLength(1);
    expect((warnings[0] as any).violation).toBe('cost');
    expect((warnings[0] as any).message).toBe('Cost limit exceeded');
  });

  // ------------------------------------------------------------------
  // Error handling in stream
  // ------------------------------------------------------------------

  it('emits error SSE event when streaming throws', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    mockDb.selectResults.push([{ id: TEST_USER.id, credits: 50000 }]);
    mockDb.selectResults.push([{ userId: TEST_USER.id, assessmentSessionId: null }]);
    mockDb.selectResults.push([{ maxSeq: -1 }]);

    // Generator that throws mid-stream
    const failingGen = async function* () {
      yield { text: 'partial', phase: 'content' as const };
      throw new Error('Cloudflare AI connection lost');
    };
    (streamCloudflareAIWithFallback as Mock).mockReturnValue(failingGen());

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const errorEvents = events.filter((e: any) => e.type === 'error');
    expect(errorEvents).toHaveLength(1);
    expect((errorEvents[0] as any).message).toBe('Cloudflare AI connection lost');

    // logError should have been called
    expect(logError).toHaveBeenCalled();
  });

  it('emits error SSE event when no result returned from stream (no chunks)', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    mockDb.selectResults.push([{ id: TEST_USER.id, credits: 50000 }]);
    mockDb.selectResults.push([{ userId: TEST_USER.id, assessmentSessionId: null }]);
    mockDb.selectResults.push([{ maxSeq: -1 }]);

    // Generator that returns undefined (no result)
    const emptyGen = async function* () {
      // yield nothing, return nothing (result will be undefined)
    };
    (streamCloudflareAIWithFallback as Mock).mockReturnValue(emptyGen());

    const res = await onRequestPost(makeContext(validBody()));
    const events = await readSSEEvents(res);

    const errorEvents = events.filter((e: any) => e.type === 'error');
    expect(errorEvents).toHaveLength(1);
    expect((errorEvents[0] as any).message).toBe('No result from stream');
  });

  // ------------------------------------------------------------------
  // No attemptId: skips attempt lookup, constraints, and cost tracking
  // ------------------------------------------------------------------

  it('skips attempt lookup and constraints when attemptId is null', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    // Only profile lookup — no attempt lookup
    mockDb.selectResults.push([{ id: TEST_USER.id, credits: 50000 }]);

    const gen = makeMockStream(
      [{ text: 'Hi', phase: 'content' }],
      { inputTokens: 30, outputTokens: 5, model: TEST_MODEL },
    );
    (streamCloudflareAIWithFallback as Mock).mockReturnValue(gen());

    const res = await onRequestPost(
      makeContext(validBody({ attemptId: null, userMessage: undefined }))
    );
    const events = await readSSEEvents(res);

    // Should still stream properly
    const doneEvents = events.filter((e: any) => e.type === 'done');
    expect(doneEvents).toHaveLength(1);

    // checkPreCallConstraints should NOT be called
    expect(checkPreCallConstraints).not.toHaveBeenCalled();
    // validateConstraints should NOT be called
    expect(validateConstraints).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // Top-level catch (500)
  // ------------------------------------------------------------------

  it('returns 500 when an unexpected error occurs before stream starts', async () => {
    (getUser as Mock).mockRejectedValue(new Error('Auth service down'));

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.error).toBe('Internal server error');
    expect(json.details).toBe('Auth service down');
  });
});
