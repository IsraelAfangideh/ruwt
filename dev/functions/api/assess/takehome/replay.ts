/**
 * POST /api/assess/takehome/replay — Append replay events to R2.
 * GET  /api/assess/takehome/replay — Read replay for a session.
 * Auth required.
 */
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../_shared/infra/db';
import { getUser } from '../../../_shared/infra/auth';
import {
  assessmentSessions,
  assessments,
  orgMembers,
} from '../../../../drizzle/schema.d1';

const eventSchema = z.object({
  type: z.enum([
    'content_snapshot',
    'ai_prompt',
    'ai_response',
    'terminal_command',
    'file_open',
    'file_close',
    'tab_switch',
    'test_run',
    'focus_change',
  ]),
  timestamp: z.number(),
  data: z.record(z.string(), z.unknown()),
});

const postSchema = z.object({
  sessionId: z.string().min(1),
  events: z.array(eventSchema).min(1),
});

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = postSchema.safeParse(body);
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

    // Require R2 bucket
    if (!context.env.PROJECTS_BUCKET) {
      return Response.json({ error: 'Storage not configured' }, { status: 500 });
    }

    const r2Key = `replay/${parsed.data.sessionId}/events.json`;

    // Read existing events (if any), append new ones, write back
    let existing: unknown[] = [];
    const obj = await context.env.PROJECTS_BUCKET.get(r2Key);
    if (obj) {
      try {
        existing = JSON.parse(await obj.text());
      } catch {
        existing = [];
      }
    }

    const combined = [...existing, ...parsed.data.events];
    await context.env.PROJECTS_BUCKET.put(r2Key, JSON.stringify(combined));

    // Update session R2 key if not already set
    if (!session.replayR2Key) {
      await db
        .update(assessmentSessions)
        .set({ replayR2Key: r2Key })
        .where(eq(assessmentSessions.id, session.id));
    }

    return Response.json({ ok: true, eventCount: combined.length });
  } catch (error) {
    console.error('Replay POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(context.request.url);
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      return Response.json({ error: 'Missing sessionId parameter' }, { status: 400 });
    }

    const db = getDb(context.env);

    // Fetch session
    const [session] = await db
      .select()
      .from(assessmentSessions)
      .where(eq(assessmentSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    // Auth: must be session owner OR org admin for the assessment
    let authorized = session.userId === user.id;
    if (!authorized) {
      // Check if user is an admin/owner of the org that owns this assessment
      const [assessment] = await db
        .select()
        .from(assessments)
        .where(eq(assessments.id, session.assessmentId))
        .limit(1);

      if (assessment?.orgId) {
        const [membership] = await db
          .select()
          .from(orgMembers)
          .where(
            and(
              eq(orgMembers.orgId, assessment.orgId),
              eq(orgMembers.userId, user.id),
            ),
          )
          .limit(1);

        if (membership && (membership.role === 'owner' || membership.role === 'admin')) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Read events from R2
    if (!context.env.PROJECTS_BUCKET) {
      return Response.json({ events: [] });
    }

    const r2Key = session.replayR2Key || `replay/${sessionId}/events.json`;
    const obj = await context.env.PROJECTS_BUCKET.get(r2Key);
    if (!obj) {
      return Response.json({ events: [] });
    }

    let events: unknown[];
    try {
      events = JSON.parse(await obj.text());
    } catch {
      events = [];
    }

    return Response.json({ events });
  } catch (error) {
    console.error('Replay GET error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
