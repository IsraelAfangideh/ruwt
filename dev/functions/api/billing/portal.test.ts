import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGetUser, mockGetDb, mockGetUserOrg } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockGetUserOrg: vi.fn(),
}));

vi.mock('../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../../_shared/org', () => ({ getUserOrg: mockGetUserOrg }));

// Mock global.fetch for Stripe API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { onRequestPost } from './portal';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const FAKE_USER = { id: 'user-portal', email: 'portal@ruwt.dev' };

function makeEnv(overrides: Record<string, string> = {}) {
  return {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    STRIPE_SECRET_KEY: 'sk_test_portal_key',
    DB: {},
    ...overrides,
  } as unknown as Env;
}

function makeRequest(url = 'https://ruwt.dev/api/billing/portal') {
  return new Request(url, { method: 'POST' });
}

function makeContext(envOverrides: Record<string, string> = {}) {
  return {
    request: makeRequest(),
    env: makeEnv(envOverrides),
  };
}

function mockStripeResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

function setupOrgMock(orgOverrides: Record<string, unknown> = {}) {
  mockGetUserOrg.mockResolvedValue({
    org: {
      id: 'org-portal',
      name: 'Portal Corp',
      stripeCustomerId: 'cus_portal_123',
      ...orgOverrides,
    },
    role: 'owner',
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/billing/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
  });

  // --- Auth gating ---

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue(null);
      const ctx = makeContext();

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });
  });

  // --- Missing config ---

  describe('missing STRIPE_SECRET_KEY', () => {
    it('returns 503 when Stripe key is not configured', async () => {
      const ctx = makeContext({ STRIPE_SECRET_KEY: '' });

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(503);
      expect(json.error).toBe('Billing not configured');
    });
  });

  // --- No billing account ---

  describe('no billing account', () => {
    it('returns 404 when user has no org', async () => {
      mockGetUserOrg.mockResolvedValue(null);
      const ctx = makeContext();

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(404);
      expect(json.error).toBe('No billing account found');
    });

    it('returns 404 when org has no stripeCustomerId', async () => {
      setupOrgMock({ stripeCustomerId: null });
      const ctx = makeContext();

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(404);
      expect(json.error).toBe('No billing account found');
    });
  });

  // --- Successful portal session creation ---

  describe('successful portal session', () => {
    it('creates a billing portal session and returns the URL', async () => {
      setupOrgMock();
      const portalUrl = 'https://billing.stripe.com/p/session/test_portal';
      mockFetch.mockResolvedValue(mockStripeResponse({ url: portalUrl }));

      const ctx = makeContext();
      const res = await onRequestPost(ctx);
      const json = await res.json() as { url: string };

      expect(res.status).toBe(200);
      expect(json.url).toBe(portalUrl);
    });

    it('sends correct parameters to Stripe billing portal API', async () => {
      setupOrgMock({ stripeCustomerId: 'cus_verified_789' });
      mockFetch.mockResolvedValue(mockStripeResponse({ url: 'https://billing.stripe.com/test' }));

      const ctx = makeContext();
      await onRequestPost(ctx);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.stripe.com/v1/billing_portal/sessions');
      expect(opts.method).toBe('POST');
      expect(opts.headers.Authorization).toBe('Bearer sk_test_portal_key');
      expect(opts.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

      const body = new URLSearchParams(opts.body);
      expect(body.get('customer')).toBe('cus_verified_789');
      expect(body.get('return_url')).toBe('https://ruwt.dev/org');
    });

    it('derives return_url from request origin', async () => {
      setupOrgMock();
      mockFetch.mockResolvedValue(mockStripeResponse({ url: 'https://billing.stripe.com/local' }));

      const request = new Request('http://localhost:5173/api/billing/portal', { method: 'POST' });
      const ctx = { request, env: makeEnv() };
      await onRequestPost(ctx);

      const [, opts] = mockFetch.mock.calls[0];
      const body = new URLSearchParams(opts.body);
      expect(body.get('return_url')).toBe('http://localhost:5173/org');
    });
  });

  // --- Stripe API failure ---

  describe('Stripe API failure', () => {
    it('returns 502 when Stripe portal API returns an error', async () => {
      setupOrgMock();
      mockFetch.mockResolvedValue(mockStripeResponse(
        { error: { message: 'Portal not configured' } },
        false,
        400,
      ));

      const ctx = makeContext();
      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(502);
      expect(json.error).toBe('Failed to create portal session');
    });
  });

  // --- General error handling ---

  describe('error handling', () => {
    it('returns 500 when an unexpected error is thrown', async () => {
      mockGetUser.mockRejectedValue(new Error('Unexpected failure'));

      const ctx = makeContext();
      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});
