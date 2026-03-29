/**
 * POST /api/assess/takehome/submit
 * Submit the take-home assessment.
 * Auth required (candidate).
 */
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../_shared/infra/db';
import { getUser } from '../../../_shared/infra/auth';
import {
  assessmentSessions,
  assessmentTelemetry,
} from '../../../../drizzle/schema.d1';

const submitSchema = z.object({
  sessionId: z.string().min(1),
  files: z.record(z.string(), z.string()),
});

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = submitSchema.safeParse(body);
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

    // Record the submitted files as a telemetry event
    await db.insert(assessmentTelemetry).values({
      id: crypto.randomUUID(),
      sessionId: session.id,
      eventType: 'file_change',
      data: JSON.stringify({ type: 'final_submission', files: parsed.data.files }),
    });

    // Compute basic AFI-like score from telemetry
    const telemetryEvents = await db
      .select()
      .from(assessmentTelemetry)
      .where(eq(assessmentTelemetry.sessionId, session.id));

    const aiCalls = telemetryEvents.filter((e) => e.eventType === 'ai_call');
    let totalCost = 0;
    const modelsUsed = new Set<string>();
    for (const call of aiCalls) {
      try {
        const data = JSON.parse(call.data);
        totalCost += typeof data.cost === 'number' ? data.cost : 0;
        if (data.model) modelsUsed.add(data.model);
      } catch { /* ignore */ }
    }

    // Mark session as completed
    await db
      .update(assessmentSessions)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      .where(eq(assessmentSessions.id, session.id));

    return Response.json({
      shareToken: session.shareToken,
      summary: {
        totalCost,
        aiCallCount: aiCalls.length,
        modelsUsed: Array.from(modelsUsed),
        fileCount: Object.keys(parsed.data.files).length,
        totalEvents: telemetryEvents.length,
      },
    });
  } catch (error) {
    console.error('Submit takehome error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
