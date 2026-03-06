import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const {
  mockGetUser, mockGetDb, mockCanStartTrial, mockGetUserOrg,
  mockGetTrialStatus, mockInsert, mockUpdate,
  mockSendEmail, mockTrialStartNotificationEmail, mockTrialWelcomeEmail,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockCanStartTrial: vi.fn(),
  mockGetUserOrg: vi.fn(),
  mockGetTrialStatus: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSendEmail: vi.fn(),
  mockTrialStartNotificationEmail: vi.fn(),
  mockTrialWelcomeEmail: vi.fn(),
}));

vi.mock('../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../_shared/org', () => ({
  canStartTrial: mockCanStartTrial,
  getUserOrg: mockGetUserOrg,
  getTrialStatus: mockGetTrialStatus,
  TRIAL_DURATION_DAYS: 30,
  TRIAL_MAX_ASSESSMENTS: 1,
  TRIAL_MAX_INVITES: 3,
}));
vi.mock('../../_shared/newsletter/resend', () => ({
  sendEmail: mockSendEmail,
}));
vi.mock('../../_shared/email/templates', () => ({
  trialStartNotificationEmail: mockTrialStartNotificationEmail,
  trialWelcomeEmail: mockTrialWelcomeEmail,
}));

import { onRequestPost } from './start';

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
    RESEND_API_KEY: 'test-resend-key',
    ...overrides,
  } as Env;
}

function makeContext(envOverrides: Partial<Env> = {}) {
  return {
    request: new Request('https://ruwt.dev/api/trial/start', { method: 'POST' }),
    env: makeEnv(envOverrides),
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

// ── Tests ────────────────────────────────────────────────────────────

describe('POST /api/trial/start', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSendEmail.mockResolvedValue({ success: true, id: 'email-id-1' });
    mockTrialStartNotificationEmail.mockReturnValue({
      subject: 'New teams trial: Test User started a trial',
      html: '<h1>Trial started</h1>',
      text: 'Trial started',
    });
    mockTrialWelcomeEmail.mockReturnValue({
      subject: 'Your 30-day trial is active',
      html: '<h1>Welcome to your trial</h1>',
      text: 'Welcome to your trial',
    });
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

  // ── Email notification tests ──────────────────────────────────────

  it('sends admin notification email on successful trial start', async () => {
    const db = createMockDb();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(db);
    mockCanStartTrial.mockResolvedValue({ eligible: true });
    mockGetUserOrg
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ org: { id: 'new-org', name: 'Company Team' }, role: 'owner' });
    mockGetTrialStatus.mockResolvedValue({
      isActive: true, daysRemaining: 30,
      assessmentsUsed: 0, assessmentsLimit: 1,
      invitesUsed: 0, invitesLimit: 3,
    });

    const res = await onRequestPost(makeContext());
    expect(res.status).toBe(201);

    await vi.waitFor(() => {
      expect(mockTrialStartNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          userName: 'Test User',
          userEmail: 'test@company.com',
          provider: 'github',
        }),
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          to: 'israel@ruwt.dev',
          subject: 'New teams trial: Test User started a trial',
        }),
      );
    });
  });

  it('sends user welcome email on successful trial start', async () => {
    const db = createMockDb();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(db);
    mockCanStartTrial.mockResolvedValue({ eligible: true });
    mockGetUserOrg
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ org: { id: 'new-org', name: 'Company Team' }, role: 'owner' });
    mockGetTrialStatus.mockResolvedValue({
      isActive: true, daysRemaining: 30,
      assessmentsUsed: 0, assessmentsLimit: 1,
      invitesUsed: 0, invitesLimit: 3,
    });

    const res = await onRequestPost(makeContext());
    expect(res.status).toBe(201);

    await vi.waitFor(() => {
      expect(mockTrialWelcomeEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test',
          assessmentLimit: 1,
          inviteLimit: 3,
        }),
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          to: 'test@company.com',
          subject: 'Your 30-day trial is active',
        }),
      );
    });
  });

  it('org name uses "My Team" for personal email domains', async () => {
    const db = createMockDb();
    mockGetUser.mockResolvedValue({ ...FAKE_USER, email: 'someone@gmail.com' });
    mockGetDb.mockReturnValue(db);
    mockCanStartTrial.mockResolvedValue({ eligible: true });
    mockGetUserOrg
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ org: { id: 'new-org', name: 'My Team' }, role: 'owner' });
    mockGetTrialStatus.mockResolvedValue({
      isActive: true, daysRemaining: 30,
      assessmentsUsed: 0, assessmentsLimit: 1,
      invitesUsed: 0, invitesLimit: 3,
    });

    const res = await onRequestPost(makeContext());
    expect(res.status).toBe(201);

    await vi.waitFor(() => {
      expect(mockTrialStartNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ orgName: 'My Team' }),
      );
    });
  });

  it('org name derives from work email domain', async () => {
    const db = createMockDb();
    mockGetUser.mockResolvedValue({ ...FAKE_USER, email: 'hire@acme.com' });
    mockGetDb.mockReturnValue(db);
    mockCanStartTrial.mockResolvedValue({ eligible: true });
    mockGetUserOrg
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ org: { id: 'new-org', name: 'Acme Team' }, role: 'owner' });
    mockGetTrialStatus.mockResolvedValue({
      isActive: true, daysRemaining: 30,
      assessmentsUsed: 0, assessmentsLimit: 1,
      invitesUsed: 0, invitesLimit: 3,
    });

    const res = await onRequestPost(makeContext());
    expect(res.status).toBe(201);

    await vi.waitFor(() => {
      expect(mockTrialStartNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ orgName: 'Acme Team' }),
      );
    });
  });

  it('emails are logged to newsletter_logs', async () => {
    const db = createMockDb();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(db);
    mockCanStartTrial.mockResolvedValue({ eligible: true });
    mockGetUserOrg
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ org: { id: 'new-org', name: 'Company Team' }, role: 'owner' });
    mockGetTrialStatus.mockResolvedValue({
      isActive: true, daysRemaining: 30,
      assessmentsUsed: 0, assessmentsLimit: 1,
      invitesUsed: 0, invitesLimit: 3,
    });

    const res = await onRequestPost(makeContext());
    expect(res.status).toBe(201);

    // Wait for fire-and-forget email promises to settle
    await vi.waitFor(() => {
      // db.run is used for raw SQL newsletter_logs inserts
      expect(db.run).toHaveBeenCalled();
    });
  });

  it('does not send emails when RESEND_API_KEY is missing', async () => {
    const db = createMockDb();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue(db);
    mockCanStartTrial.mockResolvedValue({ eligible: true });
    mockGetUserOrg
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ org: { id: 'new-org', name: 'Company Team' }, role: 'owner' });
    mockGetTrialStatus.mockResolvedValue({
      isActive: true, daysRemaining: 30,
      assessmentsUsed: 0, assessmentsLimit: 1,
      invitesUsed: 0, invitesLimit: 3,
    });

    // Pass env without RESEND_API_KEY
    const res = await onRequestPost(makeContext({ RESEND_API_KEY: undefined as any }));
    expect(res.status).toBe(201);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockTrialStartNotificationEmail).not.toHaveBeenCalled();
    expect(mockTrialWelcomeEmail).not.toHaveBeenCalled();
  });
});
