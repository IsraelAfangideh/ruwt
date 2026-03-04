import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — org.ts uses Drizzle query builder, so we mock at the chain level.
// We create a builder that records chained calls and resolves with preset rows.
// ---------------------------------------------------------------------------

function createChainMock(rows: unknown[] = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  return chain;
}

function createDb(rows: unknown[] = []) {
  const chain = createChainMock(rows);
  return { chain, db: chain as any };
}

// Separate chain for getUserOrgIds (no .limit call — resolves from .where)
function createDbNoLimit(rows: unknown[] = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(rows);
  return { chain, db: chain as any };
}

// org.ts accesses schema columns for eq/and conditions (e.g. orgMembers.role).
// Drizzle column references are used in where clauses; our mock ignores the
// actual SQL — we just control what rows come back.

import {
  getUserOrg,
  getUserOrgRole,
  requireOrgAccess,
  canManageAssessment,
  canViewResults,
  getUserOrgIds,
  hasActiveSubscription,
  requireTeamAccount,
  getTrialStatus,
  isOnActiveTrial,
  canStartTrial,
  TRIAL_DURATION_DAYS,
  TRIAL_MAX_ASSESSMENTS,
  TRIAL_MAX_INVITES,
} from './org';

// ---------------------------------------------------------------------------
// ROLE_HIERARCHY is not exported, but its behavior is tested via requireOrgAccess.
// ---------------------------------------------------------------------------

describe('getUserOrg', () => {
  it('returns org + role when user is a member', async () => {
    const orgData = { id: 'org-1', name: 'Test Org' };
    const { db } = createDb([{ org: orgData, role: 'admin' }]);

    const result = await getUserOrg(db, 'user-1');

    expect(result).toEqual({ org: orgData, role: 'admin' });
  });

  it('returns null when user has no org membership', async () => {
    const { db } = createDb([]);

    const result = await getUserOrg(db, 'user-lonely');

    expect(result).toBeNull();
  });
});

describe('getUserOrgRole', () => {
  it('returns the role for a valid member', async () => {
    const { db } = createDb([{ role: 'owner' }]);

    const role = await getUserOrgRole(db, 'user-1', 'org-1');

    expect(role).toBe('owner');
  });

  it('returns null when user is not a member of the org', async () => {
    const { db } = createDb([]);

    const role = await getUserOrgRole(db, 'user-2', 'org-1');

    expect(role).toBeNull();
  });
});

describe('requireOrgAccess', () => {
  it('returns role when user meets the minimum role requirement', async () => {
    const { db } = createDb([{ role: 'admin' }]);

    const role = await requireOrgAccess(db, 'user-1', 'org-1', 'member');

    expect(role).toBe('admin');
  });

  it('returns role when user exactly matches the minimum role', async () => {
    const { db } = createDb([{ role: 'member' }]);

    const role = await requireOrgAccess(db, 'user-1', 'org-1', 'member');

    expect(role).toBe('member');
  });

  it('returns null when user role is below minimum required', async () => {
    const { db } = createDb([{ role: 'viewer' }]);

    const role = await requireOrgAccess(db, 'user-1', 'org-1', 'member');

    expect(role).toBeNull();
  });

  it('returns null when user is not a member at all', async () => {
    const { db } = createDb([]);

    const role = await requireOrgAccess(db, 'user-1', 'org-1', 'viewer');

    expect(role).toBeNull();
  });

  it('defaults to viewer as the minimum role', async () => {
    const { db } = createDb([{ role: 'viewer' }]);

    const role = await requireOrgAccess(db, 'user-1', 'org-1');

    expect(role).toBe('viewer');
  });

  it('owner passes any minimum role check', async () => {
    const { db } = createDb([{ role: 'owner' }]);

    const role = await requireOrgAccess(db, 'user-1', 'org-1', 'admin');

    expect(role).toBe('owner');
  });

  it('member cannot pass admin-level check', async () => {
    const { db } = createDb([{ role: 'member' }]);

    const role = await requireOrgAccess(db, 'user-1', 'org-1', 'admin');

    expect(role).toBeNull();
  });
});

describe('canManageAssessment', () => {
  // canManageAssessment does two DB queries:
  // 1) select from assessments (returns assessment row)
  // 2) requireOrgAccess → getUserOrgRole → select from orgMembers (returns role row)
  // Both go through the same db object, so we need sequential mock responses.

  function createSequentialDb(...callResults: unknown[][]) {
    let callIndex = 0;
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockImplementation(() => {
      const result = callResults[callIndex] ?? [];
      callIndex++;
      return Promise.resolve(result);
    });
    return chain as any;
  }

  it('returns true when user is the assessment creator', async () => {
    const db = createSequentialDb(
      [{ createdBy: 'user-1', orgId: 'org-1' }], // assessment query
    );

    const result = await canManageAssessment(db, 'user-1', 'assess-1');

    expect(result).toBe(true);
  });

  it('returns true when user is org admin (not creator)', async () => {
    const db = createSequentialDb(
      [{ createdBy: 'user-other', orgId: 'org-1' }], // assessment query
      [{ role: 'admin' }], // getUserOrgRole query
    );

    const result = await canManageAssessment(db, 'user-admin', 'assess-1');

    expect(result).toBe(true);
  });

  it('returns true when user is org owner (not creator)', async () => {
    const db = createSequentialDb(
      [{ createdBy: 'user-other', orgId: 'org-1' }],
      [{ role: 'owner' }],
    );

    const result = await canManageAssessment(db, 'user-owner', 'assess-1');

    expect(result).toBe(true);
  });

  it('returns false when user is a regular member (not admin/owner)', async () => {
    const db = createSequentialDb(
      [{ createdBy: 'user-other', orgId: 'org-1' }],
      [{ role: 'member' }],
    );

    const result = await canManageAssessment(db, 'user-member', 'assess-1');

    expect(result).toBe(false);
  });

  it('returns false when assessment does not exist', async () => {
    const db = createSequentialDb([]);

    const result = await canManageAssessment(db, 'user-1', 'nonexistent');

    expect(result).toBe(false);
  });

  it('returns false when assessment has no orgId and user is not creator', async () => {
    const db = createSequentialDb(
      [{ createdBy: 'user-other', orgId: null }],
    );

    const result = await canManageAssessment(db, 'user-1', 'assess-1');

    expect(result).toBe(false);
  });
});

describe('canViewResults', () => {
  function createSequentialDb(...callResults: unknown[][]) {
    let callIndex = 0;
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockImplementation(() => {
      const result = callResults[callIndex] ?? [];
      callIndex++;
      return Promise.resolve(result);
    });
    return chain as any;
  }

  it('returns true when user is the creator', async () => {
    const db = createSequentialDb(
      [{ createdBy: 'user-1', orgId: 'org-1' }],
    );

    const result = await canViewResults(db, 'user-1', 'assess-1');

    expect(result).toBe(true);
  });

  it('returns true when user is any org member (even viewer)', async () => {
    const db = createSequentialDb(
      [{ createdBy: 'user-other', orgId: 'org-1' }],
      [{ role: 'viewer' }],
    );

    const result = await canViewResults(db, 'user-viewer', 'assess-1');

    expect(result).toBe(true);
  });

  it('returns false when user is not in the org', async () => {
    const db = createSequentialDb(
      [{ createdBy: 'user-other', orgId: 'org-1' }],
      [],
    );

    const result = await canViewResults(db, 'user-stranger', 'assess-1');

    expect(result).toBe(false);
  });

  it('returns false when assessment does not exist', async () => {
    const db = createSequentialDb([]);

    const result = await canViewResults(db, 'user-1', 'nonexistent');

    expect(result).toBe(false);
  });

  it('returns false when assessment has no orgId and user is not creator', async () => {
    const db = createSequentialDb(
      [{ createdBy: 'user-other', orgId: null }],
    );

    const result = await canViewResults(db, 'user-1', 'assess-1');

    expect(result).toBe(false);
  });
});

describe('getUserOrgIds', () => {
  it('returns list of org IDs for user', async () => {
    const { db } = createDbNoLimit([
      { orgId: 'org-1' },
      { orgId: 'org-2' },
      { orgId: 'org-3' },
    ]);

    const ids = await getUserOrgIds(db, 'user-1');

    expect(ids).toEqual(['org-1', 'org-2', 'org-3']);
  });

  it('returns empty array when user has no orgs', async () => {
    const { db } = createDbNoLimit([]);

    const ids = await getUserOrgIds(db, 'user-lonely');

    expect(ids).toEqual([]);
  });
});

describe('hasActiveSubscription', () => {
  it('returns true when subscription status is active', async () => {
    const { db } = createDb([
      { subscriptionStatus: 'active', subscriptionEndsAt: null, trialEndsAt: null },
    ]);

    const result = await hasActiveSubscription(db, 'org-1');

    expect(result).toBe(true);
  });

  it('returns true when canceled but end date is in the future', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // tomorrow
    const { db } = createDb([
      { subscriptionStatus: 'canceled', subscriptionEndsAt: futureDate, trialEndsAt: null },
    ]);

    const result = await hasActiveSubscription(db, 'org-1');

    expect(result).toBe(true);
  });

  it('returns false when canceled and end date has passed', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // yesterday
    const { db } = createDb([
      { subscriptionStatus: 'canceled', subscriptionEndsAt: pastDate, trialEndsAt: null },
    ]);

    const result = await hasActiveSubscription(db, 'org-1');

    expect(result).toBe(false);
  });

  it('returns false when canceled with no end date', async () => {
    const { db } = createDb([
      { subscriptionStatus: 'canceled', subscriptionEndsAt: null, trialEndsAt: null },
    ]);

    const result = await hasActiveSubscription(db, 'org-1');

    expect(result).toBe(false);
  });

  it('returns false when subscription status is none', async () => {
    const { db } = createDb([
      { subscriptionStatus: 'none', subscriptionEndsAt: null, trialEndsAt: null },
    ]);

    const result = await hasActiveSubscription(db, 'org-1');

    expect(result).toBe(false);
  });

  it('returns false when subscription status is past_due', async () => {
    const { db } = createDb([
      { subscriptionStatus: 'past_due', subscriptionEndsAt: null, trialEndsAt: null },
    ]);

    const result = await hasActiveSubscription(db, 'org-1');

    expect(result).toBe(false);
  });

  it('returns false when org does not exist', async () => {
    const { db } = createDb([]);

    const result = await hasActiveSubscription(db, 'org-missing');

    expect(result).toBe(false);
  });

  it('returns true when on active trial (no paid subscription)', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 15).toISOString();
    const { db } = createDb([
      { subscriptionStatus: 'none', subscriptionEndsAt: null, trialEndsAt: futureDate },
    ]);

    const result = await hasActiveSubscription(db, 'org-1');

    expect(result).toBe(true);
  });

  it('returns false when trial has expired (no paid subscription)', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const { db } = createDb([
      { subscriptionStatus: 'none', subscriptionEndsAt: null, trialEndsAt: pastDate },
    ]);

    const result = await hasActiveSubscription(db, 'org-1');

    expect(result).toBe(false);
  });
});

describe('requireTeamAccount', () => {
  it('returns null when user has team account type', async () => {
    const { db } = createDb([{ accountType: 'team' }]);

    const result = await requireTeamAccount(db, 'user-1');

    expect(result).toBeNull();
  });

  it('returns 403 when user has individual account type', async () => {
    const { db } = createDb([{ accountType: 'individual' }]);

    const result = await requireTeamAccount(db, 'user-1');

    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    const body = await result!.json();
    expect(body).toEqual({ error: 'Team account required', code: 'TEAM_REQUIRED' });
  });

  it('returns 403 when profile does not exist', async () => {
    const { db } = createDb([]);

    const result = await requireTeamAccount(db, 'user-missing');

    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Trial helpers
// ---------------------------------------------------------------------------

describe('getTrialStatus', () => {
  it('returns null when org has no trial', async () => {
    const { db } = createDb([
      { trialStartedAt: null, trialEndsAt: null, trialAssessmentsUsed: 0, trialInvitesUsed: 0 },
    ]);

    const result = await getTrialStatus(db, 'org-1');

    expect(result).toBeNull();
  });

  it('returns active trial status with correct fields', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 15).toISOString(); // 15 days from now
    const { db } = createDb([
      { trialStartedAt: new Date().toISOString(), trialEndsAt: futureDate, trialAssessmentsUsed: 1, trialInvitesUsed: 2 },
    ]);

    const result = await getTrialStatus(db, 'org-1');

    expect(result).not.toBeNull();
    expect(result!.isActive).toBe(true);
    expect(result!.daysRemaining).toBeGreaterThan(0);
    expect(result!.assessmentsUsed).toBe(1);
    expect(result!.assessmentsLimit).toBe(TRIAL_MAX_ASSESSMENTS);
    expect(result!.invitesUsed).toBe(2);
    expect(result!.invitesLimit).toBe(TRIAL_MAX_INVITES);
  });

  it('returns expired trial status when trial end date has passed', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // yesterday
    const { db } = createDb([
      { trialStartedAt: new Date(Date.now() - 86400000 * 31).toISOString(), trialEndsAt: pastDate, trialAssessmentsUsed: 1, trialInvitesUsed: 3 },
    ]);

    const result = await getTrialStatus(db, 'org-1');

    expect(result).not.toBeNull();
    expect(result!.isActive).toBe(false);
    expect(result!.daysRemaining).toBe(0);
  });

  it('returns null when org does not exist', async () => {
    const { db } = createDb([]);

    const result = await getTrialStatus(db, 'org-missing');

    expect(result).toBeNull();
  });
});

describe('isOnActiveTrial', () => {
  it('returns true when trial is active', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 15).toISOString();
    const { db } = createDb([{ trialEndsAt: futureDate }]);

    const result = await isOnActiveTrial(db, 'org-1');

    expect(result).toBe(true);
  });

  it('returns false when trial has expired', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const { db } = createDb([{ trialEndsAt: pastDate }]);

    const result = await isOnActiveTrial(db, 'org-1');

    expect(result).toBe(false);
  });

  it('returns false when no trial exists', async () => {
    const { db } = createDb([{ trialEndsAt: null }]);

    const result = await isOnActiveTrial(db, 'org-1');

    expect(result).toBe(false);
  });

  it('returns false when org does not exist', async () => {
    const { db } = createDb([]);

    const result = await isOnActiveTrial(db, 'org-missing');

    expect(result).toBe(false);
  });
});

describe('canStartTrial', () => {
  // canStartTrial does multiple DB queries sequentially:
  // 1) select from profiles (trialUsed, accountType)
  // 2) getUserOrg → select from orgMembers join organizations (org+role)

  function createSequentialDb(...callResults: unknown[][]) {
    let callIndex = 0;
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockImplementation(() => {
      const result = callResults[callIndex] ?? [];
      callIndex++;
      return Promise.resolve(result);
    });
    return chain as any;
  }

  it('returns eligible when user has not used trial and has no subscription', async () => {
    const db = createSequentialDb(
      [{ trialUsed: 0, accountType: 'individual' }], // profile query
      [], // getUserOrg returns no org
    );

    const result = await canStartTrial(db, 'user-1');

    expect(result).toEqual({ eligible: true });
  });

  it('returns not eligible when trial already used', async () => {
    const db = createSequentialDb(
      [{ trialUsed: 1, accountType: 'team' }],
    );

    const result = await canStartTrial(db, 'user-1');

    expect(result).toEqual({ eligible: false, reason: 'Trial already used' });
  });

  it('returns not eligible when profile not found', async () => {
    const db = createSequentialDb([]);

    const result = await canStartTrial(db, 'user-missing');

    expect(result).toEqual({ eligible: false, reason: 'Profile not found' });
  });

  it('returns not eligible when user has active subscription', async () => {
    const db = createSequentialDb(
      [{ trialUsed: 0, accountType: 'team' }], // profile
      [{ org: { id: 'org-1', subscriptionStatus: 'active' }, role: 'owner' }], // getUserOrg
    );

    const result = await canStartTrial(db, 'user-1');

    expect(result).toEqual({ eligible: false, reason: 'Already subscribed' });
  });

  it('returns eligible when user has org but no active subscription', async () => {
    const db = createSequentialDb(
      [{ trialUsed: 0, accountType: 'team' }], // profile
      [{ org: { id: 'org-1', subscriptionStatus: 'none' }, role: 'owner' }], // getUserOrg
    );

    const result = await canStartTrial(db, 'user-1');

    expect(result).toEqual({ eligible: true });
  });
});

describe('trial constants', () => {
  it('exports expected trial constants', () => {
    expect(TRIAL_DURATION_DAYS).toBe(30);
    expect(TRIAL_MAX_ASSESSMENTS).toBe(1);
    expect(TRIAL_MAX_INVITES).toBe(3);
  });
});
