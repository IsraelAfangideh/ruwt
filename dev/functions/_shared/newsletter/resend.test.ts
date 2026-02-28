import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmail } from './resend';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_ENV = { RESEND_API_KEY: 'test-resend-key-123' };

const baseParams = {
  to: 'alice@example.com',
  subject: 'Weekly Digest',
  html: '<p>Hello Alice</p>',
};

// ---------------------------------------------------------------------------
// sendEmail
// ---------------------------------------------------------------------------

describe('sendEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock crypto.randomUUID for deterministic tests
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });
  });

  // ----- Missing API key -----

  it('returns error when RESEND_API_KEY is missing', async () => {
    const result = await sendEmail({}, baseParams);
    expect(result).toEqual({ success: false, error: 'RESEND_API_KEY not configured' });
  });

  it('returns error when RESEND_API_KEY is undefined', async () => {
    const result = await sendEmail({ RESEND_API_KEY: undefined }, baseParams);
    expect(result).toEqual({ success: false, error: 'RESEND_API_KEY not configured' });
  });

  it('does not call fetch when API key is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await sendEmail({}, baseParams);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ----- Successful send -----

  it('returns success with email id on 200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'email-id-abc123' }),
    }));

    const result = await sendEmail(VALID_ENV, baseParams);

    expect(result).toEqual({ success: true, id: 'email-id-abc123' });
  });

  // ----- Request format verification -----

  it('sends correct URL, headers, and body to Resend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'id-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendEmail(VALID_ENV, {
      to: 'bob@example.com',
      subject: 'Test Subject',
      html: '<h1>Hi Bob</h1>',
      text: 'Hi Bob',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];

    // URL
    expect(url).toBe('https://api.resend.com/emails');

    // Headers
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer test-resend-key-123');
    expect(opts.headers['Content-Type']).toBe('application/json');

    // Body
    const body = JSON.parse(opts.body);
    expect(body.from).toBe('Israel Afangideh <israel@ruwt.dev>');
    expect(body.to).toEqual(['bob@example.com']);
    expect(body.subject).toBe('Test Subject');
    expect(body.html).toBe('<h1>Hi Bob</h1>');
    expect(body.text).toBe('Hi Bob');
    expect(body.headers['X-Entity-Ref-ID']).toBe('test-uuid-1234');
  });

  it('uses custom from address when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'id-2' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendEmail(VALID_ENV, {
      ...baseParams,
      from: 'Custom Sender <custom@ruwt.dev>',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from).toBe('Custom Sender <custom@ruwt.dev>');
  });

  it('uses default from address when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'id-3' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendEmail(VALID_ENV, baseParams);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from).toBe('Israel Afangideh <israel@ruwt.dev>');
  });

  it('wraps to address in an array', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'id-4' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendEmail(VALID_ENV, baseParams);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toEqual(['alice@example.com']);
    expect(Array.isArray(body.to)).toBe(true);
  });

  it('includes X-Entity-Ref-ID header in request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'id-5' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendEmail(VALID_ENV, baseParams);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.headers).toBeDefined();
    expect(body.headers['X-Entity-Ref-ID']).toBe('test-uuid-1234');
  });

  it('omits text field when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'id-6' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendEmail(VALID_ENV, {
      to: 'bob@example.com',
      subject: 'Subject',
      html: '<p>Hi</p>',
      // text not provided
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toBeUndefined();
  });

  // ----- API errors -----

  it('returns error with status and body when API responds with non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => '{"statusCode":422,"message":"Validation failed","name":"validation_error"}',
    }));

    const result = await sendEmail(VALID_ENV, baseParams);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Resend API 422: {"statusCode":422,"message":"Validation failed","name":"validation_error"}');
  });

  it('returns error on 401 unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }));

    const result = await sendEmail(VALID_ENV, baseParams);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Resend API 401: Unauthorized');
  });

  it('returns error on 429 rate limit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    }));

    const result = await sendEmail(VALID_ENV, baseParams);

    expect(result.success).toBe(false);
    expect(result.error).toContain('429');
    expect(result.error).toContain('Rate limit exceeded');
  });

  it('returns error on 500 server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }));

    const result = await sendEmail(VALID_ENV, baseParams);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Resend API 500: Internal Server Error');
  });

  // ----- Network failure -----

  it('propagates network errors (fetch throws)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('DNS resolution failed')));

    await expect(sendEmail(VALID_ENV, baseParams)).rejects.toThrow('DNS resolution failed');
  });

  it('propagates timeout errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Request timed out')));

    await expect(sendEmail(VALID_ENV, baseParams)).rejects.toThrow('Request timed out');
  });
});
