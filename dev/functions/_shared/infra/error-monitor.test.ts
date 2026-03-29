/**
 * Tests for error monitoring diagnostics and pattern matching.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { diagnoseError, type ErrorInfo } from './error-monitor';

function diag(overrides: Partial<ErrorInfo> = {}): ReturnType<typeof diagnoseError> {
  return diagnoseError({ errorMessage: 'test error', ...overrides });
}

describe('diagnoseError', () => {
  // --- Database errors ---
  it('identifies missing table errors', () => {
    const d = diag({ errorMessage: 'D1_ERROR: no such table: rate_limits' });
    expect(d.category).toBe('Database Schema');
    expect(d.severity).toBe('critical');
    expect(d.suggestedFix).toContain('rate_limits');
    expect(d.suggestedFix).toContain('migrations');
  });

  it('identifies missing column errors', () => {
    const d = diag({ errorMessage: 'no such column: resolved' });
    expect(d.category).toBe('Database Schema');
    expect(d.suggestedFix).toContain('resolved');
  });

  it('identifies database locked errors', () => {
    const d = diag({ errorMessage: 'database is locked' });
    expect(d.category).toBe('Database Contention');
    expect(d.severity).toBe('high');
  });

  it('identifies unique constraint violations', () => {
    const d = diag({ errorMessage: 'UNIQUE constraint failed: profiles.username' });
    expect(d.category).toBe('Database Constraint');
    expect(d.suggestedFix).toContain('idempotency');
  });

  // --- Auth errors ---
  it('identifies JWT/token errors', () => {
    const d = diag({ errorMessage: 'JWT token expired' });
    expect(d.category).toBe('Authentication');
    expect(d.severity).toBe('medium');
  });

  it('identifies Supabase errors', () => {
    const d = diag({ errorMessage: 'Supabase auth service unavailable' });
    expect(d.category).toBe('Supabase');
    expect(d.suggestedFix).toContain('fzncpdelyfuvdeqmwznx');
  });

  // --- External service errors ---
  it('identifies network errors for Piston', () => {
    const d = diag({ errorMessage: 'fetch failed', endpoint: '/api/execute' });
    expect(d.category).toBe('External Service');
    expect(d.suggestedFix).toContain('Piston');
  });

  it('identifies network errors for AI', () => {
    const d = diag({ errorMessage: 'fetch failed: DNS resolution error', endpoint: '/api/ai/chat' });
    expect(d.category).toBe('External Service');
    expect(d.suggestedFix).toContain('Workers AI');
  });

  // --- AI model errors ---
  it('identifies model not found errors', () => {
    const d = diag({ errorMessage: 'Model not found: @cf/meta/llama-3.1-8b-instruct returned 404' });
    expect(d.category).toBe('AI Model');
    expect(d.suggestedFix).toContain('deprecated');
  });

  it('identifies Workers AI errors', () => {
    const d = diag({ errorMessage: 'Cloudflare AI gateway timeout' });
    expect(d.category).toBe('Cloudflare AI');
    expect(d.suggestedFix).toContain('CLOUDFLARE_API_TOKEN');
  });

  // --- JSON errors ---
  it('identifies JSON parse errors', () => {
    const d = diag({ errorMessage: 'Unexpected token < in JSON at position 0' });
    expect(d.category).toBe('JSON Parse');
  });

  // --- Config errors ---
  it('identifies missing binding errors', () => {
    const d = diag({ errorMessage: 'binding not configured for DB' });
    expect(d.category).toBe('Configuration');
    expect(d.severity).toBe('critical');
  });

  // --- Stripe errors ---
  it('identifies Stripe errors via message', () => {
    const d = diag({ errorMessage: 'Stripe webhook signature verification failed' });
    expect(d.category).toBe('Stripe');
    expect(d.suggestedFix).toContain('STRIPE_WEBHOOK_SECRET');
  });

  it('identifies Stripe errors via endpoint', () => {
    const d = diag({ errorMessage: 'some error', endpoint: '/api/webhooks/stripe' });
    expect(d.category).toBe('Stripe');
  });

  // --- Runtime errors ---
  it('identifies null reference errors', () => {
    const d = diag({ errorMessage: 'TypeError: Cannot read property "id" of undefined', endpoint: '/api/attempts' });
    expect(d.category).toBe('Runtime Error');
    expect(d.suggestedFix).toContain('null check');
    expect(d.suggestedFix).toContain('/api/attempts');
  });

  // --- Resource limits ---
  it('identifies payload too large errors', () => {
    const d = diag({ errorMessage: 'Payload too large' });
    expect(d.category).toBe('Resource Limit');
  });

  // --- Code execution ---
  it('identifies execution timeout errors', () => {
    const d = diag({ errorMessage: 'execution timeout after 5000ms' });
    expect(d.category).toBe('Code Execution');
    expect(d.severity).toBe('low');
  });

  // --- Default ---
  it('returns unknown category for unrecognized errors', () => {
    const d = diag({ errorMessage: 'something completely novel happened' });
    expect(d.category).toBe('Unknown');
    expect(d.severity).toBe('high');
    expect(d.suggestedFix).toContain('Debug steps');
  });

  // --- Severity checks ---
  it('assigns critical severity to schema errors', () => {
    expect(diag({ errorMessage: 'no such table: foo' }).severity).toBe('critical');
  });

  it('assigns low severity to code execution issues', () => {
    expect(diag({ errorMessage: 'execution timeout killed' }).severity).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// logError — D1 logging + email alerting + Sentry forwarding
// ---------------------------------------------------------------------------

import { logError } from './error-monitor';

// We need to mock sendEmail since logError calls it
vi.mock('../newsletter/resend', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { sendEmail } from '../newsletter/resend';

describe('logError', () => {
  function makeDb() {
    return {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error noise during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('inserts error into D1 with all fields', async () => {
    const db = makeDb();
    const env = { RESEND_API_KEY: undefined, ERROR_ALERT_EMAIL: undefined };

    await logError(db as unknown as D1Database, env, {
      endpoint: '/api/ai/chat',
      method: 'POST',
      userId: 'user-1',
      errorMessage: 'Test error',
      errorStack: 'at foo (file.ts:10:5)',
      requestBody: '{"key":"value"}',
      level: 'error',
    });

    expect(db.prepare).toHaveBeenCalled();
    const bindCall = db.prepare.mock.results[0].value.bind;
    expect(bindCall).toHaveBeenCalled();
    const args = bindCall.mock.calls[0];
    expect(args[1]).toBe('error'); // level
    expect(args[2]).toBe('/api/ai/chat'); // endpoint
    expect(args[3]).toBe('POST'); // method
    expect(args[4]).toBe('user-1'); // userId
    expect(args[5]).toBe('Test error'); // errorMessage
  });

  it('defaults level to "error" when not specified', async () => {
    const db = makeDb();
    await logError(db as unknown as D1Database, {}, { errorMessage: 'oops' });

    const bindArgs = db.prepare.mock.results[0].value.bind.mock.calls[0];
    expect(bindArgs[1]).toBe('error');
  });

  it('truncates requestBody to 10000 characters', async () => {
    const db = makeDb();
    const longBody = 'x'.repeat(20000);

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'oops',
      requestBody: longBody,
    });

    const bindArgs = db.prepare.mock.results[0].value.bind.mock.calls[0];
    expect(bindArgs[7]).toHaveLength(10000);
  });

  it('does not throw when D1 insert fails', async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error('D1 down')),
        }),
      }),
    };

    // Should not throw
    await expect(
      logError(db as unknown as D1Database, {}, { errorMessage: 'test' })
    ).resolves.toBeUndefined();
  });

  it('skips email when RESEND_API_KEY is missing', async () => {
    const db = makeDb();
    await logError(db as unknown as D1Database, { ERROR_ALERT_EMAIL: 'admin@test.com' }, { errorMessage: 'test' });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips email when ERROR_ALERT_EMAIL is missing', async () => {
    const db = makeDb();
    await logError(db as unknown as D1Database, { RESEND_API_KEY: 'key' }, { errorMessage: 'test' });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends alert email when both RESEND_API_KEY and ERROR_ALERT_EMAIL are set', async () => {
    const db = makeDb();
    const env = { RESEND_API_KEY: 'key', ERROR_ALERT_EMAIL: 'admin@test.com' };

    await logError(db as unknown as D1Database, env, {
      errorMessage: 'Critical failure',
      endpoint: '/api/test',
      level: 'fatal',
    });

    expect(sendEmail).toHaveBeenCalledWith(env, expect.objectContaining({
      to: 'admin@test.com',
      from: 'ruwt.dev alerts <alerts@ruwt.dev>',
    }));
  });

  it('marks email as sent in D1 after successful send', async () => {
    const runMock = vi.fn().mockResolvedValue(undefined);
    let prepareCallCount = 0;
    const db = {
      prepare: vi.fn().mockImplementation(() => {
        prepareCallCount++;
        return {
          bind: vi.fn().mockReturnValue({
            run: runMock,
          }),
        };
      }),
    };
    const env = { RESEND_API_KEY: 'key', ERROR_ALERT_EMAIL: 'admin@test.com' };

    await logError(db as unknown as D1Database, env, { errorMessage: 'test' });

    // Should have at least 2 prepare calls: INSERT + UPDATE email_sent
    expect(prepareCallCount).toBeGreaterThanOrEqual(2);
  });

  it('does not throw when email send fails', async () => {
    const db = makeDb();
    const env = { RESEND_API_KEY: 'key', ERROR_ALERT_EMAIL: 'admin@test.com' };
    (sendEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Email service down'));

    await expect(
      logError(db as unknown as D1Database, env, { errorMessage: 'test' })
    ).resolves.toBeUndefined();
  });

  it('enriches metadata with fixContext containing likelyFiles', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'D1_ERROR: no such table: rate_limits',
      endpoint: '/api/ai/chat',
    });

    const bindArgs = db.prepare.mock.results[0].value.bind.mock.calls[0];
    const metadataStr = bindArgs[9]; // metadata is the last bind arg
    const metadata = JSON.parse(metadataStr);

    expect(metadata.fixContext).toBeDefined();
    expect(metadata.fixContext.category).toBe('Database Schema');
    expect(metadata.fixContext.likelyFiles).toContain('functions/api/ai/chat.ts');
    expect(metadata.fixContext.likelyFiles).toContain('drizzle/schema.d1.ts');
    expect(metadata.fixContext.commands).toContain('npx wrangler d1 migrations apply ruwt-dev --remote');
  });

  it('enriches fixContext for AI model errors', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'Model not found: @cf/meta/llama-3.1-8b returned 404',
      endpoint: '/api/ai/chat',
    });

    const metadata = JSON.parse(
      db.prepare.mock.results[0].value.bind.mock.calls[0][9]
    );
    expect(metadata.fixContext.category).toBe('AI Model');
    expect(metadata.fixContext.likelyFiles).toContain('functions/_shared/ai-pricing.ts');
  });

  it('enriches fixContext with stack trace file location', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'TypeError',
      errorStack: 'Error\n    at handleRequest (/functions/api/ai/chat.ts:42:10)',
    });

    const metadata = JSON.parse(
      db.prepare.mock.results[0].value.bind.mock.calls[0][9]
    );
    expect(metadata.fixContext.likelyFiles[0]).toBe('functions/api/ai/chat.ts:42');
    expect(metadata.fixContext.searchTerms).toContain('handleRequest');
  });

  it('enriches fixContext for execute/submissions endpoint', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'unknown error',
      endpoint: '/api/execute',
    });

    const metadata = JSON.parse(
      db.prepare.mock.results[0].value.bind.mock.calls[0][9]
    );
    expect(metadata.fixContext.likelyFiles).toContain('functions/api/execute.ts');
  });

  it('enriches fixContext for /ai/apply endpoint', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'unknown error',
      endpoint: '/api/ai/apply',
    });

    const metadata = JSON.parse(
      db.prepare.mock.results[0].value.bind.mock.calls[0][9]
    );
    expect(metadata.fixContext.likelyFiles).toContain('functions/api/ai/apply.ts');
  });

  it('enriches fixContext for /submissions endpoint', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'unknown error',
      endpoint: '/api/submissions',
    });

    const metadata = JSON.parse(
      db.prepare.mock.results[0].value.bind.mock.calls[0][9]
    );
    expect(metadata.fixContext.likelyFiles).toContain('functions/api/submissions.ts');
    expect(metadata.fixContext.likelyFiles).toContain('functions/_shared/judge.ts');
  });

  it('enriches fixContext for webhook/stripe endpoint', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'unknown error',
      endpoint: '/api/webhooks/stripe',
    });

    const metadata = JSON.parse(
      db.prepare.mock.results[0].value.bind.mock.calls[0][9]
    );
    expect(metadata.fixContext.likelyFiles).toContain('functions/api/webhooks/stripe.ts');
  });

  it('enriches fixContext for profile endpoint', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'unknown error',
      endpoint: '/api/profile',
    });

    const metadata = JSON.parse(
      db.prepare.mock.results[0].value.bind.mock.calls[0][9]
    );
    expect(metadata.fixContext.likelyFiles).toContain('functions/api/profile.ts');
  });

  it('enriches fixContext for assess endpoint', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'unknown error',
      endpoint: '/api/assess/start',
    });

    const metadata = JSON.parse(
      db.prepare.mock.results[0].value.bind.mock.calls[0][9]
    );
    expect(metadata.fixContext.likelyFiles).toContain('functions/api/assess/start.ts');
  });

  it('enriches fixContext for attempts endpoint', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'unknown error',
      endpoint: '/api/attempts',
    });

    const metadata = JSON.parse(
      db.prepare.mock.results[0].value.bind.mock.calls[0][9]
    );
    expect(metadata.fixContext.likelyFiles).toContain('functions/api/attempts.ts');
  });

  it('derives file path from generic endpoint', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'unknown error',
      endpoint: '/api/foo/bar',
    });

    const metadata = JSON.parse(
      db.prepare.mock.results[0].value.bind.mock.calls[0][9]
    );
    expect(metadata.fixContext.likelyFiles).toContain('functions/api/foo/bar.ts');
  });

  it('enriches fixContext for Authentication category', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'JWT token expired',
    });

    const metadata = JSON.parse(
      db.prepare.mock.results[0].value.bind.mock.calls[0][9]
    );
    expect(metadata.fixContext.likelyFiles).toContain('functions/_shared/auth.ts');
  });

  it('enriches fixContext for External Service category', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'fetch failed',
      endpoint: '/api/execute',
    });

    const metadata = JSON.parse(
      db.prepare.mock.results[0].value.bind.mock.calls[0][9]
    );
    expect(metadata.fixContext.commands.length).toBeGreaterThan(0);
  });

  it('enriches fixContext for Configuration category', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'binding not configured',
    });

    const metadata = JSON.parse(
      db.prepare.mock.results[0].value.bind.mock.calls[0][9]
    );
    expect(metadata.fixContext.likelyFiles).toContain('wrangler.toml');
  });

  it('enriches fixContext for Stripe category', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'Stripe error',
    });

    const metadata = JSON.parse(
      db.prepare.mock.results[0].value.bind.mock.calls[0][9]
    );
    expect(metadata.fixContext.likelyFiles).toContain('functions/api/webhooks/stripe.ts');
  });

  it('enriches fixContext for Database Contention category', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'database is locked',
    });

    const metadata = JSON.parse(
      db.prepare.mock.results[0].value.bind.mock.calls[0][9]
    );
    expect(metadata.fixContext.likelyFiles).toContain('drizzle/schema.d1.ts');
    expect(metadata.fixContext.searchTerms).toContain('unique');
  });

  it('forwards to Sentry when SENTRY_DSN is set', async () => {
    const db = makeDb();
    // Must include email vars so logError doesn't return early before Sentry call
    const env = {
      SENTRY_DSN: 'https://key@sentry.io/123',
      RESEND_API_KEY: 'key',
      ERROR_ALERT_EMAIL: 'admin@test.com',
    };

    // Mock global fetch for Sentry
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    await logError(db as unknown as D1Database, env, {
      errorMessage: 'test sentry forward',
      endpoint: '/api/test',
      level: 'fatal',
      errorStack: 'Error\n    at handleRequest (file.ts:10:5)',
    });

    // Sentry forwarding is fire-and-forget, need a tick
    await new Promise(r => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('sentry.io'),
      expect.objectContaining({
        method: 'POST',
      }),
    );

    fetchSpy.mockRestore();
  });

  it('does not forward to Sentry when SENTRY_DSN is not set', async () => {
    const db = makeDb();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'no sentry',
    });

    await new Promise(r => setTimeout(r, 10));

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('Sentry forwarding swallows errors silently', async () => {
    const db = makeDb();
    const env = { SENTRY_DSN: 'https://key@sentry.io/123' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));

    // Should not throw
    await expect(
      logError(db as unknown as D1Database, env, { errorMessage: 'test' })
    ).resolves.toBeUndefined();

    await new Promise(r => setTimeout(r, 10));
    fetchSpy.mockRestore();
  });

  it('forwards stack frames with simpleMatch format (no function name) to Sentry', async () => {
    const db = makeDb();
    const env = {
      SENTRY_DSN: 'https://key@sentry.io/123',
      RESEND_API_KEY: 'key',
      ERROR_ALERT_EMAIL: 'admin@test.com',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    // Stack trace with simpleMatch format: "at file.ts:10:5" (no function name in parens)
    await logError(db as unknown as D1Database, env, {
      errorMessage: 'test sentry simple stack',
      endpoint: '/api/test',
      level: 'error',
      errorStack: 'Error\n    at /functions/api/test.ts:25:10',
    });

    await new Promise(r => setTimeout(r, 50));

    // Verify the Sentry POST was called
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('sentry.io'),
      expect.objectContaining({ method: 'POST' }),
    );

    // Verify the body contains the stack frame parsed via simpleMatch
    const sentryCall = fetchSpy.mock.calls.find(c =>
      typeof c[0] === 'string' && c[0].includes('sentry.io')
    );
    if (sentryCall) {
      const body = JSON.parse((sentryCall[1] as any).body);
      const frames = body.exception?.values?.[0]?.stacktrace?.frames;
      expect(frames).toBeDefined();
      // The simpleMatch frame should have filename and lineno but no function name
      const simpleFrame = frames.find((f: any) => f.filename === '/functions/api/test.ts');
      expect(simpleFrame).toBeDefined();
      expect(simpleFrame.lineno).toBe(25);
      expect(simpleFrame.function).toBeUndefined();
    }

    fetchSpy.mockRestore();
  });

  it('forwards stack frames with fallback format (unrecognized line) to Sentry', async () => {
    const db = makeDb();
    const env = {
      SENTRY_DSN: 'https://key@sentry.io/123',
      RESEND_API_KEY: 'key',
      ERROR_ALERT_EMAIL: 'admin@test.com',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    // Stack trace line that matches neither full nor simple pattern — just "at <native>"
    await logError(db as unknown as D1Database, env, {
      errorMessage: 'test sentry fallback stack',
      endpoint: '/api/test',
      level: 'error',
      errorStack: 'Error\n    at <native>',
    });

    await new Promise(r => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('sentry.io'),
      expect.objectContaining({ method: 'POST' }),
    );

    const sentryCall = fetchSpy.mock.calls.find(c =>
      typeof c[0] === 'string' && c[0].includes('sentry.io')
    );
    if (sentryCall) {
      const body = JSON.parse((sentryCall[1] as any).body);
      const frames = body.exception?.values?.[0]?.stacktrace?.frames;
      expect(frames).toBeDefined();
      // The fallback frame should have function set to the trimmed line
      const fallbackFrame = frames.find((f: any) => f.function === 'at <native>');
      expect(fallbackFrame).toBeDefined();
    }

    fetchSpy.mockRestore();
  });

  it('handles info with all optional fields as null/undefined', async () => {
    const db = makeDb();

    await logError(db as unknown as D1Database, {}, {
      errorMessage: 'minimal error',
    });

    const bindArgs = db.prepare.mock.results[0].value.bind.mock.calls[0];
    expect(bindArgs[2]).toBeNull(); // endpoint
    expect(bindArgs[3]).toBeNull(); // method
    expect(bindArgs[4]).toBeNull(); // userId
    expect(bindArgs[6]).toBeNull(); // errorStack
    expect(bindArgs[7]).toBeNull(); // requestBody
  });
});
