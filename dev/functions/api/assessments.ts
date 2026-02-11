/**
 * GET/POST /api/assessments
 * List or create assessments; auth required.
 */
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { assessments, assessmentChallenges, challenges } from '../../drizzle/schema.d1';

const createAssessmentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  timeLimit: z.number().int().min(300).max(14400), // 5 min to 4 hours
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
    const assessmentId = crypto.randomUUID();

    await db.insert(assessments).values({
      id: assessmentId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      timeLimit: parsed.data.timeLimit,
      status: 'draft',
      createdBy: user.id,
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

    const list = await db
      .select()
      .from(assessments)
      .where(eq(assessments.createdBy, user.id))
      .orderBy(desc(assessments.createdAt));

    // For each assessment, get challenge count
    const results = await Promise.all(
      list.map(async (a) => {
        const challengeLinks = await db
          .select()
          .from(assessmentChallenges)
          .where(eq(assessmentChallenges.assessmentId, a.id));
        return { ...a, challengeCount: challengeLinks.length };
      })
    );

    return Response.json(results);
  } catch (error) {
    console.error('List assessments error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
