/**
 * POST /api/assess/takehome/disclosure
 * Mark that the candidate accepted the telemetry disclosure.
 * Auth required (candidate).
 */
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../_shared/infra/db';
import { getUser } from '../../../_shared/infra/auth';
import { assessmentSessions } from '../../../../drizzle/schema.d1';

const disclosureSchema = z.object({
  sessionId: z.string().min(1),
});

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = disclosureSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const db = getDb(context.env);

    // Verify session belongs to user
    const [session] = await db
      .select()
      .from(assessmentSessions)
      .where(
        and(
          eq(assessmentSessions.id, parsed.data.sessionId),
          eq(assessmentSessions.userId, user.id),
        ),
      )
      .limit(1);

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update disclosure flag
    await db
      .update(assessmentSessions)
      .set({ disclosureAccepted: 1 })
      .where(eq(assessmentSessions.id, session.id));

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Disclosure error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
