/**
 * GET/POST /api/assessments
 * List or create assessments; auth required.
 */
import { eq, desc, and, sql, or, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { getUserOrgIds, requireOrgAccess, requireTeamAccount, getUserOrg, isOnActiveTrial, TRIAL_MAX_ASSESSMENTS } from '../_shared/org';
import { assessments, assessmentChallenges, assessmentInvites, assessmentSessions, organizations } from '../../drizzle/schema.d1';

const createAssessmentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  timeLimit: z.number().int().min(300).max(14400), // 5 min to 4 hours
  orgId: z.string().optional(),
});

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const teamCheck = await requireTeamAccount(db, user.id);
    if (teamCheck) return teamCheck;

    const body = await context.request.json().catch(() => ({}));
    const parsed = createAssessmentSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // If orgId provided, verify user is admin/owner in that org
    if (parsed.data.orgId) {
      const role = await requireOrgAccess(db, user.id, parsed.data.orgId, 'admin');
      if (!role) {
        return Response.json({ error: 'Insufficient org permissions' }, { status: 403 });
      }
    }

    // Determine the target org for trial checks (explicit orgId or user's default org)
    const userOrg = await getUserOrg(db, user.id);
    const targetOrgId = parsed.data.orgId ?? userOrg?.org.id;

    // Atomic trial limit check + increment (prevents race conditions)
    if (targetOrgId) {
      const onTrial = await isOnActiveTrial(db, targetOrgId);
      if (onTrial) {
        const [orgRow] = await db
          .select({ subscriptionStatus: organizations.subscriptionStatus })
          .from(organizations)
          .where(eq(organizations.id, targetOrgId))
          .limit(1);
        if (orgRow && orgRow.subscriptionStatus !== 'active') {
          const claimResult = await db.run(sql`
            UPDATE organizations
            SET trial_assessments_used = trial_assessments_used + 1
            WHERE id = ${targetOrgId}
              AND trial_assessments_used < ${TRIAL_MAX_ASSESSMENTS}
          `);
          if (!claimResult.meta?.changes) {
            return Response.json(
              { error: 'Trial assessment limit reached. Subscribe to create more assessments.', code: 'TRIAL_LIMIT_REACHED' },
              { status: 403 },
            );
          }
        }
      }
    }

    const assessmentId = crypto.randomUUID();

    await db.insert(assessments).values({
      id: assessmentId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      timeLimit: parsed.data.timeLimit,
      status: 'draft',
      createdBy: user.id,
      orgId: parsed.data.orgId ?? null,
    });

    const [created] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    return Response.json(created, { status: 201 });
  } catch (error) {
    console.error('Create assessment error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const teamCheck = await requireTeamAccount(db, user.id);
    if (teamCheck) return teamCheck;

    // Get org IDs the user belongs to
    const orgIds = await getUserOrgIds(db, user.id);

    // Build WHERE: personal assessments OR assessments belonging to user's orgs
    const conditions = [eq(assessments.createdBy, user.id)];
    if (orgIds.length > 0) {
      conditions.push(inArray(assessments.orgId, orgIds));
    }

    const list = await db
      .select()
      .from(assessments)
      .where(or(...conditions))
      .orderBy(desc(assessments.createdAt));

    if (list.length === 0) return Response.json([]);

    // Bulk fetch all stats in 3 queries instead of 3N queries
    const ids = list.map((a) => a.id);
    const [challengeCounts, inviteCounts, completionCounts] = await Promise.all([
      db.select({ assessmentId: assessmentChallenges.assessmentId, count: sql<number>`count(*)` })
        .from(assessmentChallenges)
        .where(inArray(assessmentChallenges.assessmentId, ids))
        .groupBy(assessmentChallenges.assessmentId),
      db.select({ assessmentId: assessmentInvites.assessmentId, count: sql<number>`count(*)` })
        .from(assessmentInvites)
        .where(inArray(assessmentInvites.assessmentId, ids))
        .groupBy(assessmentInvites.assessmentId),
      db.select({ assessmentId: assessmentSessions.assessmentId, count: sql<number>`count(*)` })
        .from(assessmentSessions)
        .where(and(inArray(assessmentSessions.assessmentId, ids), eq(assessmentSessions.status, 'completed')))
        .groupBy(assessmentSessions.assessmentId),
    ]);

    // Index by assessment ID for O(1) lookup
    const challengeMap = Object.fromEntries(challengeCounts.map((r) => [r.assessmentId, r.count]));
    const inviteMap = Object.fromEntries(inviteCounts.map((r) => [r.assessmentId, r.count]));
    const completionMap = Object.fromEntries(completionCounts.map((r) => [r.assessmentId, r.count]));

    const results = list.map((a) => ({
      ...a,
      challengeCount: challengeMap[a.id] ?? 0,
      inviteCount: inviteMap[a.id] ?? 0,
      completionCount: completionMap[a.id] ?? 0,
    }));

    return Response.json(results);
  } catch (error) {
    console.error('List assessments error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
