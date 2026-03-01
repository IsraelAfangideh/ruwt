import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));

import { onRequestPost } from './stripe';

// ---------------------------------------------------------------------------
// Crypto helper — produce a real HMAC-SHA256 signature for testing
// ---------------------------------------------------------------------------

async function signPayload(payload: string, secret: string, timestamp: string): Promise<string> {
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signedPayload),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = 'whsec_test_secret_123';
const TIMESTAMP = String(Math.floor(Date.now() / 1000));

function makeEnv(overrides: Record<string, string> = {}) {
  return {
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    DB: {},
    ...overrides,
  } as unknown as Env;
}

async function makeSignedRequest(
  event: Record<string, unknown>,
  secret = WEBHOOK_SECRET,
  timestamp = TIMESTAMP,
): Promise<Request> {
  const body = JSON.stringify(event);
  const hex = await signPayload(body, secret, timestamp);
  return new Request('https://ruwt.dev/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'stripe-signature': `t=${timestamp},v1=${hex}`,
      'Content-Type': 'application/json',
    },
    body,
  });
}

function makeEvent(type: string, data: Record<string, unknown>) {
  return { type, data: { object: data } };
}

// ---------------------------------------------------------------------------
// DB mock that tracks insert/update/select chain calls
// ---------------------------------------------------------------------------

interface DbMockOptions {
  selectResults?: unknown[][];
}

function createDbMock(opts: DbMockOptions = {}) {
  let selectCallIndex = 0;
  const selectResults = opts.selectResults ?? [[]];

  const db: Record<string, ReturnType<typeof vi.fn>> = {};

  // Insert chain: insert(...).values(...)
  const insertChain: Record<string, ReturnType<typeof vi.fn>> = {};
  insertChain.values = vi.fn().mockResolvedValue(undefined);
  db.insert = vi.fn().mockReturnValue(insertChain);

  // Update chain: update(...).set(...).where(...)
  const updateChain: Record<string, ReturnType<typeof vi.fn>> = {};
  updateChain.set = vi.fn().mockReturnValue(updateChain);
  updateChain.where = vi.fn().mockResolvedValue(undefined);
  db.update = vi.fn().mockReturnValue(updateChain);

  // Select chain: select(...).from(...).where(...).limit(...)
  const selectChain: Record<string, ReturnType<typeof vi.fn>> = {};
  selectChain.select = vi.fn().mockReturnValue(selectChain);
  selectChain.from = vi.fn().mockReturnValue(selectChain);
  selectChain.where = vi.fn().mockReturnValue(selectChain);
  selectChain.limit = vi.fn().mockImplementation(() => {
    const result = selectResults[selectCallIndex] ?? [];
    selectCallIndex++;
    return Promise.resolve(result);
  });
  db.select = selectChain.select;

  return {
    db: db as any,
    insertValues: insertChain.values,
    insertFn: db.insert,
    updateFn: db.update,
    updateSet: updateChain.set,
    updateWhere: updateChain.where,
  };
}

// Stub crypto.randomUUID for deterministic IDs in tests
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  ...crypto,
  randomUUID: () => `uuid-${++uuidCounter}`,
  subtle: crypto.subtle,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  // --- Signature verification ---

  describe('signature verification', () => {
    it('returns 400 when stripe-signature header is missing', async () => {
      const request = new Request('https://ruwt.dev/api/webhooks/stripe', {
        method: 'POST',
        body: '{}',
      });
      const ctx = { request, env: makeEnv() };

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(400);
      expect(json.error).toBe('Missing signature');
    });

    it('returns 500 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
      const request = new Request('https://ruwt.dev/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 't=123,v1=abc' },
        body: '{}',
      });
      const ctx = { request, env: makeEnv({ STRIPE_WEBHOOK_SECRET: '' }) };

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(500);
      expect(json.error).toBe('Webhook not configured');
    });

    it('returns 400 when signature is invalid (wrong secret)', async () => {
      const event = makeEvent('test.event', {});
      const request = await makeSignedRequest(event, 'wrong_secret');
      const ctx = { request, env: makeEnv() };

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid signature');
    });

    it('returns 400 when signature header has no v1 component', async () => {
      const request = new Request('https://ruwt.dev/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 't=123' },
        body: '{}',
      });
      const ctx = { request, env: makeEnv() };

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid signature');
    });

    it('returns 400 when signature header has no timestamp', async () => {
      const request = new Request('https://ruwt.dev/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'v1=abc123' },
        body: '{}',
      });
      const ctx = { request, env: makeEnv() };

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid signature');
    });

    it('returns 400 when webhook timestamp is stale (replay protection)', async () => {
      const staleTimestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 min ago
      const request = await makeSignedRequest(
        makeEvent('checkout.session.completed', { payment_status: 'paid', metadata: { userId: 'u1', credits: '100' } }),
        WEBHOOK_SECRET,
        staleTimestamp,
      );
      const ctx = { request, env: makeEnv() };

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(400);
      expect(json.error).toBe('Webhook timestamp too old');
    });

    it('returns 400 when body is not valid JSON (after signature passes)', async () => {
      // Sign the non-JSON body with the correct secret
      const body = 'this is not json';
      const hex = await signPayload(body, WEBHOOK_SECRET, TIMESTAMP);
      const request = new Request('https://ruwt.dev/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': `t=${TIMESTAMP},v1=${hex}`,
        },
        body,
      });
      const ctx = { request, env: makeEnv() };

      const res = await onRequestPost(ctx);
      const json = await res.json() as { error: string };

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid JSON');
    });

    it('accepts a correctly signed payload', async () => {
      const { db } = createDbMock();
      mockGetDb.mockReturnValue(db);

      const event = makeEvent('unknown.event.type', {});
      const request = await makeSignedRequest(event);
      const ctx = { request, env: makeEnv() };

      const res = await onRequestPost(ctx);
      const json = await res.json() as { received: boolean };

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);
    });
  });

  // --- checkout.session.completed: credit fulfillment ---

  describe('checkout.session.completed — credit purchase', () => {
    it('adds credits to user profile and inserts transaction', async () => {
      const mock = createDbMock({ selectResults: [[]] }); // no existing transaction
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('checkout.session.completed', {
        payment_status: 'paid',
        id: 'cs_test_credit_session',
        metadata: {
          userId: 'user-abc',
          type: 'credits',
          credits: '25000',
          packageId: 'credits-25000',
        },
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });
      const json = await res.json() as { received: boolean };

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);

      // Transaction inserted
      expect(mock.insertFn).toHaveBeenCalled();
      expect(mock.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-abc',
          type: 'purchase',
          amount: 25000,
          stripeId: 'cs_test_credit_session',
        }),
      );

      // Profile updated (credits incremented)
      expect(mock.updateFn).toHaveBeenCalled();
    });

    it('returns 400 when credit amount is zero', async () => {
      const mock = createDbMock({ selectResults: [[]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('checkout.session.completed', {
        payment_status: 'paid',
        id: 'cs_zero',
        metadata: { userId: 'user-abc', type: 'credits', credits: '0' },
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });
      const json = await res.json() as { error: string };

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid credits');
    });

    it('returns 400 when credit amount is negative', async () => {
      const mock = createDbMock({ selectResults: [[]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('checkout.session.completed', {
        payment_status: 'paid',
        id: 'cs_negative',
        metadata: { userId: 'user-abc', type: 'credits', credits: '-5' },
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });
      const json = await res.json() as { error: string };

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid credits');
    });

    it('returns 400 when credit amount is NaN', async () => {
      const mock = createDbMock({ selectResults: [[]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('checkout.session.completed', {
        payment_status: 'paid',
        id: 'cs_nan',
        metadata: { userId: 'user-abc', type: 'credits', credits: 'notanumber' },
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });
      const json = await res.json() as { error: string };

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid credits');
    });
  });

  // --- checkout.session.completed: subscription fulfillment ---

  describe('checkout.session.completed — subscription', () => {
    it('updates org with subscription details for monthly plan', async () => {
      const mock = createDbMock({ selectResults: [[]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('checkout.session.completed', {
        payment_status: 'paid',
        id: 'cs_sub_monthly',
        subscription: 'sub_monthly_123',
        customer: 'cus_org_456',
        metadata: {
          userId: 'user-sub',
          type: 'subscription',
          orgId: 'org-99',
          plan: 'plan-monthly',
        },
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });

      expect(res.status).toBe(200);

      // Org updated with subscription info
      expect(mock.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: 'sub_monthly_123',
          stripeCustomerId: 'cus_org_456',
          subscriptionStatus: 'active',
          subscriptionPlan: 'monthly',
        }),
      );

      // Transaction logged
      expect(mock.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-sub',
          type: 'subscription_start',
          amount: 0,
          stripeId: 'cs_sub_monthly',
        }),
      );
    });

    it('updates org with subscription details for annual plan', async () => {
      const mock = createDbMock({ selectResults: [[]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('checkout.session.completed', {
        payment_status: 'paid',
        id: 'cs_sub_annual',
        subscription: 'sub_annual_789',
        customer: 'cus_org_annual',
        metadata: {
          userId: 'user-annual',
          type: 'subscription',
          orgId: 'org-annual',
          plan: 'plan-annual',
        },
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });

      expect(res.status).toBe(200);
      expect(mock.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionPlan: 'annual',
        }),
      );
    });

    it('defaults to monthly plan when plan metadata is missing', async () => {
      const mock = createDbMock({ selectResults: [[]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('checkout.session.completed', {
        payment_status: 'paid',
        id: 'cs_sub_default',
        subscription: 'sub_default',
        customer: 'cus_default',
        metadata: {
          userId: 'user-default',
          type: 'subscription',
          orgId: 'org-default',
          // no plan field
        },
      });

      const request = await makeSignedRequest(event);
      await onRequestPost({ request, env: makeEnv() });

      expect(mock.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionPlan: 'monthly',
        }),
      );
    });
  });

  // --- checkout.session.completed: assessment purchase (legacy) ---

  describe('checkout.session.completed — assessment purchase (legacy)', () => {
    it('adds assessment credits and upgrades account type to team', async () => {
      const mock = createDbMock({ selectResults: [[]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('checkout.session.completed', {
        payment_status: 'paid',
        id: 'cs_assess',
        metadata: {
          userId: 'user-assess',
          type: 'assessment',
          assessments: '10',
        },
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });

      expect(res.status).toBe(200);

      expect(mock.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-assess',
          type: 'assessment_purchase',
          amount: 10,
          stripeId: 'cs_assess',
        }),
      );
    });

    it('returns 400 when assessment credits is zero', async () => {
      const mock = createDbMock({ selectResults: [[]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('checkout.session.completed', {
        payment_status: 'paid',
        id: 'cs_assess_zero',
        metadata: {
          userId: 'user-bad',
          type: 'assessment',
          assessments: '0',
        },
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });

      expect(res.status).toBe(400);
      expect((await res.json() as { error: string }).error).toBe('Invalid assessment credits');
    });
  });

  // --- Idempotency ---

  describe('idempotency', () => {
    it('skips processing when stripeId already exists in transactions', async () => {
      // Return an existing transaction from the idempotency select
      const mock = createDbMock({ selectResults: [[{ id: 'txn-existing' }]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('checkout.session.completed', {
        payment_status: 'paid',
        id: 'cs_duplicate_123',
        metadata: { userId: 'user-abc', type: 'credits', credits: '5000' },
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });
      const json = await res.json() as { received: boolean; note: string };

      expect(res.status).toBe(200);
      expect(json.note).toBe('already processed');

      // No insert or update should have been called
      expect(mock.insertFn).not.toHaveBeenCalled();
    });
  });

  // --- Payment not paid ---

  describe('checkout.session.completed — non-paid or missing userId', () => {
    it('skips fulfillment when payment_status is not paid', async () => {
      const mock = createDbMock();
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('checkout.session.completed', {
        payment_status: 'unpaid',
        id: 'cs_unpaid',
        metadata: { userId: 'user-abc', type: 'credits', credits: '5000' },
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });
      const json = await res.json() as { received: boolean };

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);
      expect(mock.insertFn).not.toHaveBeenCalled();
    });

    it('skips fulfillment when userId is missing from metadata', async () => {
      const mock = createDbMock();
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('checkout.session.completed', {
        payment_status: 'paid',
        id: 'cs_no_user',
        metadata: { type: 'credits', credits: '5000' },
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });

      expect(res.status).toBe(200);
      expect(mock.insertFn).not.toHaveBeenCalled();
    });
  });

  // --- customer.subscription.updated ---

  describe('customer.subscription.updated', () => {
    it('sets status to canceled when cancel_at_period_end is true', async () => {
      const mock = createDbMock({ selectResults: [[{ id: 'org-sub' }]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_update_1',
        status: 'active',
        cancel_at_period_end: true,
        current_period_end: 1700100000,
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });

      expect(res.status).toBe(200);
      expect(mock.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: 'canceled',
          subscriptionEndsAt: new Date(1700100000 * 1000).toISOString(),
        }),
      );
    });

    it('sets status to active when subscription is active and not canceling', async () => {
      const mock = createDbMock({ selectResults: [[{ id: 'org-sub' }]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_update_2',
        status: 'active',
        cancel_at_period_end: false,
        current_period_end: 1700200000,
      });

      const request = await makeSignedRequest(event);
      await onRequestPost({ request, env: makeEnv() });

      expect(mock.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionStatus: 'active' }),
      );
    });

    it('sets status to past_due when Stripe status is past_due', async () => {
      const mock = createDbMock({ selectResults: [[{ id: 'org-sub' }]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_update_3',
        status: 'past_due',
        cancel_at_period_end: false,
      });

      const request = await makeSignedRequest(event);
      await onRequestPost({ request, env: makeEnv() });

      expect(mock.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionStatus: 'past_due' }),
      );
    });

    it('passes through unknown Stripe statuses (e.g. trialing)', async () => {
      const mock = createDbMock({ selectResults: [[{ id: 'org-sub' }]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_update_4',
        status: 'trialing',
        cancel_at_period_end: false,
      });

      const request = await makeSignedRequest(event);
      await onRequestPost({ request, env: makeEnv() });

      expect(mock.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionStatus: 'trialing' }),
      );
    });

    it('uses "none" when status is undefined', async () => {
      const mock = createDbMock({ selectResults: [[{ id: 'org-sub' }]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_update_5',
        cancel_at_period_end: false,
        // no status field
      });

      const request = await makeSignedRequest(event);
      await onRequestPost({ request, env: makeEnv() });

      expect(mock.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionStatus: 'none' }),
      );
    });

    it('sets subscriptionEndsAt to null when current_period_end is missing', async () => {
      const mock = createDbMock({ selectResults: [[{ id: 'org-sub' }]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_update_6',
        status: 'active',
        cancel_at_period_end: false,
        // no current_period_end
      });

      const request = await makeSignedRequest(event);
      await onRequestPost({ request, env: makeEnv() });

      expect(mock.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionEndsAt: null }),
      );
    });

    it('does nothing when no matching org is found for subscription ID', async () => {
      const mock = createDbMock({ selectResults: [[]] }); // no org found
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_orphaned',
        status: 'active',
        cancel_at_period_end: false,
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });

      expect(res.status).toBe(200);
      expect(mock.updateFn).not.toHaveBeenCalled();
    });

    it('does nothing when subscription id is missing', async () => {
      const mock = createDbMock();
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('customer.subscription.updated', {
        status: 'active',
        // no id
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });

      expect(res.status).toBe(200);
      // select should not be called since there's no sub.id to look up
      expect(mock.db.select).not.toHaveBeenCalled();
    });
  });

  // --- customer.subscription.deleted ---

  describe('customer.subscription.deleted', () => {
    it('marks org subscription as canceled with current timestamp', async () => {
      const mock = createDbMock();
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('customer.subscription.deleted', {
        id: 'sub_deleted_1',
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });

      expect(res.status).toBe(200);
      expect(mock.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: 'canceled',
        }),
      );
      // subscriptionEndsAt should be an ISO date string close to now
      const setArg = mock.updateSet.mock.calls[0][0];
      const endsAt = new Date(setArg.subscriptionEndsAt);
      expect(endsAt.getTime()).toBeCloseTo(Date.now(), -3); // within ~1 second
    });

    it('does nothing when subscription id is missing', async () => {
      const mock = createDbMock();
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('customer.subscription.deleted', {});

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });

      expect(res.status).toBe(200);
      expect(mock.updateFn).not.toHaveBeenCalled();
    });
  });

  // --- invoice.payment_succeeded ---

  describe('invoice.payment_succeeded', () => {
    it('updates org to active with period end date', async () => {
      const mock = createDbMock({ selectResults: [[{ id: 'org-invoice' }]] });
      mockGetDb.mockReturnValue(mock.db);

      const periodEnd = 1700300000;
      const event = makeEvent('invoice.payment_succeeded', {
        subscription: 'sub_invoice_1',
        lines: { data: [{ period: { end: periodEnd } }] },
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });

      expect(res.status).toBe(200);
      expect(mock.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: 'active',
          subscriptionEndsAt: new Date(periodEnd * 1000).toISOString(),
        }),
      );
    });

    it('sets subscriptionEndsAt to null when period end data is missing', async () => {
      const mock = createDbMock({ selectResults: [[{ id: 'org-invoice' }]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('invoice.payment_succeeded', {
        subscription: 'sub_invoice_2',
        // no lines data
      });

      const request = await makeSignedRequest(event);
      await onRequestPost({ request, env: makeEnv() });

      expect(mock.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: 'active',
          subscriptionEndsAt: null,
        }),
      );
    });

    it('does nothing when no matching org exists', async () => {
      const mock = createDbMock({ selectResults: [[]] });
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('invoice.payment_succeeded', {
        subscription: 'sub_orphan_invoice',
        lines: { data: [{ period: { end: 1700400000 } }] },
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });

      expect(res.status).toBe(200);
      expect(mock.updateFn).not.toHaveBeenCalled();
    });

    it('does nothing when subscription field is missing', async () => {
      const mock = createDbMock();
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('invoice.payment_succeeded', {});

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });

      expect(res.status).toBe(200);
      expect(mock.db.select).not.toHaveBeenCalled();
    });
  });

  // --- invoice.payment_failed ---

  describe('invoice.payment_failed', () => {
    it('marks org subscription as past_due', async () => {
      const mock = createDbMock();
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('invoice.payment_failed', {
        subscription: 'sub_failed_1',
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });

      expect(res.status).toBe(200);
      expect(mock.updateSet).toHaveBeenCalledWith({ subscriptionStatus: 'past_due' });
    });

    it('does nothing when subscription field is missing', async () => {
      const mock = createDbMock();
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('invoice.payment_failed', {});

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });

      expect(res.status).toBe(200);
      expect(mock.updateFn).not.toHaveBeenCalled();
    });
  });

  // --- Unknown event types ---

  describe('unknown event types', () => {
    it('returns 200 with received: true for unhandled event types', async () => {
      const mock = createDbMock();
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('payment_intent.created', { id: 'pi_123' });
      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });
      const json = await res.json() as { received: boolean };

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);
    });
  });

  // --- Database error handling ---

  describe('database error during fulfillment', () => {
    it('returns 500 when DB insert throws during credit fulfillment', async () => {
      const mock = createDbMock({ selectResults: [[]] });
      mock.insertValues.mockRejectedValue(new Error('D1 write failed'));
      mockGetDb.mockReturnValue(mock.db);

      const event = makeEvent('checkout.session.completed', {
        payment_status: 'paid',
        id: 'cs_db_fail',
        metadata: { userId: 'user-fail', type: 'credits', credits: '5000' },
      });

      const request = await makeSignedRequest(event);
      const res = await onRequestPost({ request, env: makeEnv() });
      const json = await res.json() as { error: string };

      expect(res.status).toBe(500);
      expect(json.error).toBe('Database error');
    });
  });
});
