/**
 * GET  /api/attempts/:id/comments — List comments on a replay (public if replay is public).
 * POST /api/attempts/:id/comments — Add a comment (auth required).
 */
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import { replayComments, reactions, profiles, attempts, challenges, notifications } from '../../../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const db = getDb(context.env);
    const attemptId = context.params.id;
    const user = await getUser(context.request, context.env);

    // Check attempt exists and is accessible
    const [attempt] = await db.select({
      id: attempts.id, userId: attempts.userId, replayPublic: attempts.replayPublic,
      challengeId: attempts.challengeId,
    }).from(attempts).where(eq(attempts.id, attemptId)).limit(1);

    if (!attempt) return Response.json({ error: 'Attempt not found' }, { status: 404 });
    if (!attempt.replayPublic && attempt.userId !== user?.id) {
      return Response.json({ error: 'Replay is private' }, { status: 403 });
    }

    const url = new URL(context.request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

    const rows = await db.all<{
      id: string; attempt_id: string; user_id: string; content: string; created_at: string;
      name: string | null; username: string | null; avatar_url: string | null;
    }>(sql`
      SELECT rc.id, rc.attempt_id, rc.user_id, rc.content, rc.created_at,
             p.name, p.username, p.avatar_url
      FROM replay_comments rc
      JOIN profiles p ON rc.user_id = p.id
      WHERE rc.attempt_id = ${attemptId}
      ORDER BY rc.created_at DESC
      LIMIT ${limit}
    `);

    // Get reaction counts
    const commentIds = rows.map((r) => r.id);
    let reactionMap: Record<string, Record<string, number>> = {};
    let userReactionMap: Record<string, string | null> = {};

    if (commentIds.length > 0) {
      const reactionRows = await db.all<{ target_id: string; emoji: string; cnt: number }>(sql`
        SELECT target_id, emoji, COUNT(*) as cnt FROM reactions
        WHERE target_type = 'replay_comment'
          AND target_id IN (${sql.join(commentIds.map(id => sql`${id}`), sql`, `)})
        GROUP BY target_id, emoji
      `);
      for (const r of reactionRows) {
        if (!reactionMap[r.target_id]) reactionMap[r.target_id] = {};
        reactionMap[r.target_id][r.emoji] = r.cnt;
      }

      if (user) {
        const userReactions = await db.all<{ target_id: string; emoji: string }>(sql`
          SELECT target_id, emoji FROM reactions
          WHERE target_type = 'replay_comment' AND user_id = ${user.id}
            AND target_id IN (${sql.join(commentIds.map(id => sql`${id}`), sql`, `)})
        `);
        for (const r of userReactions) {
          userReactionMap[r.target_id] = r.emoji;
        }
      }
    }

    const comments = rows.map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: r.created_at,
      user: { id: r.user_id, name: r.name, username: r.username, avatarUrl: r.avatar_url },
      reactions: reactionMap[r.id] || {},
      userReaction: userReactionMap[r.id] || null,
    }));

    return Response.json({ comments });
  } catch (error) {
    console.error('Replay comments GET error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const commentSchema = z.object({
  content: z.string().min(1).max(2000),
});

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const attemptId = context.params.id;

    const body = await context.request.json().catch(() => ({}));
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    // Check attempt exists and replay is public (or user owns it)
    const [attempt] = await db.select({
      id: attempts.id, userId: attempts.userId, replayPublic: attempts.replayPublic,
      challengeId: attempts.challengeId,
    }).from(attempts).where(eq(attempts.id, attemptId)).limit(1);

    if (!attempt) return Response.json({ error: 'Attempt not found' }, { status: 404 });
    if (!attempt.replayPublic && attempt.userId !== user.id) {
      return Response.json({ error: 'Replay is private' }, { status: 403 });
    }

    const commentId = crypto.randomUUID();
    await db.insert(replayComments).values({
      id: commentId,
      attemptId,
      userId: user.id,
      content: parsed.data.content,
    });

    // Notify replay owner
    if (attempt.userId !== user.id) {
      const [profile] = await db.select({ name: profiles.name })
        .from(profiles).where(eq(profiles.id, user.id)).limit(1);
      const [challenge] = await db.select({ title: challenges.title })
        .from(challenges).where(eq(challenges.id, attempt.challengeId)).limit(1);
      await db.insert(notifications).values({
        id: crypto.randomUUID(),
        userId: attempt.userId,
        type: 'replay_comment',
        title: 'New comment on your replay',
        body: `${profile?.name || 'Someone'} commented on your replay of ${challenge?.title || 'a challenge'}`,
        metadata: JSON.stringify({ attemptId }),
      });
    }

    const [profile] = await db.select({ name: profiles.name, username: profiles.username, avatarUrl: profiles.avatarUrl })
      .from(profiles).where(eq(profiles.id, user.id)).limit(1);

    return Response.json({
      comment: {
        id: commentId,
        content: parsed.data.content,
        createdAt: new Date().toISOString(),
        user: { id: user.id, name: profile?.name, username: profile?.username, avatarUrl: profile?.avatarUrl },
        reactions: {},
        userReaction: null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Replay comments POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
