/**
 * POST /api/assess/takehome/start
 * Start a take-home assessment session from an invite token.
 * Auth required (candidate).
 */
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../_shared/infra/db';
import { getUser } from '../../../_shared/infra/auth';
import {
  assessments,
  assessmentInvites,
  assessmentSessions,
  profiles,
} from '../../../../drizzle/schema.d1';

const startSchema = z.object({
  token: z.string().min(1),
});

function parseAllowedModels(raw: string | null): string[] | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const db = getDb(context.env);

    // Ensure profile exists
    /* istanbul ignore next -- @preserve */
    const profileEmail = user.email ?? '';
    /* istanbul ignore next -- @preserve */
    const profileName = (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | null ?? null;
    /* istanbul ignore next -- @preserve */
    const profileAvatar = (user.user_metadata?.avatar_url as string) ?? null;
    await db
      .insert(profiles)
      .values({
        id: user.id,
        email: profileEmail,
        name: profileName,
        avatarUrl: profileAvatar,
        credits: 100,
      })
      .onConflictDoNothing({ target: profiles.id });

    // Find invite
    const [invite] = await db
      .select()
      .from(assessmentInvites)
      .where(eq(assessmentInvites.token, parsed.data.token))
      .limit(1);

    if (!invite) {
      return Response.json({ error: 'Invalid invite link' }, { status: 404 });
    }

    if (invite.status !== 'pending' && invite.status !== 'started') {
      return Response.json({ error: 'This invite has already been used or expired' }, { status: 400 });
    }

    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      await db
        .update(assessmentInvites)
        .set({ status: 'expired' })
        .where(eq(assessmentInvites.id, invite.id));
      return Response.json({ error: 'This invite has expired' }, { status: 400 });
    }

    // Get assessment — must be a take-home type
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, invite.assessmentId))
      .limit(1);

    if (!assessment || assessment.status !== 'active') {
      return Response.json({ error: 'Assessment is not available' }, { status: 400 });
    }

    if (assessment.type !== 'takehome') {
      return Response.json({ error: 'This is not a take-home assessment' }, { status: 400 });
    }

    // Check if user already has a session
    const [existingSession] = await db
      .select()
      .from(assessmentSessions)
      .where(
        and(
          eq(assessmentSessions.assessmentId, invite.assessmentId),
          eq(assessmentSessions.userId, user.id),
        ),
      )
      .limit(1);

    if (existingSession) {
      return Response.json({
        sessionId: existingSession.id,
        repoUrl: assessment.repoUrl,
        instructions: assessment.instructions,
        timeLimit: assessment.timeLimit,
        allowedModels: parseAllowedModels(assessment.allowedModels),
        isExisting: true,
      });
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + assessment.timeLimit);
    const shareToken = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    await db.insert(assessmentSessions).values({
      id: sessionId,
      assessmentId: assessment.id,
      inviteId: invite.id,
      userId: user.id,
      status: 'in_progress',
      currentChallengeIndex: 0,
      totalCost: 0,
      totalTokens: 0,
      expiresAt: expiresAt.toISOString(),
      shareToken,
    });

    // Update invite status
    await db
      .update(assessmentInvites)
      .set({ status: 'started' })
      .where(eq(assessmentInvites.id, invite.id));

    return Response.json({
      sessionId,
      repoUrl: assessment.repoUrl,
      instructions: assessment.instructions,
      timeLimit: assessment.timeLimit,
      allowedModels: parseAllowedModels(assessment.allowedModels),
      isExisting: false,
    }, { status: 201 });
  } catch (error) {
    console.error('Start takehome error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
