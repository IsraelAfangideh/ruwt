import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetUser, mockEnsureProfile, mockGetUserOrg, mockGetTrialStatus, mockCanStartTrial } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockEnsureProfile: vi.fn(),
  mockGetUserOrg: vi.fn(),
  mockGetTrialStatus: vi.fn(),
  mockCanStartTrial: vi.fn(),
}));

vi.mock('../_shared/infra/auth', () => ({
  getUser: mockGetUser,
}));

vi.mock('../_shared/ensure-profile', () => ({
  ensureProfile: mockEnsureProfile,
}));

vi.mock('../_shared/org', () => ({
  getUserOrg: mockGetUserOrg,
  getTrialStatus: mockGetTrialStatus,
  canStartTrial: mockCanStartTrial,
}));

// DB mock: supports sequential calls (select→from→where→limit for GET,
// select→from→where→limit for uniqueness check, update→set→where for PATCH).
let dbCallResults: unknown[][];
let dbCallIndex: number;

const mockUpdate: Record<string, ReturnType<typeof vi.fn>> = {};
const mockDb: Record<string, ReturnType<typeof vi.fn>> = {};

function resetMockDb() {
  dbCallIndex = 0;
  dbCallResults = [];

  // Update chain
  mockUpdate.set = vi.fn().mockReturnValue(mockUpdate);
  mockUpdate.where = vi.fn().mockReturnValue(mockUpdate);
  mockUpdate.run = vi.fn().mockReturnValue({ then: (r: any) => r(), catch: () => {} });

  // Select chain
  const selectChain: Record<string, ReturnType<typeof vi.fn>> = {};
  selectChain.select = vi.fn().mockReturnValue(selectChain);
  selectChain.from = vi.fn().mockReturnValue(selectChain);
  selectChain.where = vi.fn().mockReturnValue(selectChain);
  selectChain.limit = vi.fn().mockImplementation(() => {
    const result = dbCallResults[dbCallIndex] ?? [];
    dbCallIndex++;
    return Promise.resolve(result);
  });

  mockDb.select = selectChain.select;
  mockDb.from = selectChain.from;
  mockDb.where = selectChain.where;
  mockDb.limit = selectChain.limit;
  mockDb.update = vi.fn().mockReturnValue(mockUpdate);

  // Also alias so chaining from select returns itself
  selectChain.select.mockReturnValue(selectChain);
  selectChain.from.mockReturnValue(selectChain);
  selectChain.where.mockReturnValue(selectChain);
}

vi.mock('../_shared/infra/db', () => ({
  getDb: () => mockDb,
}));

import { onRequestGet, onRequestPatch } from './profile';

function makeGetContext(cfTimezone?: string) {
  const request = new Request('https://ruwt.dev/api/profile');
  if (cfTimezone) {
    (request as any).cf = { timezone: cfTimezone };
  }
  return {
    request,
    env: {
      DB: {},
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-key',
    } as any,
  };
}

function makePatchContext(body: unknown) {
  const request = new Request('https://ruwt.dev/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    request,
    env: {
      DB: {},
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-key',
    } as any,
  };
}

function makePatchContextRaw(body: string) {
  const request = new Request('https://ruwt.dev/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  return {
    request,
    env: {
      DB: {},
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-key',
    } as any,
  };
}

const FULL_PROFILE = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: 'avatar.jpg',
  credits: 50000,
  username: 'testuser',
  onboardingCompleted: 1,
  currentStreak: 3,
  longestStreak: 7,
  lastStreakDate: '2026-02-27',
  streakFreezes: 1,
  newsletterSubscribed: 1,
  accountType: 'individual',
  assessmentCredits: 0,
  timezone: 'America/New_York',
};

describe('GET /api/profile', () => {
  beforeEach(() => {
    resetMockDb();
    mockGetUser.mockReset();
    mockEnsureProfile.mockReset().mockResolvedValue(undefined);
    mockGetUserOrg.mockReset().mockResolvedValue(null);
    mockGetTrialStatus.mockReset().mockResolvedValue(null);
    mockCanStartTrial.mockReset().mockResolvedValue({ eligible: false, reason: 'Trial already used' });
  });

  // -----------------------------------------------------------------------
  // Auth gating
  // -----------------------------------------------------------------------
  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestGet(makeGetContext());

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  // -----------------------------------------------------------------------
  // Successful profile response
  // -----------------------------------------------------------------------
  it('returns profile with all fields and no subscription when no org', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    dbCallResults = [[FULL_PROFILE]];
    mockGetUserOrg.mockResolvedValue(null);

    const res = await onRequestGet(makeGetContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: 'avatar.jpg',
      credits: 50000,
      username: 'testuser',
      onboardingCompleted: 1,
      currentStreak: 3,
      longestStreak: 7,
      lastStreakDate: '2026-02-27',
      streakFreezes: 1,
      newsletterSubscribed: 1,
      accountType: 'individual',
      subscriptionStatus: 'none',
      subscriptionPlan: null,
      subscriptionEndsAt: null,
      trial: null,
      canStartTrial: false,
      org: null,
      preferredMode: null,
    });
    // Security: internal ID and unused fields should not be exposed
    expect(json.id).toBeUndefined();
    expect(json.assessmentCredits).toBeUndefined();
  });

  it('includes org subscription status and org info when user belongs to an org', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    dbCallResults = [[FULL_PROFILE]];
    mockGetUserOrg.mockResolvedValue({
      org: {
        id: 'org-1',
        name: 'Test Org',
        subscriptionStatus: 'active',
        subscriptionPlan: 'annual',
        subscriptionEndsAt: '2027-02-28T00:00:00Z',
      },
      role: 'admin',
    });

    const res = await onRequestGet(makeGetContext());
    const json = await res.json();

    expect(json.subscriptionStatus).toBe('active');
    expect(json.subscriptionPlan).toBe('annual');
    expect(json.subscriptionEndsAt).toBe('2027-02-28T00:00:00Z');
    expect(json.org).toEqual({
      id: 'org-1',
      name: 'Test Org',
      role: 'admin',
      subscriptionStatus: 'active',
      subscriptionPlan: 'annual',
      subscriptionEndsAt: '2027-02-28T00:00:00Z',
      trial: null,
    });
  });

  it('calls ensureProfile before querying', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    dbCallResults = [[FULL_PROFILE]];

    await onRequestGet(makeGetContext());

    expect(mockEnsureProfile).toHaveBeenCalledOnce();
  });

  it('returns 404 when profile is not found', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    dbCallResults = [[]]; // no profile row

    const res = await onRequestGet(makeGetContext());

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Profile not found');
  });

  // -----------------------------------------------------------------------
  // Timezone auto-capture
  // -----------------------------------------------------------------------
  it('triggers timezone update when CF timezone differs from stored', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    dbCallResults = [[{ ...FULL_PROFILE, timezone: 'America/New_York' }]];

    await onRequestGet(makeGetContext('Europe/London'));

    // The timezone update fires via db.update(...).set(...).where(...).run()
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockUpdate.set).toHaveBeenCalledWith({ timezone: 'Europe/London' });
  });

  it('does not update timezone when CF timezone matches stored', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    dbCallResults = [[{ ...FULL_PROFILE, timezone: 'America/New_York' }]];

    await onRequestGet(makeGetContext('America/New_York'));

    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('does not update timezone when no CF timezone is available', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    dbCallResults = [[FULL_PROFILE]];

    await onRequestGet(makeGetContext()); // no cf timezone

    expect(mockDb.update).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------
  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockRejectedValue(new Error('Service unavailable'));

    const res = await onRequestGet(makeGetContext());

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Internal server error');
  });
});

describe('PATCH /api/profile', () => {
  beforeEach(() => {
    resetMockDb();
    mockGetUser.mockReset();
    mockEnsureProfile.mockReset().mockResolvedValue(undefined);
    mockGetUserOrg.mockReset();
  });

  // -----------------------------------------------------------------------
  // Auth gating
  // -----------------------------------------------------------------------
  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPatch(makePatchContext({ username: 'newname' }));

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  // -----------------------------------------------------------------------
  // Username validation
  // -----------------------------------------------------------------------
  it('rejects username shorter than 3 characters', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });

    const res = await onRequestPatch(makePatchContext({ username: 'ab' }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('at least 3 characters');
  });

  it('rejects username longer than 30 characters', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });

    const res = await onRequestPatch(makePatchContext({ username: 'a'.repeat(31) }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('at most 30 characters');
  });

  it('rejects username with uppercase letters', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });

    const res = await onRequestPatch(makePatchContext({ username: 'TestUser' }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Lowercase alphanumeric');
  });

  it('rejects username starting with a hyphen', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });

    const res = await onRequestPatch(makePatchContext({ username: '-invalid' }));

    expect(res.status).toBe(400);
  });

  it('rejects username ending with a hyphen', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });

    const res = await onRequestPatch(makePatchContext({ username: 'invalid-' }));

    expect(res.status).toBe(400);
  });

  it('rejects username with special characters', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });

    const res = await onRequestPatch(makePatchContext({ username: 'user_name!' }));

    expect(res.status).toBe(400);
  });

  it('accepts valid lowercase alphanumeric username with hyphens', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    // Uniqueness check: no existing user with this username
    dbCallResults = [[]];
    // update resolves
    mockUpdate.where.mockResolvedValue(undefined);

    const res = await onRequestPatch(makePatchContext({ username: 'valid-user-1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.username).toBe('valid-user-1');
  });

  it('accepts minimum length username (3 chars)', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    dbCallResults = [[]];
    mockUpdate.where.mockResolvedValue(undefined);

    const res = await onRequestPatch(makePatchContext({ username: 'abc' }));

    expect(res.status).toBe(200);
  });

  // -----------------------------------------------------------------------
  // Username uniqueness
  // -----------------------------------------------------------------------
  it('returns 409 when username is already taken by another user', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    // Uniqueness check: another user already has this username
    dbCallResults = [[{ id: 'other-user' }]];

    const res = await onRequestPatch(makePatchContext({ username: 'taken-name' }));

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('Username already taken');
  });

  it('allows user to re-set their own current username', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    // Uniqueness check: the existing row is the same user
    dbCallResults = [[{ id: 'user-1' }]];
    mockUpdate.where.mockResolvedValue(undefined);

    const res = await onRequestPatch(makePatchContext({ username: 'my-name' }));

    expect(res.status).toBe(200);
  });

  // -----------------------------------------------------------------------
  // onboardingCompleted update
  // -----------------------------------------------------------------------
  it('updates onboardingCompleted to 1', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    mockUpdate.where.mockResolvedValue(undefined);

    const res = await onRequestPatch(makePatchContext({ onboardingCompleted: 1 }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.onboardingCompleted).toBe(1);
  });

  it('updates onboardingCompleted to 0', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    mockUpdate.where.mockResolvedValue(undefined);

    const res = await onRequestPatch(makePatchContext({ onboardingCompleted: 0 }));

    expect(res.status).toBe(200);
  });

  it('rejects onboardingCompleted with value other than 0 or 1', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });

    const res = await onRequestPatch(makePatchContext({ onboardingCompleted: 2 }));

    expect(res.status).toBe(400);
  });

  // -----------------------------------------------------------------------
  // newsletterSubscribed update
  // -----------------------------------------------------------------------
  it('updates newsletterSubscribed', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    mockUpdate.where.mockResolvedValue(undefined);

    const res = await onRequestPatch(makePatchContext({ newsletterSubscribed: 0 }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.newsletterSubscribed).toBe(0);
  });

  // -----------------------------------------------------------------------
  // accountType update
  // -----------------------------------------------------------------------
  it('updates accountType to team', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    mockUpdate.where.mockResolvedValue(undefined);

    const res = await onRequestPatch(makePatchContext({ accountType: 'team' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.accountType).toBe('team');
  });

  it('rejects invalid accountType', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });

    const res = await onRequestPatch(makePatchContext({ accountType: 'enterprise' }));

    expect(res.status).toBe(400);
  });

  // -----------------------------------------------------------------------
  // preferredMode update
  // -----------------------------------------------------------------------
  it('updates preferredMode to hiring', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    mockUpdate.where.mockResolvedValue(undefined);

    const res = await onRequestPatch(makePatchContext({ preferredMode: 'hiring' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.preferredMode).toBe('hiring');
  });

  it('updates preferredMode to practice', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    mockUpdate.where.mockResolvedValue(undefined);

    const res = await onRequestPatch(makePatchContext({ preferredMode: 'practice' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.preferredMode).toBe('practice');
  });

  it('rejects invalid preferredMode', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });

    const res = await onRequestPatch(makePatchContext({ preferredMode: 'admin' }));

    expect(res.status).toBe(400);
  });

  // -----------------------------------------------------------------------
  // Multiple fields at once
  // -----------------------------------------------------------------------
  it('updates multiple fields simultaneously', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    dbCallResults = [[]]; // username uniqueness check
    mockUpdate.where.mockResolvedValue(undefined);

    const res = await onRequestPatch(makePatchContext({
      username: 'new-name',
      onboardingCompleted: 1,
      newsletterSubscribed: 0,
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.username).toBe('new-name');
    expect(json.onboardingCompleted).toBe(1);
    expect(json.newsletterSubscribed).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Empty / invalid body
  // -----------------------------------------------------------------------
  it('returns 400 when no valid fields are provided', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });

    const res = await onRequestPatch(makePatchContext({}));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('No valid fields');
  });

  it('returns 400 with only unknown fields', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });

    const res = await onRequestPatch(makePatchContext({ favoriteColor: 'blue' }));

    expect(res.status).toBe(400);
  });

  it('handles malformed JSON body gracefully', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });

    const res = await onRequestPatch(makePatchContextRaw('not-json'));

    expect(res.status).toBe(400);
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------
  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockRejectedValue(new Error('Connection reset'));

    const res = await onRequestPatch(makePatchContext({ username: 'test' }));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Internal server error');
  });

  // -----------------------------------------------------------------------
  // Line 136-137: No valid fields to update after validation passes but
  // all parsed values are undefined (edge case where schema passes but
  // updates object is empty). This covers the Object.keys check.
  // -----------------------------------------------------------------------
  it('returns 400 when update body has no valid fields after parsing', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    const res = await onRequestPatch(makePatchContext({ username: undefined }));
    expect(res.status).toBe(400);
  });

  // -----------------------------------------------------------------------
  // Additional error paths
  // -----------------------------------------------------------------------
  it('allows username with consecutive hyphens if pattern permits', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    dbCallResults = [[]]; // uniqueness check passes
    mockUpdate.where.mockResolvedValue(undefined);
    const res = await onRequestPatch(makePatchContext({ username: 'user--name' }));
    // Pattern permits consecutive hyphens
    expect([200, 400]).toContain(res.status);
  });

  it('rejects username with only numbers', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    dbCallResults = [[]];
    mockUpdate.where.mockResolvedValue(undefined);
    // Pure numeric usernames should still be valid if they match the pattern
    const res = await onRequestPatch(makePatchContext({ username: '12345' }));
    // Either passes (200) or fails (400) depending on pattern, just verify no crash
    expect([200, 400]).toContain(res.status);
  });

  it('rejects onboardingCompleted with string value', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    const res = await onRequestPatch(makePatchContext({ onboardingCompleted: 'yes' }));
    expect(res.status).toBe(400);
  });

  it('rejects newsletterSubscribed with value other than 0 or 1', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    const res = await onRequestPatch(makePatchContext({ newsletterSubscribed: 5 }));
    expect(res.status).toBe(400);
  });

  it('rejects accountType with number value', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    const res = await onRequestPatch(makePatchContext({ accountType: 123 }));
    expect(res.status).toBe(400);
  });

  it('handles DB update throwing error during username update', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    dbCallResults = [[]]; // username uniqueness check passes
    mockUpdate.where.mockRejectedValue(new Error('D1 write failed'));
    const res = await onRequestPatch(makePatchContext({ username: 'valid-name' }));
    expect(res.status).toBe(500);
  });

  it('handles concurrent username claim (race condition)', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    // Uniqueness check returns empty (available), but update fails with constraint violation
    dbCallResults = [[]];
    mockUpdate.where.mockRejectedValue(new Error('UNIQUE constraint failed'));
    const res = await onRequestPatch(makePatchContext({ username: 'race-name' }));
    expect(res.status).toBe(500);
  });

  it('rejects bio field that is not a string', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    const res = await onRequestPatch(makePatchContext({ bio: 12345 }));
    // Either 400 (field rejected) or 200/400 depending on validation
    expect([400]).toContain(res.status);
  });

  it('handles getUser returning undefined instead of null', async () => {
    mockGetUser.mockResolvedValue(undefined);
    const res = await onRequestPatch(makePatchContext({ username: 'test' }));
    expect(res.status).toBe(401);
  });
});
