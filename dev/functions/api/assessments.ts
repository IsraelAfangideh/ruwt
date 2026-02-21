/**
 * GET/POST /api/assessments
 * List or create assessments; auth required.
 */
import { eq, desc, and, sql, or, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { getUserOrgIds, requireOrgAccess } from '../_shared/org';
import { assessments, assessmentChallenges, assessmentInvites, assessmentSessions } from '../../drizzle/schema.d1';

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

    const body = await context.request.json().catch(() => ({}));
    const parsed = createAssessmentSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const db = getDb(context.env);

    // If orgId provided, verify user is admin/owner in that org
    if (parsed.data.orgId) {
      const role = await requireOrgAccess(db, user.id, parsed.data.orgId, 'admin');
      if (!role) {
        return Response.json({ error: 'Insufficient org permissions' }, { status: 403 });
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

    // For each assessment, get challenge count + invite/completion stats
    const results = await Promise.all(
      list.map(async (a) => {
        const [challengeLinks, invites, completions] = await Promise.all([
          db.select().from(assessmentChallenges).where(eq(assessmentChallenges.assessmentId, a.id)),
          db.select({ count: sql<number>`count(*)` }).from(assessmentInvites).where(eq(assessmentInvites.assessmentId, a.id)),
          db.select({ count: sql<number>`count(*)` }).from(assessmentSessions).where(and(eq(assessmentSessions.assessmentId, a.id), eq(assessmentSessions.status, 'completed'))),
        ]);
        return {
          ...a,
          challengeCount: challengeLinks.length,
          inviteCount: invites[0]?.count ?? 0,
          completionCount: completions[0]?.count ?? 0,
        };
      })
    );

    return Response.json(results);
  } catch (error) {
    console.error('List assessments error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
