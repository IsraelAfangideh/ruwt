/**
 * GET    /api/orgs/:orgId/challenges/:challengeId — Get single custom challenge (any member)
 * PUT    /api/orgs/:orgId/challenges/:challengeId — Update custom challenge (admin/owner)
 * DELETE /api/orgs/:orgId/challenges/:challengeId — Delete draft challenge (admin/owner)
 * Auth required for all.
 */
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../../_shared/db';
import { getUser } from '../../../../_shared/auth';
import { requireOrgAccess } from '../../../../_shared/org';
import { customChallenges } from '../../../../../drizzle/schema.d1';

const updateChallengeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(10000).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  category: z.string().max(100).optional(),
  skillTested: z.string().max(500).optional(),
  language: z.enum(['javascript', 'typescript', 'python']).optional(),
  starterCode: z.string().max(50000).optional(),
  testCases: z.string().max(50000).optional(),
  hiddenTestCases: z.string().max(50000).optional(),
  testHarness: z.string().max(50000).optional(),
  tags: z.string().max(2000).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

// Valid status transitions: draft→active, active→archived, draft→archived
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'archived'],
  active: ['archived'],
  archived: [],
};

export async function onRequestGet(context: { request: Request; env: Env; params: { orgId: string; challengeId: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const { orgId, challengeId } = context.params;

    // Any org member can view
    const role = await requireOrgAccess(db, user.id, orgId, 'viewer');
    if (!role) {
      return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    const [challenge] = await db
      .select()
      .from(customChallenges)
      .where(and(eq(customChallenges.id, challengeId), eq(customChallenges.orgId, orgId)))
      .limit(1);

    if (!challenge) {
      return Response.json({ error: 'Challenge not found' }, { status: 404 });
    }

    return Response.json(challenge);
  } catch (error) {
    console.error('Get custom challenge error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestPut(context: { request: Request; env: Env; params: { orgId: string; challengeId: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const { orgId, challengeId } = context.params;

    // Admin or owner required
    const callerRole = await requireOrgAccess(db, user.id, orgId, 'admin');
    if (!callerRole) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Verify challenge belongs to this org
    const [existing] = await db
      .select()
      .from(customChallenges)
      .where(and(eq(customChallenges.id, challengeId), eq(customChallenges.orgId, orgId)))
      .limit(1);

    if (!existing) {
      return Response.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const body = await context.request.json().catch(() => ({}));
    const parsed = updateChallengeSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate status transition if status is being changed
    if (data.status && data.status !== existing.status) {
      const allowedTransitions = VALID_STATUS_TRANSITIONS[existing.status] || [];
      if (!allowedTransitions.includes(data.status)) {
        return Response.json(
          { error: `Cannot transition from '${existing.status}' to '${data.status}'` },
          { status: 400 }
        );
      }
    }

    // Build the update object, only including provided fields
    const updateFields: Record<string, unknown> = {};
    if (data.title !== undefined) updateFields.title = data.title;
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.difficulty !== undefined) updateFields.difficulty = data.difficulty;
    if (data.category !== undefined) updateFields.category = data.category;
    if (data.skillTested !== undefined) updateFields.skillTested = data.skillTested;
    if (data.language !== undefined) updateFields.language = data.language;
    if (data.starterCode !== undefined) updateFields.starterCode = data.starterCode;
    if (data.testCases !== undefined) updateFields.testCases = data.testCases;
    if (data.hiddenTestCases !== undefined) updateFields.hiddenTestCases = data.hiddenTestCases;
    if (data.testHarness !== undefined) updateFields.testHarness = data.testHarness;
    if (data.tags !== undefined) updateFields.tags = data.tags;
    if (data.status !== undefined) updateFields.status = data.status;

    // When approving (draft → active), record reviewer
    if (data.status === 'active' && existing.status === 'draft') {
      updateFields.reviewedBy = user.id;
      updateFields.reviewedAt = new Date().toISOString();
    }

    if (Object.keys(updateFields).length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    await db
      .update(customChallenges)
      .set(updateFields)
      .where(and(eq(customChallenges.id, challengeId), eq(customChallenges.orgId, orgId)));

    const [updated] = await db
      .select()
      .from(customChallenges)
      .where(eq(customChallenges.id, challengeId))
      .limit(1);

    return Response.json(updated);
  } catch (error) {
    console.error('Update custom challenge error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestDelete(context: { request: Request; env: Env; params: { orgId: string; challengeId: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const { orgId, challengeId } = context.params;

    // Admin or owner required
    const callerRole = await requireOrgAccess(db, user.id, orgId, 'admin');
    if (!callerRole) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Verify challenge belongs to this org and is a draft
    const [existing] = await db
      .select()
      .from(customChallenges)
      .where(and(eq(customChallenges.id, challengeId), eq(customChallenges.orgId, orgId)))
      .limit(1);

    if (!existing) {
      return Response.json({ error: 'Challenge not found' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return Response.json(
        { error: 'Only draft challenges can be deleted. Archive active challenges instead.' },
        { status: 400 }
      );
    }

    await db
      .delete(customChallenges)
      .where(and(eq(customChallenges.id, challengeId), eq(customChallenges.orgId, orgId)));

    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete custom challenge error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
