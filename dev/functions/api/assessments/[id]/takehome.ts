/**
 * GET /api/assessments/:id/takehome
 * Company views take-home results for a specific assessment.
 * Auth required, must be org owner/admin or assessment creator.
 */
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import { canViewResults } from '../../../_shared/org';
import {
  assessmentSessions,
  assessmentTelemetry,
  profiles,
} from '../../../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);

    const hasAccess = await canViewResults(db, user.id, context.params.id);
    if (!hasAccess) {
      return Response.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Get all sessions with user profiles
    const sessions = await db
      .select({
        session: assessmentSessions,
        user: {
          id: profiles.id,
          name: profiles.name,
          email: profiles.email,
          avatarUrl: profiles.avatarUrl,
        },
      })
      .from(assessmentSessions)
      .innerJoin(profiles, eq(assessmentSessions.userId, profiles.id))
      .where(eq(assessmentSessions.assessmentId, context.params.id));

    const sessionIds = sessions.map((s) => s.session.id);

    // Bulk fetch all telemetry for these sessions
    const allTelemetry = sessionIds.length > 0
      ? await db.select().from(assessmentTelemetry).where(
          sql`${assessmentTelemetry.sessionId} IN (${sql.join(sessionIds.map((id) => sql`${id}`), sql`, `)})`
        )
      : [];

    // Index by session ID
    const telemetryBySession = new Map<string, typeof allTelemetry>();
    for (const event of allTelemetry) {
      if (!telemetryBySession.has(event.sessionId)) telemetryBySession.set(event.sessionId, []);
      telemetryBySession.get(event.sessionId)!.push(event);
    }

    const results = sessions.map(({ session, user: candidate }) => {
      const events = telemetryBySession.get(session.id) ?? [];
      const aiCalls = events.filter((e) => e.eventType === 'ai_call');
      const fileChanges = events.filter((e) => e.eventType === 'file_change');

      let totalCost = 0;
      const modelsUsed = new Set<string>();
      for (const call of aiCalls) {
        try {
          const data = JSON.parse(call.data);
          totalCost += typeof data.cost === 'number' ? data.cost : 0;
          if (data.model) modelsUsed.add(data.model);
        } catch { /* ignore */ }
      }

      // Calculate time spent
      const startedAt = new Date(session.startedAt).getTime();
      const endedAt = session.completedAt
        ? new Date(session.completedAt).getTime()
        : Date.now();
      const timeSpentSeconds = Math.round((endedAt - startedAt) / 1000);

      return {
        session: {
          id: session.id,
          status: session.status,
          startedAt: session.startedAt,
          completedAt: session.completedAt,
          shareToken: session.shareToken,
        },
        candidate,
        telemetrySummary: {
          totalCost,
          aiCallCount: aiCalls.length,
          modelsUsed: Array.from(modelsUsed),
          fileChangesCount: fileChanges.length,
          timeSpentSeconds,
          totalEvents: events.length,
        },
      };
    });

    return Response.json(results);
  } catch (error) {
    console.error('Takehome results error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
