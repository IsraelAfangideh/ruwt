import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const {
  mockGetUser, mockGetDb, mockCanStartTrial, mockGetUserOrg,
  mockGetTrialStatus, mockInsert, mockUpdate,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockCanStartTrial: vi.fn(),
  mockGetUserOrg: vi.fn(),
  mockGetTrialStatus: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../_shared/org', () => ({
  canStartTrial: mockCanStartTrial,
  getUserOrg: mockGetUserOrg,
  getTrialStatus: mockGetTrialStatus,
  TRIAL_DURATION_DAYS: 30,
}));

import { onRequestPost } from './start';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = { id: 'user-123', email: 'test@company.com' };

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeContext() {
  return {
    request: new Request('https://ruwt.dev/api/trial/start', { method: 'POST' }),
    env: makeEnv(),
  };
}

function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(undefined);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockResolvedValue(undefined);
  return chain as any;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('POST /api/trial/start', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

  it('creates org and starts trial for user without org', async () => {
    const db = createMockDb();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(db);
    mockCanStartTrial.mockResolvedValue({ eligible: true });
    // First call: no org; second call after creation: returns new org
    mockGetUserOrg
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ org: { id: 'new-org' }, role: 'owner' });
    mockGetTrialStatus.mockResolvedValue({
      isActive: true, daysRemaining: 30,
      assessmentsUsed: 0, assessmentsLimit: 1,
      invitesUsed: 0, invitesLimit: 3,
    });

    const res = await onRequestPost(makeContext());
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.trial).toBeTruthy();
    expect(json.trial.isActive).toBe(true);
    expect(json.orgId).toBe('new-org');
  });

  it('returns 403 when user is only a member (not owner/admin) of existing org', async () => {
    const db = createMockDb();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(db);
    mockCanStartTrial.mockResolvedValue({ eligible: true });
    mockGetUserOrg.mockResolvedValue({
      org: { id: 'existing-org', subscriptionStatus: 'none' },
      role: 'member',
    });

    const res = await onRequestPost(makeContext());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain('Only org owners');
  });

  it('updates existing org with trial dates when user has org', async () => {
    const db = createMockDb();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(db);
    mockCanStartTrial.mockResolvedValue({ eligible: true });
    mockGetUserOrg.mockResolvedValue({
      org: { id: 'existing-org', subscriptionStatus: 'none' },
      role: 'owner',
    });
    mockGetTrialStatus.mockResolvedValue({
      isActive: true, daysRemaining: 30,
      assessmentsUsed: 0, assessmentsLimit: 1,
      invitesUsed: 0, invitesLimit: 3,
    });

    const res = await onRequestPost(makeContext());
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.trial.isActive).toBe(true);
    expect(json.orgId).toBe('existing-org');
  });
});
