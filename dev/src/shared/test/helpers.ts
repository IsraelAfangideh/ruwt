/**
 * Shared test helpers for the dev test suite.
 * Provides reusable mock factories and utilities to reduce
 * duplication across test files.
 */
import { vi } from 'vitest';

// ── Environment / Context Factories ──────────────────────────────────

/** Creates a mock Env object for Cloudflare Functions tests */
export function makeEnv(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    DB: {} as unknown,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
    RESEND_API_KEY: 'test-key',
    ...overrides,
  };
}

/** Creates a mock request context for Cloudflare Functions handlers */
export function makeContext<P extends Record<string, string>>(
  url: string,
  params: P,
  opts?: { method?: string; body?: unknown },
) {
  const init: RequestInit = { method: opts?.method ?? 'GET' };
  if (opts?.body) {
    init.body = JSON.stringify(opts.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return {
    request: new Request(url, init),
    env: makeEnv(),
    params,
  };
}

// ── DB Mock Factories ────────────────────────────────────────────────

/** Builds a chainable Drizzle-style query mock that resolves results in order */
export function makeDbChain(results: unknown[]) {
  let callIndex = 0;
  return {
    select: vi.fn().mockImplementation(() => {
      const idx = callIndex++;
      const result = idx < results.length ? results[idx] : [];
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue(Array.isArray(result) ? result : [result]);
      chain.orderBy = vi.fn().mockResolvedValue(Array.isArray(result) ? result : [result]);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.leftJoin = vi.fn().mockReturnValue(chain);
      return chain;
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        catch: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          set: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// ── Fake Data Factories ──────────────────────────────────────────────

export function fakeUser(overrides?: Record<string, unknown>) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    user_metadata: { full_name: 'Test User', avatar_url: null },
    ...overrides,
  };
}

export function fakeAttempt(overrides?: Record<string, unknown>) {
  return {
    id: 'att-1',
    userId: 'user-1',
    challengeId: 'ch-1',
    status: 'in_progress',
    totalCost: 0,
    inputTokens: 0,
    outputTokens: 0,
    passedTests: 0,
    totalTests: 5,
    createdAt: '2026-01-01T00:00:00Z',
    submittedAt: null,
    ...overrides,
  };
}

export function fakeChallenge(overrides?: Record<string, unknown>) {
  return {
    id: 'ch-1',
    title: 'Test Challenge',
    slug: 'test-challenge',
    description: 'A test challenge',
    difficulty: 'easy',
    category: 'prompt_efficiency',
    language: 'typescript',
    skillTested: 'basic',
    testCases: JSON.stringify([{ input: [1], expected: 1 }]),
    hiddenTestCases: JSON.stringify([{ input: [2], expected: 2 }]),
    ...overrides,
  };
}

export function fakeSession(overrides?: Record<string, unknown>) {
  return {
    id: 'sess-1',
    userId: 'user-1',
    assessmentId: 'assess-1',
    status: 'in_progress',
    inviteId: null,
    totalCost: 0,
    totalTokens: 0,
    shareToken: 'share-token-1',
    startedAt: '2026-01-01T00:00:00Z',
    completedAt: null,
    ...overrides,
  };
}

// ── SSE Stream Helpers ───────────────────────────────────────────────

/** Creates a ReadableStream that emits SSE-formatted chunks */
export function makeSSEStream(events: Array<{ data: string }>) {
  const encoder = new TextEncoder();
  const chunks = events.map((e) => `data: ${e.data}\n\n`);
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
}

/** Waits for fire-and-forget async blocks to settle */
export function flushAsync(ms = 50) {
  return new Promise((r) => setTimeout(r, ms));
}
