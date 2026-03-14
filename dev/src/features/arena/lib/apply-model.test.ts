import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callApplyModel } from './apply-model';

describe('callApplyModel', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const defaultOpts = {
    attemptId: 'attempt-abc',
    currentCode: 'function solve() { return 1; }',
    aiResponse: 'Change return 1 to return 42',
    language: 'javascript',
  };

  // ---------------------------------------------------------------------------
  // Request construction
  // ---------------------------------------------------------------------------
  describe('request construction', () => {
    it('sends POST to /api/ai/apply with correct headers and body', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          mergedCode: 'function solve() { return 42; }',
          verified: true,
          verificationErrors: [],
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.001,
        }),
      });

      await callApplyModel(defaultOpts);

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/ai/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(defaultOpts),
      });
    });

    it('includes optional challengeId and challengeTitle in the request body', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          mergedCode: 'code',
          verified: true,
          verificationErrors: [],
          model: 'model',
          inputTokens: 10,
          outputTokens: 10,
          cost: 0,
        }),
      });

      const opts = {
        ...defaultOpts,
        challengeId: 'challenge-xyz',
        challengeTitle: 'My Challenge',
      };

      await callApplyModel(opts);

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.challengeId).toBe('challenge-xyz');
      expect(body.challengeTitle).toBe('My Challenge');
    });
  });

  // ---------------------------------------------------------------------------
  // Successful response
  // ---------------------------------------------------------------------------
  describe('successful response', () => {
    it('returns success with mergedCode and metadata', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          mergedCode: 'function solve() { return 42; }',
          verified: true,
          verificationErrors: [],
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.001,
        }),
      });

      const result = await callApplyModel(defaultOpts);

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.mergedCode).toBe('function solve() { return 42; }');
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(50);
      expect(result.cost).toBe(0.001);
      expect(result.error).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Verification failure
  // ---------------------------------------------------------------------------
  describe('verification failure', () => {
    it('returns failure when verified is false', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          mergedCode: 'corrupted output',
          verified: false,
          verificationErrors: ['Missing function declaration', 'Syntax error'],
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.002,
        }),
      });

      const result = await callApplyModel(defaultOpts);

      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.verificationErrors).toEqual(['Missing function declaration', 'Syntax error']);
      expect(result.error).toBe('Apply model produced corrupted output');
      expect(result.cost).toBe(0.002);
      expect(result.model).toBe('gpt-4o-mini');
    });
  });

  // ---------------------------------------------------------------------------
  // Empty / tiny result
  // ---------------------------------------------------------------------------
  describe('empty or tiny result', () => {
    it('returns failure when mergedCode is null', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          mergedCode: null,
          verified: true,
          verificationErrors: [],
          model: 'gpt-4o-mini',
          inputTokens: 10,
          outputTokens: 5,
          cost: 0,
        }),
      });

      const result = await callApplyModel(defaultOpts);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Apply model returned empty result');
    });

    it('returns failure when mergedCode is empty string', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          mergedCode: '',
          verified: true,
          verificationErrors: [],
          model: 'gpt-4o-mini',
          inputTokens: 10,
          outputTokens: 5,
          cost: 0,
        }),
      });

      const result = await callApplyModel(defaultOpts);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Apply model returned empty result');
    });

    it('returns failure when mergedCode trimmed is less than 10 chars', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          mergedCode: '  short  ',
          verified: true,
          verificationErrors: [],
          model: 'gpt-4o-mini',
          inputTokens: 10,
          outputTokens: 5,
          cost: 0,
        }),
      });

      const result = await callApplyModel(defaultOpts);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Apply model returned empty result');
    });

    it('succeeds when mergedCode trimmed is exactly 10 chars', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          mergedCode: '1234567890',
          verified: true,
          verificationErrors: [],
          model: 'gpt-4o-mini',
          inputTokens: 10,
          outputTokens: 10,
          cost: 0,
        }),
      });

      const result = await callApplyModel(defaultOpts);

      expect(result.success).toBe(true);
      expect(result.mergedCode).toBe('1234567890');
    });
  });

  // ---------------------------------------------------------------------------
  // HTTP error
  // ---------------------------------------------------------------------------
  describe('HTTP error', () => {
    it('returns error with message from response body', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid attempt ID' }),
      });

      const result = await callApplyModel(defaultOpts);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid attempt ID');
    });

    it('returns HTTP status code when body has no error field', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

      const result = await callApplyModel(defaultOpts);

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 500');
    });

    it('handles non-JSON error response gracefully', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('not JSON')),
      });

      const result = await callApplyModel(defaultOpts);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('returns HTTP status when error response has no error key', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Forbidden' }),
      });

      const result = await callApplyModel(defaultOpts);

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 403');
    });
  });

  // ---------------------------------------------------------------------------
  // Network failure
  // ---------------------------------------------------------------------------
  describe('network failure', () => {
    it('returns error for network Error instances', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed to fetch')
      );

      const result = await callApplyModel(defaultOpts);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch');
    });

    it('returns generic error for non-Error thrown values', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue('string error');

      const result = await callApplyModel(defaultOpts);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('returns generic error for null thrown value', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(null);

      const result = await callApplyModel(defaultOpts);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});
