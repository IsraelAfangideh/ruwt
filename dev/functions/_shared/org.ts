/**
 * Organization membership helpers.
 * Used by assessment endpoints to check team access.
 */
import { eq, and, sql } from 'drizzle-orm';
import type { Db } from './infra/db';
import {
  organizations, orgMembers, assessments, profiles,
  type OrgRole,
} from '../../drizzle/schema.d1';

// ─── Trial Constants ───────────────────────────────────────────────────────

export const TRIAL_DURATION_DAYS = 30;
export const TRIAL_MAX_ASSESSMENTS = 1;
export const TRIAL_MAX_INVITES = 3;

export interface TrialStatus {
  isActive: boolean;
  daysRemaining: number;
  assessmentsUsed: number;
  assessmentsLimit: number;
  invitesUsed: number;
  invitesLimit: number;
}

/** Get trial status for an org. Returns null if org has no trial. */
export async function getTrialStatus(db: Db, orgId: string): Promise<TrialStatus | null> {
  const [org] = await db
    .select({
      trialStartedAt: organizations.trialStartedAt,
      trialEndsAt: organizations.trialEndsAt,
      trialAssessmentsUsed: organizations.trialAssessmentsUsed,
      trialInvitesUsed: organizations.trialInvitesUsed,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org || !org.trialEndsAt) return null;

  const now = new Date();
  const endsAt = new Date(org.trialEndsAt);
  const daysRemaining = Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const isActive = endsAt > now;

  return {
    isActive,
    daysRemaining,
    assessmentsUsed: org.trialAssessmentsUsed,
    assessmentsLimit: TRIAL_MAX_ASSESSMENTS,
    invitesUsed: org.trialInvitesUsed,
    invitesLimit: TRIAL_MAX_INVITES,
  };
}

/** Lightweight check: is this org on an active trial? */
export async function isOnActiveTrial(db: Db, orgId: string): Promise<boolean> {
  const [org] = await db
    .select({ trialEndsAt: organizations.trialEndsAt })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (!org || !org.trialEndsAt) return false;
  return new Date(org.trialEndsAt) > new Date();
}

/**
 * Atomically claim a trial slot (assessment or invite).
 * Checks trial active + not paid + counter < limit in a single UPDATE.
 * Returns 'claimed' if slot acquired, 'limit_reached' if at limit, 'not_trial' if not on trial or paid.
 */
/* istanbul ignore next -- @preserve */
export async function claimTrialSlot(
  db: Db,
  orgId: string,
  kind: 'assessments' | 'invites',
/* istanbul ignore next -- @preserve */
): Promise<'claimed' | 'limit_reached' | 'not_trial'> {
  /* istanbul ignore next -- @preserve */
  const [org] = await db
    .select({
      trialEndsAt: organizations.trialEndsAt,
      subscriptionStatus: organizations.subscriptionStatus,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  /* istanbul ignore next -- @preserve */
  if (!org?.trialEndsAt || new Date(org.trialEndsAt) <= new Date()) return 'not_trial';
  /* istanbul ignore next -- @preserve */
  if (org.subscriptionStatus === 'active') return 'not_trial';

  /* istanbul ignore next -- @preserve */
  const limit = kind === 'assessments' ? TRIAL_MAX_ASSESSMENTS : TRIAL_MAX_INVITES;

  // Column name is from a fixed union type, safe to interpolate.
  // orgId and limit are parameterized via sql template.
  /* istanbul ignore next -- @preserve */
  const result = kind === 'assessments'
    /* istanbul ignore next -- @preserve */
    ? await db.run(sql`UPDATE organizations SET trial_assessments_used = trial_assessments_used + 1 WHERE id = ${orgId} AND trial_assessments_used < ${limit}`)
    /* istanbul ignore next -- @preserve */
    : await db.run(sql`UPDATE organizations SET trial_invites_used = trial_invites_used + 1 WHERE id = ${orgId} AND trial_invites_used < ${limit}`);

  /* istanbul ignore next -- @preserve */
  return result.meta?.changes ? 'claimed' : 'limit_reached';
}

/** Check if a user can start a free trial. */
export async function canStartTrial(
  db: Db,
  userId: string,
): Promise<{ eligible: boolean; reason?: string }> {
  const [profile] = await db
    .select({ trialUsed: profiles.trialUsed, accountType: profiles.accountType })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!profile) return { eligible: false, reason: 'Profile not found' };
  if (profile.trialUsed) return { eligible: false, reason: 'Trial already used' };

  // Check if user already has an active subscription
  const userOrg = await getUserOrg(db, userId);
  if (userOrg && (userOrg.org.subscriptionStatus === 'active' || userOrg.org.subscriptionStatus === 'past_due' || userOrg.org.subscriptionStatus === 'trialing')) {
    return { eligible: false, reason: 'Already subscribed' };
  }

  return { eligible: true };
}

// ─── Role Hierarchy ────────────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/** Get the user's primary organization (assumes one org per user for now). */
export async function getUserOrg(db: Db, userId: string) {
  const rows = await db
    .select({
      org: organizations,
      role: orgMembers.role,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, userId))
    .limit(1);
  if (!rows.length) return null;
  return { org: rows[0].org, role: rows[0].role as OrgRole };
}

/** Get user's role in a specific org. */
export async function getUserOrgRole(db: Db, userId: string, orgId: string): Promise<OrgRole | null> {
  const rows = await db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)))
    .limit(1);
  return rows.length ? (rows[0].role as OrgRole) : null;
}

/** Check org access with minimum role requirement. Returns role or null if insufficient. */
export async function requireOrgAccess(
  db: Db,
  userId: string,
  orgId: string,
  minRole: OrgRole = 'viewer'
): Promise<OrgRole | null> {
  const role = await getUserOrgRole(db, userId, orgId);
  if (!role) return null;
  if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minRole]) return null;
  return role;
}

/** Check if user can manage (create/edit/invite) an assessment. */
export async function canManageAssessment(db: Db, userId: string, assessmentId: string): Promise<boolean> {
  const [assessment] = await db
    .select({ createdBy: assessments.createdBy, orgId: assessments.orgId })
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .limit(1);
  if (!assessment) return false;
  // Direct creator always has access
  if (assessment.createdBy === userId) return true;
  // Org admin/owner can manage
  if (assessment.orgId) {
    const role = await requireOrgAccess(db, userId, assessment.orgId, 'admin');
    return role !== null;
  }
  return false;
}

/** Check if user can view assessment results. Any org member can view. */
export async function canViewResults(db: Db, userId: string, assessmentId: string): Promise<boolean> {
  const [assessment] = await db
    .select({ createdBy: assessments.createdBy, orgId: assessments.orgId })
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .limit(1);
  if (!assessment) return false;
  if (assessment.createdBy === userId) return true;
  if (assessment.orgId) {
    const role = await getUserOrgRole(db, userId, assessment.orgId);
    return role !== null;
  }
  return false;
}

/** Get all org IDs a user belongs to. */
export async function getUserOrgIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId));
  return rows.map((r) => r.orgId);
}

/** Check if an org has an active subscription, canceled-but-still-paid period, or active trial. */
export async function hasActiveSubscription(db: Db, orgId: string): Promise<boolean> {
  const [org] = await db
    .select({
      subscriptionStatus: organizations.subscriptionStatus,
      subscriptionEndsAt: organizations.subscriptionEndsAt,
      trialEndsAt: organizations.trialEndsAt,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) return false;

  if (org.subscriptionStatus === 'active' || org.subscriptionStatus === 'trialing') return true;

  // Canceled but still within paid period
  if (org.subscriptionStatus === 'canceled' && org.subscriptionEndsAt) {
    if (new Date(org.subscriptionEndsAt) > new Date()) return true;
  }

  // Active trial
  if (org.trialEndsAt && new Date(org.trialEndsAt) > new Date()) return true;

  return false;
}

/** Check if user has a team account type. Returns 403 Response or null if authorized. */
export async function requireTeamAccount(db: Db, userId: string): Promise<Response | null> {
  const [profile] = await db
    .select({ accountType: profiles.accountType })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!profile || profile.accountType !== 'team') {
    return Response.json(
      { error: 'Team account required', code: 'TEAM_REQUIRED' },
      { status: 403 },
    );
  }
  return null;
}
