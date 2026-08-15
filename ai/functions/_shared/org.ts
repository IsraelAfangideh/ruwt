import { eq, and } from 'drizzle-orm';
import type { User } from '@supabase/supabase-js';
import type { Db } from './db';
import { orgMembers, profiles, type OrgRole } from '../../drizzle/schema.d1';

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

export async function ensureProfile(db: Db, user: User) {
  const [existing] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(profiles).values({
    id: user.id,
    email: user.email ?? `${user.id}@users.ruwt.ai`,
    name: typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : null,
    avatarUrl: typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null,
  }).returning();

  return created;
}

export async function getUserOrgRole(db: Db, userId: string, orgId: string): Promise<OrgRole | null> {
  const rows = await db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)))
    .limit(1);
  return rows.length ? (rows[0].role as OrgRole) : null;
}

export async function requireOrgAccess(
  db: Db,
  userId: string,
  orgId: string,
  minRole: OrgRole = 'viewer',
): Promise<OrgRole | null> {
  const role = await getUserOrgRole(db, userId, orgId);
  if (!role) return null;
  if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minRole]) return null;
  return role;
}
