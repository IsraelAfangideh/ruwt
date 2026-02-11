/**
 * GET/POST /api/assessments/:id/invites
 * List or create invite links for an assessment.
 * Auth required (must be creator).
 */
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import { assessments, assessmentInvites } from '../../../../drizzle/schema.d1';

const createInviteSchema = z.object({
  candidateEmail: z.string().email().optional(),
  expiresInDays: z.number().int().min(1).max(90).optional().default(30),
});

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = createInviteSchema.safeParse(body);
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

    if (assessment.status !== 'active') {
      return Response.json(
        { error: 'Assessment must be active to create invites' },
        { status: 400 }
      );
    }

    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (parsed.data.expiresInDays ?? 30));

    const inviteId = crypto.randomUUID();
    await db.insert(assessmentInvites).values({
      id: inviteId,
      assessmentId: context.params.id,
      candidateEmail: parsed.data.candidateEmail ?? null,
      token,
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
    });

    const [invite] = await db
      .select()
      .from(assessmentInvites)
      .where(eq(assessmentInvites.id, inviteId))
      .limit(1);

    return Response.json({
      ...invite,
      url: `${new URL(context.request.url).origin}/assess/${token}`,
    }, { status: 201 });
  } catch (error) {
    console.error('Create invite error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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

    const invites = await db
      .select()
      .from(assessmentInvites)
      .where(eq(assessmentInvites.assessmentId, context.params.id))
      .orderBy(desc(assessmentInvites.createdAt));

    return Response.json(invites);
  } catch (error) {
    console.error('List invites error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
