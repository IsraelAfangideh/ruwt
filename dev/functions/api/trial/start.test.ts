import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const {
  mockGetUser, mockGetDb, mockCanStartTrial, mockGetUserOrg,
  mockUpdate,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockCanStartTrial: vi.fn(),
  mockGetUserOrg: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../../_shared/org', () => ({
  canStartTrial: mockCanStartTrial,
  getUserOrg: mockGetUserOrg,
  TRIAL_DURATION_DAYS: 30,
  TRIAL_MAX_ASSESSMENTS: 1,
  TRIAL_MAX_INVITES: 3,
}));

import { onRequestPost, deriveOrgName } from './start';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = {
  id: 'user-123',
  email: 'test@company.com',
  user_metadata: { full_name: 'Test User' },
  app_metadata: { provider: 'github' },
};

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
    STRIPE_SECRET_KEY: 'sk_test_fake',
    ...overrides,
  } as Env;
}

function makeContext(envOverrides: Partial<Env> = {}) {
  return {
    request: new Request('https://ruwt.dev/api/trial/start', { method: 'POST' }),
    env: makeEnv(envOverrides),
    waitUntil: vi.fn(),
  };
}

function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(undefined);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockResolvedValue(undefined);
  chain.run = vi.fn().mockResolvedValue(undefined);
  return chain as any;
}

// Mock global fetch for Stripe API calls
const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

// ── Tests ────────────────────────────────────────────────────────────

describe('POST /api/trial/start', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPost(makeContext());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 403 when trial already used', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(createMockDb());
    mockCanStartTrial.mockResolvedValue({ eligible: false, reason: 'Trial already used' });

    const res = await onRequestPost(makeContext());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.code).toBe('TRIAL_NOT_ELIGIBLE');
    expect(json.error).toContain('Trial already used');
  });

  it('returns 403 when user already subscribed', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(createMockDb());
    mockCanStartTrial.mockResolvedValue({ eligible: false, reason: 'Already subscribed' });

    const res = await onRequestPost(makeContext());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain('Already subscribed');
  });

  it('returns 503 when STRIPE_SECRET_KEY is missing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(createMockDb());
    mockCanStartTrial.mockResolvedValue({ eligible: true });

    const res = await onRequestPost(makeContext({ STRIPE_SECRET_KEY: undefined } as any));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error).toBe('Payment system not configured');
  });

  it('returns 403 when user is only a member (not owner/admin) of existing org', async () => {
    const db = createMockDb();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(db);
    mockCanStartTrial.mockResolvedValue({ eligible: true });
    mockGetUserOrg.mockResolvedValue({
      org: { id: 'existing-org', subscriptionStatus: 'none', stripeCustomerId: null },
      role: 'member',
    });

    const res = await onRequestPost(makeContext());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain('Only org owners');
  });

  it('creates Stripe customer and checkout session for user without org', async () => {
    const db = createMockDb();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(db);
    mockCanStartTrial.mockResolvedValue({ eligible: true });
    mockGetUserOrg.mockResolvedValue(null);

    // Stripe customer creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'cus_test123' }),
    });
    // Stripe checkout session creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/test-session' }),
    });

    const res = await onRequestPost(makeContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toBe('https://checkout.stripe.com/test-session');

    // Verify Stripe customer creation
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const custCall = mockFetch.mock.calls[0];
    expect(custCall[0]).toBe('https://api.stripe.com/v1/customers');

    // Verify checkout session params include trial_period_days and trial_subscription type
    const sessionCall = mockFetch.mock.calls[1];
    expect(sessionCall[0]).toBe('https://api.stripe.com/v1/checkout/sessions');
    const body = sessionCall[1].body;
    expect(body).toContain('trial_period_days');
    expect(body).toContain('trial_subscription');
    expect(body).not.toContain('orgId'); // No org yet
  });

  it('reuses existing Stripe customer for user with org', async () => {
    const db = createMockDb();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(db);
    mockCanStartTrial.mockResolvedValue({ eligible: true });
    mockGetUserOrg.mockResolvedValue({
      org: { id: 'existing-org', name: 'Acme Team', subscriptionStatus: 'none', stripeCustomerId: 'cus_existing' },
      role: 'owner',
    });

    // Only checkout session creation (customer already exists)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/test-session' }),
    });

    const res = await onRequestPost(makeContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toBe('https://checkout.stripe.com/test-session');

    // Should only call Stripe once (checkout session, not customer creation)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = mockFetch.mock.calls[0][1].body;
    expect(body).toContain('orgId');
    expect(body).toContain('existing-org');
  });

  it('returns 502 when Stripe customer creation fails', async () => {
    const db = createMockDb();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(db);
    mockCanStartTrial.mockResolvedValue({ eligible: true });
    mockGetUserOrg.mockResolvedValue(null);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'Stripe error',
    });

    const res = await onRequestPost(makeContext());
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.error).toBe('Failed to create billing account');
  });

  it('returns 502 when Stripe checkout session creation fails', async () => {
    const db = createMockDb();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(db);
    mockCanStartTrial.mockResolvedValue({ eligible: true });
    mockGetUserOrg.mockResolvedValue(null);

    // Customer creation succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'cus_test123' }),
    });
    // Checkout session fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'Stripe session error',
    });

    const res = await onRequestPost(makeContext());
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.error).toBe('Failed to create checkout session');
  });
});

describe('deriveOrgName', () => {
  it('returns "My Team" for personal email domains', () => {
    expect(deriveOrgName('someone@gmail.com')).toBe('My Team');
    expect(deriveOrgName('test@hotmail.com')).toBe('My Team');
    expect(deriveOrgName('user@protonmail.com')).toBe('My Team');
  });

  it('derives org name from work email domain', () => {
    expect(deriveOrgName('hire@acme.com')).toBe('Acme Team');
    expect(deriveOrgName('test@company.com')).toBe('Company Team');
  });

  it('returns "My Team" for invalid emails', () => {
    expect(deriveOrgName('noemail')).toBe('My Team');
  });
});
