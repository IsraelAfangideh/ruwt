/**
 * PUT /api/assessments/:id/challenges
 * Set the challenges for an assessment (replaces all existing).
 * Auth required (must be creator).
 */
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import { assessments, assessmentChallenges, challenges } from '../../../../drizzle/schema.d1';

const setChallengesSchema = z.object({
  challengeIds: z.array(z.string()).min(1).max(20),
});

export async function onRequestPut(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = setChallengesSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const db = getDb(context.env);

    const [assessment] = await db
      .select()
      .from(assessments)
      .where(
        and(eq(assessments.id, context.params.id), eq(assessments.createdBy, user.id))
      )
      .limit(1);

    if (!assessment) {
      return Response.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Verify all challenge IDs exist
    const existingChallenges = await db.select().from(challenges);
    const validIds = new Set(existingChallenges.map((c) => c.id));
    const invalid = parsed.data.challengeIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      return Response.json(
        { error: 'Invalid challenge IDs', invalidIds: invalid },
        { status: 400 }
      );
    }

    // Delete existing links
    await db
      .delete(assessmentChallenges)
      .where(eq(assessmentChallenges.assessmentId, context.params.id));

    // Insert new links with sort order
    for (let i = 0; i < parsed.data.challengeIds.length; i++) {
      await db.insert(assessmentChallenges).values({
        id: crypto.randomUUID(),
        assessmentId: context.params.id,
        challengeId: parsed.data.challengeIds[i],
        sortOrder: i,
      });
    }

    return Response.json({ success: true, count: parsed.data.challengeIds.length });
  } catch (error) {
    console.error('Set assessment challenges error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
