import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const { mockGetUser, mockGetDb, mockCanStartTrial, mockGetUserOrg, mockGetTrialStatus } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockCanStartTrial: vi.fn(),
  mockGetUserOrg: vi.fn(),
  mockGetTrialStatus: vi.fn(),
}));

vi.mock('../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../_shared/org', () => ({
  canStartTrial: mockCanStartTrial,
  getUserOrg: mockGetUserOrg,
  getTrialStatus: mockGetTrialStatus,
}));

import { onRequestGet } from './status';

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
    request: new Request('https://ruwt.dev/api/trial/status', { method: 'GET' }),
    env: makeEnv(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('GET /api/trial/status', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns eligible when user can start trial', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    mockCanStartTrial.mockResolvedValue({ eligible: true });
    mockGetUserOrg.mockResolvedValue(null);

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.canStartTrial).toBe(true);
    expect(json.trial).toBeNull();
  });

  it('returns trial status when user has active trial', async () => {
    const trialData = {
      isActive: true, daysRemaining: 20,
      assessmentsUsed: 0, assessmentsLimit: 1,
      invitesUsed: 1, invitesLimit: 3,
    };
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    mockCanStartTrial.mockResolvedValue({ eligible: false, reason: 'Trial already used' });
    mockGetUserOrg.mockResolvedValue({ org: { id: 'org-1' }, role: 'owner' });
    mockGetTrialStatus.mockResolvedValue(trialData);

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.canStartTrial).toBe(false);
    expect(json.reason).toBe('Trial already used');
    expect(json.trial).toEqual(trialData);
  });

  it('returns not eligible with reason when trial already used', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});
    mockCanStartTrial.mockResolvedValue({ eligible: false, reason: 'Trial already used' });
    mockGetUserOrg.mockResolvedValue(null);

    const res = await onRequestGet(makeContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.canStartTrial).toBe(false);
    expect(json.reason).toBe('Trial already used');
    expect(json.trial).toBeNull();
  });
});
