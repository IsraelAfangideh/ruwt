/**
 * POST /api/assess/takehome/telemetry
 * Record a telemetry event for a take-home session.
 * Auth required (candidate).
 */
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../_shared/infra/db';
import { getUser } from '../../../_shared/infra/auth';
import {
  assessmentSessions,
  assessmentTelemetry,
} from '../../../../drizzle/schema.d1';

const telemetrySchema = z.object({
  sessionId: z.string().min(1),
  eventType: z.enum(['ai_call', 'file_change', 'test_run']),
  data: z.record(z.string(), z.unknown()).default({}),
});

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = telemetrySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const db = getDb(context.env);

    // Verify session belongs to user and is in progress
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

    if (session.status !== 'in_progress') {
      return Response.json({ error: 'Session is not active' }, { status: 400 });
    }

    // Insert telemetry event
    const id = crypto.randomUUID();
    await db.insert(assessmentTelemetry).values({
      id,
      sessionId: parsed.data.sessionId,
      eventType: parsed.data.eventType,
      data: JSON.stringify(parsed.data.data),
    });

    // If it's an AI call, atomically increment session totals
    if (parsed.data.eventType === 'ai_call') {
      const aiData = parsed.data.data as { cost?: number; inputTokens?: number; outputTokens?: number };
      const cost = typeof aiData.cost === 'number' ? aiData.cost : 0;
      const tokens = (typeof aiData.inputTokens === 'number' ? aiData.inputTokens : 0)
        + (typeof aiData.outputTokens === 'number' ? aiData.outputTokens : 0);

      await db
        .update(assessmentSessions)
        .set({
          totalCost: sql`${assessmentSessions.totalCost} + ${cost}`,
          totalTokens: sql`${assessmentSessions.totalTokens} + ${tokens}`,
        })
        .where(eq(assessmentSessions.id, session.id));
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Telemetry error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
