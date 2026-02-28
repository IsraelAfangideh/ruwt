import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../_shared/newsletter/resend', () => ({ sendEmail: mockSendEmail }));

import { onRequestPost } from './demo-request';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'u',
    VITE_SUPABASE_ANON_KEY: 'k',
    ERROR_ALERT_EMAIL: 'admin@ruwt.dev',
    ...overrides,
  } as Env;
}

function makeCtx(body: unknown, env?: Env) {
  return {
    request: new Request('https://ruwt.dev/api/demo-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: env ?? makeEnv(),
  };
}

const validBody = {
  name: 'Jane Doe',
  email: 'jane@acme.com',
  company: 'Acme Inc',
};

describe('POST /api/demo-request (public)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 400 when name is missing', async () => {
    const res = await onRequestPost(makeCtx({ email: 'a@b.com', company: 'Co' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid request');
  });

  it('returns 400 when email is invalid', async () => {
    const res = await onRequestPost(makeCtx({ name: 'X', email: 'nope', company: 'Co' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when company is missing', async () => {
    const res = await onRequestPost(makeCtx({ name: 'X', email: 'a@b.com' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const ctx = {
      request: new Request('https://ruwt.dev/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
      env: makeEnv(),
    };
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
  });

  it('sends internal alert and confirmation email on happy path', async () => {
    mockSendEmail.mockResolvedValue({ success: true });
    const res = await onRequestPost(makeCtx(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    // Internal notification to admin
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(mockSendEmail.mock.calls[0][1].to).toBe('admin@ruwt.dev');
    expect(mockSendEmail.mock.calls[0][1].subject).toContain('Demo Request');
    // Confirmation email to requester
    expect(mockSendEmail.mock.calls[1][1].to).toBe('jane@acme.com');
    expect(mockSendEmail.mock.calls[1][1].subject).toContain('demo request');
  });

  it('skips alert email when ERROR_ALERT_EMAIL is not set', async () => {
    mockSendEmail.mockResolvedValue({ success: true });
    const res = await onRequestPost(makeCtx(validBody, makeEnv({ ERROR_ALERT_EMAIL: undefined })));
    expect(res.status).toBe(200);
    // Only confirmation email sent
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][1].to).toBe('jane@acme.com');
  });

  it('accepts optional teamSize and message', async () => {
    mockSendEmail.mockResolvedValue({ success: true });
    const res = await onRequestPost(makeCtx({
      ...validBody,
      teamSize: '10-50',
      message: 'Interested in enterprise plan',
    }));
    expect(res.status).toBe(200);
    const alertHtml = mockSendEmail.mock.calls[0][1].html;
    expect(alertHtml).toContain('10-50');
    expect(alertHtml).toContain('Interested in enterprise plan');
  });

  it('escapes HTML in user input', async () => {
    mockSendEmail.mockResolvedValue({ success: true });
    await onRequestPost(makeCtx({
      name: '<script>alert("xss")</script>',
      email: 'safe@safe.com',
      company: 'Safe & Co',
    }));
    const alertHtml = mockSendEmail.mock.calls[0][1].html;
    expect(alertHtml).not.toContain('<script>');
    expect(alertHtml).toContain('&lt;script&gt;');
    expect(alertHtml).toContain('Safe &amp; Co');
  });

  it('returns 500 on unexpected error', async () => {
    mockSendEmail.mockRejectedValue(new Error('mail fail'));
    const res = await onRequestPost(makeCtx(validBody));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });
});
