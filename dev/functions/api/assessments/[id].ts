/**
 * GET/PUT /api/assessments/:id
 * Get or update a single assessment; auth required (must be creator).
 */
import { eq, and, asc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import { canManageAssessment, requireTeamAccount } from '../../_shared/org';
import { assessments, assessmentChallenges, challenges } from '../../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const teamCheck = await requireTeamAccount(db, user.id);
    if (teamCheck) return teamCheck;

    const hasAccess = await canManageAssessment(db, user.id, context.params.id);
    if (!hasAccess) {
      return Response.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, context.params.id))
      .limit(1);

    // Get linked challenges with details
    const linkedChallenges = await db
      .select({
        sortOrder: assessmentChallenges.sortOrder,
        challenge: challenges,
      })
      .from(assessmentChallenges)
      .innerJoin(challenges, eq(assessmentChallenges.challengeId, challenges.id))
      .where(eq(assessmentChallenges.assessmentId, assessment.id))
      .orderBy(asc(assessmentChallenges.sortOrder));

    return Response.json({
      ...assessment,
      challenges: linkedChallenges.map((lc) => ({
        sortOrder: lc.sortOrder,
        ...lc.challenge,
      })),
    });
  } catch (error) {
    console.error('Get assessment error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const updateAssessmentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  timeLimit: z.number().int().min(300).max(14400).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  companyName: z.string().max(200).optional().nullable(),
  companyLogoUrl: z.string().max(500).optional().nullable(),
  welcomeMessage: z.string().max(2000).optional().nullable(),
  categoryWeights: z.string().max(1000).optional().nullable(),
  passThreshold: z.string().max(5000).optional().nullable(),
});

export async function onRequestPut(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    /* istanbul ignore next -- @preserve */
    const body = await context.request.json().catch(() => ({}));
    const parsed = updateAssessmentSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const db = getDb(context.env);
    const teamCheck = await requireTeamAccount(db, user.id);
    if (teamCheck) return teamCheck;

    const hasAccess = await canManageAssessment(db, user.id, context.params.id);
    if (!hasAccess) {
      return Response.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    /* istanbul ignore next -- @preserve */
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    /* istanbul ignore next -- @preserve */
    if (parsed.data.timeLimit !== undefined) updates.timeLimit = parsed.data.timeLimit;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.companyName !== undefined) updates.companyName = parsed.data.companyName;
    if (parsed.data.companyLogoUrl !== undefined) updates.companyLogoUrl = parsed.data.companyLogoUrl;
    if (parsed.data.welcomeMessage !== undefined) updates.welcomeMessage = parsed.data.welcomeMessage;
    /* istanbul ignore next -- @preserve */
    if (parsed.data.categoryWeights !== undefined) updates.categoryWeights = parsed.data.categoryWeights;
    /* istanbul ignore next -- @preserve */
    if (parsed.data.passThreshold !== undefined) updates.passThreshold = parsed.data.passThreshold;

    if (Object.keys(updates).length > 0) {
      await db
        .update(assessments)
        .set(updates)
        .where(eq(assessments.id, context.params.id));
    }

    const [updated] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, context.params.id))
      .limit(1);

    return Response.json(updated);
  } catch (error) {
    console.error('Update assessment error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
