/**
 * PUT /api/assessments/:id/challenges
 * Set the challenges for an assessment (replaces all existing).
 * Auth required (must be creator).
 */
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import { canManageAssessment } from '../../../_shared/org';
import { assessments, assessmentChallenges, challenges } from '../../../../drizzle/schema.d1';

const setChallengesSchema = z.object({
  challengeIds: z.array(z.string()).optional().default([]),
  customChallengeIds: z.array(z.string()).optional().default([]),
}).refine(
  (data) => data.challengeIds.length + data.customChallengeIds.length >= 1,
  { message: 'At least one challenge (standard or custom) is required' }
).refine(
  (data) => data.challengeIds.length + data.customChallengeIds.length <= 20,
  { message: 'Maximum 20 challenges allowed' }
);

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

    const hasAccess = await canManageAssessment(db, user.id, context.params.id);
    if (!hasAccess) {
      return Response.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Verify all standard challenge IDs exist
    if (parsed.data.challengeIds.length > 0) {
      const existingChallenges = await db.select().from(challenges);
      const validIds = new Set(existingChallenges.map((c) => c.id));
      const invalid = parsed.data.challengeIds.filter((id: string) => !validIds.has(id));
      if (invalid.length > 0) {
        return Response.json(
          { error: 'Invalid challenge IDs', invalidIds: invalid },
          { status: 400 }
        );
      }
    }

    // Delete existing links
    await db
      .delete(assessmentChallenges)
      .where(eq(assessmentChallenges.assessmentId, context.params.id));

    let sortOrder = 0;

    // Insert standard challenge links
    for (const challengeId of parsed.data.challengeIds) {
      await db.insert(assessmentChallenges).values({
        id: crypto.randomUUID(),
        assessmentId: context.params.id,
        challengeId,
        sortOrder: sortOrder++,
      });
    }

    // Insert custom challenge links
    for (const customId of parsed.data.customChallengeIds) {
      await db.insert(assessmentChallenges).values({
        id: crypto.randomUUID(),
        assessmentId: context.params.id,
        challengeId: customId, // placeholder — use customChallengeId as challengeId
        customChallengeId: customId,
        sortOrder: sortOrder++,
      });
    }

    const totalCount = parsed.data.challengeIds.length + parsed.data.customChallengeIds.length;
    return Response.json({ success: true, count: totalCount });
  } catch (error) {
    console.error('Set assessment challenges error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
