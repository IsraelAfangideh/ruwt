/**
 * Tests for error monitoring diagnostics and pattern matching.
 */
import { describe, it, expect } from 'vitest';
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
