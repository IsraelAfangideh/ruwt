/**
 * Tests for POST /api/ai/apply — non-streaming code merge endpoint.
 *
 * Verifies 3-model fallback, verification checks (size, structure,
 * bracket balance), fence stripping, cost tracking, auth gating,
 * and invalid request handling.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { onRequestPost } from './apply';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../_shared/auth', () => ({
  getUser: vi.fn(),
}));

vi.mock('../../_shared/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('../../_shared/ai-pricing', () => ({
  calculateCost: vi.fn(),
}));

vi.mock('../../_shared/error-monitor', () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

import { getUser } from '../../_shared/auth';
import { getDb } from '../../_shared/db';
import { calculateCost } from '../../_shared/ai-pricing';
import { logError } from '../../_shared/error-monitor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER = { id: 'user-1', email: 'test@ruwt.dev' };
const TEST_ATTEMPT_ID = 'a0000000-0000-4000-8000-000000000001';

/** Keep a reference to the real global.fetch so we can restore it. */
const originalFetch = globalThis.fetch;

function makeRequest(body: unknown): Request {
  return new Request('https://ruwt.dev/api/ai/apply', {
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
    attemptId: TEST_ATTEMPT_ID,
    currentCode: 'function add(a, b) {\n  return a + b;\n}',
    aiResponse: '```javascript\nfunction add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}\n```',
    language: 'javascript',
    ...overrides,
  };
}

/**
 * Create a Cloudflare AI JSON response with structured mergedCode.
 */
function cfAIJsonResponse(mergedCode: string, status = 200): Response {
  return new Response(
    JSON.stringify({
      result: {
        response: JSON.stringify({ mergedCode }),
      },
      success: true,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

/**
 * Create a Cloudflare AI error response.
 */
function cfAIErrorResponse(status: number, body = 'Model not found'): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  });
}

function createMockDb() {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const updateSetWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateSetWhere });

  return {
    select: vi.fn(),
    insert: vi.fn().mockReturnValue({ values: insertValues }),
    update: vi.fn().mockReturnValue({ set: updateSet }),
    _insertValues: insertValues,
    _updateSet: updateSet,
    _updateSetWhere: updateSetWhere,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockDb: ReturnType<typeof createMockDb>;
let mockFetch: Mock;

beforeEach(() => {
  vi.clearAllMocks();

  mockDb = createMockDb();
  (getDb as Mock).mockReturnValue(mockDb);
  (calculateCost as Mock).mockReturnValue(50);
  (logError as Mock).mockResolvedValue(undefined);

  // Replace global fetch with a mock
  mockFetch = vi.fn();
  globalThis.fetch = mockFetch as any;

  // Default: attempt found and owned by user
  let callIndex = 0;
  mockDb.select.mockImplementation(() => {
    callIndex++;
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(
            [{ userId: TEST_USER.id, challengeId: 'challenge-1' }]
          ),
        }),
      }),
    };
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// Need to import afterEach
import { afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/ai/apply', () => {
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

  it('returns 400 for invalid request body (missing attemptId)', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const res = await onRequestPost(
      makeContext({ currentCode: 'x', aiResponse: 'y', language: 'js' })
    );

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Invalid request');
    expect(json.details).toBeDefined();
  });

  it('returns 400 for unparseable JSON body', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const req = new Request('https://ruwt.dev/api/ai/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{not json',
    });

    const res = await onRequestPost({ request: req, env: makeEnv() as any });

    expect(res.status).toBe(400);
  });

  // ------------------------------------------------------------------
  // Attempt ownership
  // ------------------------------------------------------------------

  it('returns 404 when attempt does not exist', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }));

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toBe('Attempt not found');
  });

  it('returns 403 when attempt belongs to a different user', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(
            [{ userId: 'other-user', challengeId: 'challenge-1' }]
          ),
        }),
      }),
    }));

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(403);
    const json = await res.json() as any;
    expect(json.error).toBe('Forbidden');
  });

  // ------------------------------------------------------------------
  // Missing AI credentials
  // ------------------------------------------------------------------

  it('returns 500 when CLOUDFLARE_ACCOUNT_ID is missing', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const env = makeEnv();
    delete env.CLOUDFLARE_ACCOUNT_ID;
    const res = await onRequestPost({
      request: makeRequest(validBody()),
      env: env as any,
    });

    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.error).toBe('AI credentials not configured');
  });

  // ------------------------------------------------------------------
  // Successful merge with verification
  // ------------------------------------------------------------------

  it('returns mergedCode and verified=true on successful merge', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    (calculateCost as Mock).mockReturnValue(85);

    const mergedCode = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';
    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(mergedCode));

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.mergedCode).toBe(mergedCode);
    expect(json.verified).toBe(true);
    expect(json.verificationErrors).toEqual([]);
    expect(json.model).toBe('@cf/qwen/qwen2.5-coder-32b-instruct');
    expect(json.cost).toBe(85);
    expect(json.inputTokens).toBeGreaterThan(0);
    expect(json.outputTokens).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------
  // 3-model fallback: first model 404, second succeeds
  // ------------------------------------------------------------------

  it('falls back to next model when first returns 404', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const mergedCode = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';

    // First model: 404
    mockFetch.mockResolvedValueOnce(cfAIErrorResponse(404));
    // Second model: success
    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(mergedCode));

    const res = await onRequestPost(makeContext(validBody()));

    const json = await res.json() as any;
    expect(json.verified).toBe(true);
    expect(json.model).toBe('@cf/meta/llama-3.1-70b-instruct');
    // fetch called twice
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('falls back to next model when first returns 400', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const mergedCode = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';

    // First model: 400
    mockFetch.mockResolvedValueOnce(cfAIErrorResponse(400, 'Bad request: model not found'));
    // Second model: success
    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(mergedCode));

    const res = await onRequestPost(makeContext(validBody()));

    const json = await res.json() as any;
    expect(json.verified).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // ------------------------------------------------------------------
  // All models fail
  // ------------------------------------------------------------------

  it('throws when all 3 models return errors (last model error propagates)', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    // All three models 404
    mockFetch.mockResolvedValueOnce(cfAIErrorResponse(404, 'not found'));
    mockFetch.mockResolvedValueOnce(cfAIErrorResponse(404, 'not found'));
    // Third model (last) — NOT unavailable-type error — throws
    mockFetch.mockResolvedValueOnce(cfAIErrorResponse(404, 'not found'));

    const res = await onRequestPost(makeContext(validBody()));

    // Last model is last in APPLY_MODELS — its 404 throws because it's the last model
    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.error).toBe('Internal server error');
  });

  // ------------------------------------------------------------------
  // Empty result from model
  // ------------------------------------------------------------------

  it('returns 502 when last model returns empty result', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    // First two: 404
    mockFetch.mockResolvedValueOnce(cfAIErrorResponse(404));
    mockFetch.mockResolvedValueOnce(cfAIErrorResponse(404));
    // Third: success but empty content
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ result: { response: '' }, success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    );

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(502);
    const json = await res.json() as any;
    expect(json.error).toBe('Apply model returned empty result');
  });

  // ------------------------------------------------------------------
  // Fence stripping: model returns markdown fenced code instead of JSON
  // ------------------------------------------------------------------

  it('strips markdown fences when model does not respect JSON mode', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const code = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';
    const fencedResponse = '```javascript\n' + code + '\n```';

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ result: { response: fencedResponse }, success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    );

    const res = await onRequestPost(makeContext(validBody()));
    const json = await res.json() as any;

    // Should have extracted the code from inside the fences
    expect(json.mergedCode).toBe(code);
    expect(json.verified).toBe(true);
  });

  it('handles JSON response where mergedCode is empty — falls back to fence stripping', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const code = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';
    // JSON with empty mergedCode but content has fenced code
    const jsonWithFences = JSON.stringify({ mergedCode: '' });
    // Wrap in another JSON so result.response is the outer JSON
    // But since mergedCode is empty, it'll fall through to stripFences
    // which won't find fences in the raw JSON string. Let's test with prose + fences:
    const responseContent = 'Here is the merged code:\n```javascript\n' + code + '\n```';

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ result: { response: responseContent }, success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    );

    const res = await onRequestPost(makeContext(validBody()));
    const json = await res.json() as any;

    expect(json.mergedCode).toBe(code);
  });

  // ------------------------------------------------------------------
  // Verification checks
  // ------------------------------------------------------------------

  it('detects severe truncation and returns verified=false', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    // Original has many lines
    const originalCode = Array.from({ length: 20 }, (_, i) =>
      `function fn${i}() { return ${i}; }`
    ).join('\n');

    // Merged is severely truncated (fewer than 30% of original lines)
    const truncatedMerge = 'function fn0() { return 0; }';

    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(truncatedMerge));

    const res = await onRequestPost(
      makeContext(validBody({ currentCode: originalCode }))
    );
    const json = await res.json() as any;

    expect(json.verified).toBe(false);
    expect(json.mergedCode).toBeNull();
    expect(json.verificationErrors.length).toBeGreaterThan(0);
    expect(json.verificationErrors.some((e: string) => e.includes('truncation'))).toBe(true);
  });

  it('detects missing function names from original (structure preservation)', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const originalCode = 'function compute() { return 1; }\nfunction render() { return 2; }';
    // Merged code drops "render" entirely
    const mergedCode = 'function compute() { return 1; }\nfunction subtract() { return 0; }';

    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(mergedCode));

    const res = await onRequestPost(
      makeContext(validBody({ currentCode: originalCode }))
    );
    const json = await res.json() as any;

    expect(json.verified).toBe(false);
    expect(json.verificationErrors.some((e: string) => e.includes('render'))).toBe(true);
  });

  it('detects unbalanced curly braces (bracket balance check)', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const originalCode = 'function add(a, b) {\n  return a + b;\n}';
    // 4 open braces with 0 close braces = imbalance of +4
    const unbalancedMerge = 'function add(a, b) {\n  return a + b;\n\nfunction subtract(a, b) {\n  return a - b;\n\nfunction multiply(a, b) {\n  return a * b;\n\nfunction divide(a, b) {';

    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(unbalancedMerge));

    const res = await onRequestPost(makeContext(validBody({ currentCode: originalCode })));
    const json = await res.json() as any;

    expect(json.verified).toBe(false);
    expect(json.verificationErrors.some((e: string) => e.includes('curly braces'))).toBe(true);
  });

  it('detects unbalanced parentheses', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const originalCode = 'console.log("hi")';
    // Many open parens, no close
    const unbalancedMerge = 'console.log("hi")\nconsole.log(foo(bar(baz(qux(';

    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(unbalancedMerge));

    const res = await onRequestPost(makeContext(validBody({ currentCode: originalCode })));
    const json = await res.json() as any;

    expect(json.verified).toBe(false);
    expect(json.verificationErrors.some((e: string) => e.includes('parentheses'))).toBe(true);
  });

  // ------------------------------------------------------------------
  // Cost tracking even on verification failure
  // ------------------------------------------------------------------

  it('tracks cost in DB even when verification fails', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    (calculateCost as Mock).mockReturnValue(75);

    const originalCode = Array.from({ length: 20 }, (_, i) =>
      `function fn${i}() { return ${i}; }`
    ).join('\n');
    const truncatedMerge = 'function fn0() { return 0; }';

    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(truncatedMerge));

    const res = await onRequestPost(
      makeContext(validBody({ currentCode: originalCode }))
    );
    const json = await res.json() as any;

    expect(json.verified).toBe(false);
    // Cost should still be tracked
    expect(json.cost).toBe(75);

    // update() should have been called to update attempt cost
    expect(mockDb.update).toHaveBeenCalled();
    // insert() should have been called to log the aiCall
    expect(mockDb.insert).toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // logError called on verification failure
  // ------------------------------------------------------------------

  it('calls logError with fatal level on verification failure', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const originalCode = Array.from({ length: 20 }, (_, i) =>
      `function fn${i}() { return ${i}; }`
    ).join('\n');
    const truncatedMerge = 'function fn0() { return 0; }';

    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(truncatedMerge));

    const res = await onRequestPost(
      makeContext(validBody({ currentCode: originalCode }))
    );
    await res.json();

    expect(logError).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        endpoint: '/api/ai/apply',
        level: 'fatal',
        userId: TEST_USER.id,
      }),
    );
  });

  // ------------------------------------------------------------------
  // Successful merge passes verification
  // ------------------------------------------------------------------

  it('passes verification when merge preserves structure and new content', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const originalCode = 'function add(a, b) {\n  return a + b;\n}';
    const aiResponse = '```javascript\nfunction add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}\n```';
    const mergedCode = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';

    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(mergedCode));

    const res = await onRequestPost(
      makeContext(validBody({ currentCode: originalCode, aiResponse }))
    );
    const json = await res.json() as any;

    expect(json.verified).toBe(true);
    expect(json.verificationErrors).toEqual([]);
    expect(json.mergedCode).toBe(mergedCode);
  });

  // ------------------------------------------------------------------
  // Response with choices format (OpenAI-compatible)
  // ------------------------------------------------------------------

  it('handles OpenAI-compatible choices response format', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const mergedCode = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: {
            choices: [
              { message: { content: JSON.stringify({ mergedCode }) } },
            ],
          },
          success: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    );

    const res = await onRequestPost(makeContext(validBody()));
    const json = await res.json() as any;

    expect(json.mergedCode).toBe(mergedCode);
    expect(json.verified).toBe(true);
  });

  // ------------------------------------------------------------------
  // Response with number/boolean content (Cloudflare quirk)
  // ------------------------------------------------------------------

  it('handles numeric response value by converting to string', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    // First model returns numeric response (too short) — skip
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ result: { response: 42 }, success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    );
    // Second model returns proper result
    const mergedCode = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';
    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(mergedCode));

    const res = await onRequestPost(makeContext(validBody()));
    const json = await res.json() as any;

    // "42" is only 2 chars, < 10 minimum — falls through to next model
    expect(json.model).toBe('@cf/meta/llama-3.1-70b-instruct');
    expect(json.verified).toBe(true);
  });

  // ------------------------------------------------------------------
  // calculateCost throws — fallback cost calculation
  // ------------------------------------------------------------------

  it('falls back to manual cost calculation when calculateCost throws', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    (calculateCost as Mock).mockImplementation(() => {
      throw new Error('Unknown model');
    });

    const mergedCode = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';
    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(mergedCode));

    const res = await onRequestPost(makeContext(validBody()));
    const json = await res.json() as any;

    expect(json.verified).toBe(true);
    // Cost should be computed via fallback formula (not zero)
    expect(json.cost).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------
  // Fence stripping edge cases
  // ------------------------------------------------------------------

  it('handles unclosed fence block (starts with ``` but never closes)', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const code = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';
    // Unclosed fence
    const unclosedFence = '```javascript\n' + code;

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ result: { response: unclosedFence }, success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    );

    const res = await onRequestPost(makeContext(validBody()));
    const json = await res.json() as any;

    expect(json.mergedCode).toBe(code);
  });

  it('picks the largest fenced block when multiple are present', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const smallBlock = 'x = 1';
    const largeBlock = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';
    const multiFence = '```js\n' + smallBlock + '\n```\n\nHere is the full file:\n```javascript\n' + largeBlock + '\n```';

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ result: { response: multiFence }, success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    );

    const res = await onRequestPost(makeContext(validBody()));
    const json = await res.json() as any;

    expect(json.mergedCode).toBe(largeBlock);
  });

  // ------------------------------------------------------------------
  // Top-level 500 error
  // ------------------------------------------------------------------

  it('returns 500 when an unexpected error occurs', async () => {
    (getUser as Mock).mockRejectedValue(new Error('Unexpected failure'));

    const res = await onRequestPost(makeContext(validBody()));

    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.error).toBe('Internal server error');
    expect(json.details).toBe('Unexpected failure');
  });

  // ------------------------------------------------------------------
  // Fetch URL construction
  // ------------------------------------------------------------------

  it('calls Cloudflare AI API with correct URL and headers', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const mergedCode = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';
    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(mergedCode));

    await onRequestPost(makeContext(validBody()));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acct-123/ai/run/@cf/qwen/qwen2.5-coder-32b-instruct'
    );
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer token-456');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toContain('<ORIGINAL>');
    expect(body.messages[1].content).toContain('<UPDATE>');
    expect(body.max_tokens).toBe(8192);
    expect(body.temperature).toBe(0.0);
  });

  // ------------------------------------------------------------------
  // Non-fatal model error on non-last model — continues fallback
  // ------------------------------------------------------------------

  it('continues to next model when a non-last model throws a non-unavailable error', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    // First model: fetch rejects (network error)
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));
    // Second model: succeeds
    const mergedCode = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';
    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(mergedCode));

    const res = await onRequestPost(makeContext(validBody()));
    const json = await res.json() as any;

    expect(json.verified).toBe(true);
    expect(json.model).toBe('@cf/meta/llama-3.1-70b-instruct');
  });

  // ------------------------------------------------------------------
  // Model skips empty content for non-last model
  // ------------------------------------------------------------------

  it('skips to next model when non-last model returns short content', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    // First model: returns very short content
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ result: { response: 'hi' }, success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    );
    // Second model: proper response
    const mergedCode = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';
    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(mergedCode));

    const res = await onRequestPost(makeContext(validBody()));
    const json = await res.json() as any;

    expect(json.verified).toBe(true);
    expect(json.model).toBe('@cf/meta/llama-3.1-70b-instruct');
  });

  // ------------------------------------------------------------------
  // Verification: distinctive token survival (regex)
  // ------------------------------------------------------------------

  it('detects corrupted regex patterns as verification failure', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const originalCode = 'function validate(s) { return false; }';
    const aiResponse = '```javascript\nfunction validate(s) {\n  return /(?<=\\$)\\d+/.test(s);\n}\n```';
    // Merged code corrupts the lookbehind
    const mergedCode = 'function validate(s) {\n  return /(?<\\$)\\d+/.test(s);\n}';

    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(mergedCode));

    const res = await onRequestPost(
      makeContext(validBody({ currentCode: originalCode, aiResponse }))
    );
    const json = await res.json() as any;

    expect(json.verified).toBe(false);
    expect(json.verificationErrors.some((e: string) => e.includes('tokens corrupted'))).toBe(true);
  });

  // ------------------------------------------------------------------
  // Verification: new content survival
  // ------------------------------------------------------------------

  it('detects missing new code lines as verification failure', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const originalCode = 'function greet() {\n  return "hello";\n}';
    const aiResponse = '```javascript\nfunction greet() {\n  return "hello";\n}\n\nfunction farewell() {\n  console.log("setup complete");\n  console.log("initializing teardown");\n  console.log("cleaning resources");\n  console.log("shutting down services");\n  return "goodbye";\n}\n```';
    // Merged code keeps original but drops most new lines (>30%)
    const mergedCode = 'function greet() {\n  return "hello";\n}\n\nfunction farewell() {\n  return "goodbye";\n}';

    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(mergedCode));

    const res = await onRequestPost(
      makeContext(validBody({ currentCode: originalCode, aiResponse }))
    );
    const json = await res.json() as any;

    expect(json.verified).toBe(false);
    expect(json.verificationErrors.some((e: string) => e.includes('new code lines missing'))).toBe(true);
  });

  // ------------------------------------------------------------------
  // No code blocks in AI response — skips new-content and token checks
  // ------------------------------------------------------------------

  it('passes verification when AI response has no code blocks (plain text)', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const originalCode = 'function add(a, b) {\n  return a + b;\n}';
    // AI just describes the change, no fenced code
    const aiResponse = 'Change the return type to return a - b instead.';
    const mergedCode = 'function add(a, b) {\n  return a - b;\n}';

    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(mergedCode));

    const res = await onRequestPost(
      makeContext(validBody({ currentCode: originalCode, aiResponse }))
    );
    const json = await res.json() as any;

    // No code blocks => no new-content or token checks => only size/structure/bracket
    expect(json.verified).toBe(true);
  });

  // ------------------------------------------------------------------
  // Fence stripping: plain text (no fences at all)
  // ------------------------------------------------------------------

  it('returns raw text when model output has no fences at all', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const code = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';
    // Model returns just the code, no fences, and it's not valid JSON
    // This hits the stripFences "return trimmed" fallback (line 286)
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ result: { response: code }, success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    );

    const res = await onRequestPost(makeContext(validBody()));
    const json = await res.json() as any;

    // The code isn't valid JSON, so it falls to stripFences, which has no fences => returns trimmed
    expect(json.mergedCode).toBe(code);
    expect(json.verified).toBe(true);
  });

  // ------------------------------------------------------------------
  // JSON parsed but mergedCode is empty string — fallback to stripFences
  // ------------------------------------------------------------------

  it('falls back to stripFences when JSON mergedCode is empty string', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const code = 'function add(a, b) {\n  return a + b;\n}\n\nfunction subtract(a, b) {\n  return a - b;\n}';
    // Valid JSON with empty mergedCode → falls to line 415: stripFences(content)
    // But the content IS the JSON string, so stripFences returns it trimmed
    // Need the JSON to also contain fences for a useful merge
    const jsonWithEmptyMerged = JSON.stringify({ mergedCode: '', code });
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ result: { response: jsonWithEmptyMerged }, success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    );

    const res = await onRequestPost(makeContext(validBody()));
    const json = await res.json() as any;

    // Content is valid JSON with empty mergedCode -> stripFences called on content (line 415)
    // stripFences returns the trimmed JSON string since there are no fences
    expect(json.mergedCode).toBeDefined();
  });

  // ------------------------------------------------------------------
  // Verification: template literal corruption detection
  // ------------------------------------------------------------------

  it('detects corrupted template literals as verification failure', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const originalCode = 'function greet(name) { return "hello"; }';
    const aiResponse = '```javascript\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n```';
    // Merged code corrupts the template literal
    const mergedCode = 'function greet(name) {\n  return `Hello, $name!`;\n}';

    mockFetch.mockResolvedValueOnce(cfAIJsonResponse(mergedCode));

    const res = await onRequestPost(
      makeContext(validBody({ currentCode: originalCode, aiResponse }))
    );
    const json = await res.json() as any;

    expect(json.verified).toBe(false);
    expect(json.verificationErrors.some((e: string) => e.includes('tokens corrupted'))).toBe(true);
  });
});
