/**
 * Organization membership helpers.
 * Used by assessment endpoints to check team access.
 */
import { eq, and, sql } from 'drizzle-orm';
import type { Db } from './db';
import {
  organizations, orgMembers, assessments, profiles,
  type OrgRole,
} from '../../drizzle/schema.d1';

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

/** Check if an org has an active subscription (or is within a canceled subscription's paid period). */
export async function hasActiveSubscription(db: Db, orgId: string): Promise<boolean> {
  const [org] = await db
    .select({
      subscriptionStatus: organizations.subscriptionStatus,
      subscriptionEndsAt: organizations.subscriptionEndsAt,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) return false;

  if (org.subscriptionStatus === 'active') return true;

  // Canceled but still within paid period
  if (org.subscriptionStatus === 'canceled' && org.subscriptionEndsAt) {
    return new Date(org.subscriptionEndsAt) > new Date();
  }

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
