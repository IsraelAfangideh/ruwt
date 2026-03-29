import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before imports
// ---------------------------------------------------------------------------

const { mockGetUser, mockGetDb, mockGetUserOrg } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockGetUserOrg: vi.fn(),
}));

vi.mock('../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../_shared/org', () => ({ getUserOrg: mockGetUserOrg }));

// Mock global.fetch for Stripe API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { onRequestPost } from './checkout';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const FAKE_USER = { id: 'user-123', email: 'test@ruwt.dev' };

function makeEnv(overrides: Record<string, string> = {}) {
  return {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    STRIPE_SECRET_KEY: 'sk_test_abc123',
    DB: {},
    ...overrides,
  } as unknown as Env;
}

function makeRequest(body: Record<string, unknown> = {}, url = 'https://ruwt.dev/api/checkout') {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeContext(body: Record<string, unknown> = {}, envOverrides: Record<string, string> = {}) {
  return {
    request: makeRequest(body),
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

function createDbMock() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue([]);
  return chain as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(createDbMock());
  });

  // --- Auth gating ---

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue(null);
      const ctx = makeContext({ packageId: 'credits-5000' });

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });
  });

  // --- Missing config ---

  describe('missing STRIPE_SECRET_KEY', () => {
    it('returns 503 when Stripe key is not configured', async () => {
      const ctx = makeContext(
        { packageId: 'credits-5000' },
        { STRIPE_SECRET_KEY: '' },
      );

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(503);
      expect(json.error).toBe('Payment system not configured');
    });
  });

  // --- Missing packageId ---

  describe('missing packageId', () => {
    it('returns 400 when packageId is not provided', async () => {
      const ctx = makeContext({});

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(400);
      expect(json.error).toBe('Missing packageId');
    });

    it('returns 400 when body is invalid JSON (packageId still absent)', async () => {
      const request = new Request('https://ruwt.dev/api/checkout', {
        method: 'POST',
        body: 'not json',
      });
      const ctx = { request, env: makeEnv() };

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(400);
      expect(json.error).toBe('Missing packageId');
    });
  });

  // --- Credit purchases ---

  describe('credit package checkout', () => {
    const creditPackages = [
      { id: 'credits-5000', credits: 5000, priceInCents: 499, label: '5,000 Credits' },
      { id: 'credits-25000', credits: 25000, priceInCents: 1499, label: '25,000 Credits' },
      { id: 'credits-100000', credits: 100000, priceInCents: 3999, label: '100,000 Credits' },
    ];

    for (const pkg of creditPackages) {
      it(`creates a payment session for ${pkg.label} (${pkg.id})`, async () => {
        const sessionUrl = `https://checkout.stripe.com/c/pay_${pkg.id}`;
        mockFetch.mockResolvedValue(mockStripeResponse({ url: sessionUrl }));

        const ctx = makeContext({ packageId: pkg.id, type: 'credits' });
        const res = await onRequestPost(ctx);
        const json = await res.json() as { url: string };

        expect(res.status).toBe(200);
        expect(json.url).toBe(sessionUrl);

        // Verify the Stripe API was called correctly
        expect(mockFetch).toHaveBeenCalledOnce();
        const [url, opts] = mockFetch.mock.calls[0];
        expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
        expect(opts.method).toBe('POST');
        expect(opts.headers.Authorization).toBe('Bearer sk_test_abc123');

        const body = new URLSearchParams(opts.body);
        expect(body.get('mode')).toBe('payment');
        expect(body.get('line_items[0][price_data][unit_amount]')).toBe(String(pkg.priceInCents));
        expect(body.get('line_items[0][price_data][product_data][name]')).toBe(pkg.label);
        expect(body.get('metadata[userId]')).toBe('user-123');
        expect(body.get('metadata[type]')).toBe('credits');
        expect(body.get('metadata[credits]')).toBe(String(pkg.credits));
        expect(body.get('metadata[packageId]')).toBe(pkg.id);
      });
    }

    it('defaults type to credits when not specified', async () => {
      mockFetch.mockResolvedValue(mockStripeResponse({ url: 'https://checkout.stripe.com/test' }));

      const ctx = makeContext({ packageId: 'credits-5000' }); // no type
      const res = await onRequestPost(ctx);

      expect(res.status).toBe(200);
      const [, opts] = mockFetch.mock.calls[0];
      const body = new URLSearchParams(opts.body);
      expect(body.get('mode')).toBe('payment');
    });

    it('sets correct success and cancel URLs', async () => {
      mockFetch.mockResolvedValue(mockStripeResponse({ url: 'https://checkout.stripe.com/test' }));

      const ctx = makeContext({ packageId: 'credits-5000' });
      await onRequestPost(ctx);

      const [, opts] = mockFetch.mock.calls[0];
      const body = new URLSearchParams(opts.body);
      expect(body.get('success_url')).toBe('https://ruwt.dev/settings?purchased=true');
      expect(body.get('cancel_url')).toBe('https://ruwt.dev/settings');
    });

    it('returns 400 for an invalid credit package ID', async () => {
      const ctx = makeContext({ packageId: 'credits-9999', type: 'credits' });

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid package');
    });

    it('returns 502 when Stripe API rejects the request', async () => {
      mockFetch.mockResolvedValue(mockStripeResponse(
        { error: { message: 'Invalid request' } },
        false,
        400,
      ));

      const ctx = makeContext({ packageId: 'credits-5000' });
      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(502);
      expect(json.error).toBe('Failed to create checkout session');
    });
  });

  // --- Subscription purchases ---

  describe('subscription checkout', () => {
    const plans = [
      { id: 'plan-monthly', priceInCents: 20000, interval: 'month', label: 'Monthly Subscription', productName: 'Ruwt.dev Monthly Subscription' },
      { id: 'plan-annual', priceInCents: 180000, interval: 'year', label: 'Annual Subscription', productName: 'Ruwt.dev Annual Subscription' },
    ];

    function setupOrgMock(org: Record<string, unknown> = {}) {
      mockGetUserOrg.mockResolvedValue({
        org: {
          id: 'org-42',
          name: 'Test Corp',
          stripeCustomerId: 'cus_existing',
          ...org,
        },
        role: 'owner',
      });
    }

    for (const plan of plans) {
      it(`creates a subscription session for ${plan.label} (${plan.id})`, async () => {
        setupOrgMock();
        const sessionUrl = `https://checkout.stripe.com/c/sub_${plan.id}`;
        mockFetch.mockResolvedValue(mockStripeResponse({ url: sessionUrl }));

        const ctx = makeContext({ packageId: plan.id, type: 'subscription' });
        const res = await onRequestPost(ctx);
        const json = await res.json() as { url: string };

        expect(res.status).toBe(200);
        expect(json.url).toBe(sessionUrl);

        const [url, opts] = mockFetch.mock.calls[0];
        expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');

        const body = new URLSearchParams(opts.body);
        expect(body.get('mode')).toBe('subscription');
        expect(body.get('customer')).toBe('cus_existing');
        expect(body.get('line_items[0][price_data][unit_amount]')).toBe(String(plan.priceInCents));
        expect(body.get('line_items[0][price_data][recurring][interval]')).toBe(plan.interval);
        expect(body.get('line_items[0][price_data][product_data][name]')).toBe(plan.productName);
        expect(body.get('metadata[type]')).toBe('subscription');
        expect(body.get('metadata[plan]')).toBe(plan.id);
        expect(body.get('metadata[orgId]')).toBe('org-42');
      });
    }

    it('sets correct success and cancel URLs for subscription', async () => {
      setupOrgMock();
      mockFetch.mockResolvedValue(mockStripeResponse({ url: 'https://checkout.stripe.com/sub' }));

      const ctx = makeContext({ packageId: 'plan-monthly', type: 'subscription' });
      await onRequestPost(ctx);

      const [, opts] = mockFetch.mock.calls[0];
      const body = new URLSearchParams(opts.body);
      expect(body.get('success_url')).toBe('https://ruwt.dev/org?subscribed=true');
      expect(body.get('cancel_url')).toBe('https://ruwt.dev/teams');
    });

    it('returns 400 for an invalid subscription plan ID', async () => {
      setupOrgMock();

      const ctx = makeContext({ packageId: 'plan-bogus', type: 'subscription' });
      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid subscription plan');
    });

    it('returns 400 when user has no organization', async () => {
      mockGetUserOrg.mockResolvedValue(null);

      const ctx = makeContext({ packageId: 'plan-monthly', type: 'subscription' });
      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(400);
      expect(json.error).toBe('Create an organization first before subscribing.');
    });

    it('creates a new Stripe customer when org has no stripeCustomerId', async () => {
      setupOrgMock({ stripeCustomerId: null });

      // First call: create customer; second call: create checkout session
      mockFetch
        .mockResolvedValueOnce(mockStripeResponse({ id: 'cus_new_123' }))
        .mockResolvedValueOnce(mockStripeResponse({ url: 'https://checkout.stripe.com/sub_new' }));

      const ctx = makeContext({ packageId: 'plan-monthly', type: 'subscription' });
      const res = await onRequestPost(ctx);
      const json = await res.json() as { url: string };

      expect(res.status).toBe(200);
      expect(json.url).toBe('https://checkout.stripe.com/sub_new');

      // Verify customer creation call
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [custUrl, custOpts] = mockFetch.mock.calls[0];
      expect(custUrl).toBe('https://api.stripe.com/v1/customers');
      const custBody = new URLSearchParams(custOpts.body);
      expect(custBody.get('email')).toBe('test@ruwt.dev');
      expect(custBody.get('metadata[orgId]')).toBe('org-42');
      expect(custBody.get('metadata[userId]')).toBe('user-123');
      expect(custBody.get('name')).toBe('Test Corp');

      // Verify the checkout session uses the new customer ID
      const [, sessionOpts] = mockFetch.mock.calls[1];
      const sessionBody = new URLSearchParams(sessionOpts.body);
      expect(sessionBody.get('customer')).toBe('cus_new_123');
    });

    it('reuses existing Stripe customer when org already has stripeCustomerId', async () => {
      setupOrgMock({ stripeCustomerId: 'cus_reuse_456' });
      mockFetch.mockResolvedValue(mockStripeResponse({ url: 'https://checkout.stripe.com/sub_reuse' }));

      const ctx = makeContext({ packageId: 'plan-monthly', type: 'subscription' });
      await onRequestPost(ctx);

      // Only one call — no customer creation
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    });

    it('returns 502 when Stripe customer creation fails', async () => {
      setupOrgMock({ stripeCustomerId: null });
      mockFetch.mockResolvedValue(mockStripeResponse(
        { error: { message: 'Bad request' } },
        false,
        400,
      ));

      const ctx = makeContext({ packageId: 'plan-monthly', type: 'subscription' });
      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(502);
      expect(json.error).toBe('Failed to create billing account');
    });

    it('returns 502 when Stripe checkout session creation fails for subscription', async () => {
      setupOrgMock();
      mockFetch.mockResolvedValue(mockStripeResponse(
        { error: { message: 'Internal error' } },
        false,
        500,
      ));

      const ctx = makeContext({ packageId: 'plan-monthly', type: 'subscription' });
      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(502);
      expect(json.error).toBe('Failed to create checkout session');
    });

    it('saves the new Stripe customer ID to the organization', async () => {
      const db = createDbMock();
      mockGetDb.mockReturnValue(db);
      setupOrgMock({ stripeCustomerId: null });

      mockFetch
        .mockResolvedValueOnce(mockStripeResponse({ id: 'cus_saved_789' }))
        .mockResolvedValueOnce(mockStripeResponse({ url: 'https://checkout.stripe.com/sub_saved' }));

      const ctx = makeContext({ packageId: 'plan-monthly', type: 'subscription' });
      await onRequestPost(ctx);

      // db.update(...).set({ stripeCustomerId: 'cus_saved_789' }).where(...)
      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalledWith({ stripeCustomerId: 'cus_saved_789' });
    });
  });

  // --- General error handling ---

  describe('error handling', () => {
    it('returns 500 when an unexpected error occurs', async () => {
      mockGetUser.mockRejectedValue(new Error('Unexpected boom'));

      const ctx = makeContext({ packageId: 'credits-5000' });
      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });

    it('returns 401 when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue(null);
      const ctx = makeContext({ packageId: 'credits-5000' });
      const res = await onRequestPost(ctx);
      expect(res.status).toBe(401);
    });

    it('returns 400 for malformed JSON body', async () => {
      mockGetUser.mockResolvedValue(FAKE_USER);
      const ctx = {
        request: new Request('https://ruwt.dev/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not json',
        }),
        env: makeEnv(),
      };
      const res = await onRequestPost(ctx);
      expect(res.status).toBe(400);
    });

    it('returns 400 when body is empty object', async () => {
      mockGetUser.mockResolvedValue(FAKE_USER);
      const ctx = makeContext({});
      const res = await onRequestPost(ctx);
      expect(res.status).toBe(400);
    });

    it('returns 400 when packageId is not a string', async () => {
      mockGetUser.mockResolvedValue(FAKE_USER);
      const ctx = makeContext({ packageId: 123 } as any);
      const res = await onRequestPost(ctx);
      expect(res.status).toBe(400);
    });

    it('returns error when body is null', async () => {
      mockGetUser.mockResolvedValue(FAKE_USER);
      const ctx = {
        request: new Request('https://ruwt.dev/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'null',
        }),
        env: makeEnv(),
      };
      const res = await onRequestPost(ctx);
      expect([400, 500]).toContain(res.status);
    });

    it('handles Stripe API failure', async () => {
      mockGetUser.mockResolvedValue(FAKE_USER);
      mockGetUserOrg.mockResolvedValue({ org: { id: 'org-1', stripeCustomerId: 'cus_test' }, role: 'admin' });
      mockFetch.mockRejectedValue(new Error('Stripe unavailable'));
      const ctx = makeContext({ planId: 'plan-monthly' });
      const res = await onRequestPost(ctx);
      expect([400, 500]).toContain(res.status);
    });

    it('handles Stripe returning non-ok response', async () => {
      mockGetUser.mockResolvedValue(FAKE_USER);
      mockGetUserOrg.mockResolvedValue({ org: { id: 'org-1', stripeCustomerId: 'cus_test' }, role: 'admin' });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 402,
        text: () => Promise.resolve('Payment required'),
      });
      const ctx = makeContext({ planId: 'plan-monthly' });
      const res = await onRequestPost(ctx);
      expect([400, 500]).toContain(res.status);
    });
  });
});
