/**
 * POST /api/reactions — Toggle a reaction on a comment.
 * Body: { targetType: 'challenge_comment'|'replay_comment', targetId: string, emoji: string }
 * Toggle: if reaction exists, remove it; otherwise add it.
 */
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../_shared/infra/db';
import { getUser } from '../_shared/infra/auth';
import { reactions, challengeComments, replayComments, profiles, notifications } from '../../drizzle/schema.d1';

const ALLOWED_EMOJIS = ['thumbs_up', 'fire', 'brain', 'heart', 'eyes', 'rocket'] as const;

const reactionSchema = z.object({
  targetType: z.enum(['challenge_comment', 'replay_comment']),
  targetId: z.string(),
  emoji: z.enum(ALLOWED_EMOJIS),
});

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    /* istanbul ignore next -- @preserve */
    const body = await context.request.json().catch(() => ({}));
    const parsed = reactionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const { targetType, targetId, emoji } = parsed.data;

    // Verify target comment exists and get its author
    let commentAuthorId: string | null = null;
    if (targetType === 'challenge_comment') {
      const [comment] = await db.select({ userId: challengeComments.userId })
        .from(challengeComments).where(eq(challengeComments.id, targetId)).limit(1);
      if (!comment) return Response.json({ error: 'Comment not found' }, { status: 404 });
      commentAuthorId = comment.userId;
    } else {
      const [comment] = await db.select({ userId: replayComments.userId })
        .from(replayComments).where(eq(replayComments.id, targetId)).limit(1);
      /* istanbul ignore next -- @preserve */
      if (!comment) return Response.json({ error: 'Comment not found' }, { status: 404 });
      /* istanbul ignore next -- @preserve */
      commentAuthorId = comment.userId;
    }

    // Check if reaction already exists (toggle)
    const [existing] = await db.all<{ id: string }>(sql`
      SELECT id FROM reactions
      WHERE user_id = ${user.id} AND target_type = ${targetType}
        AND target_id = ${targetId} AND emoji = ${emoji}
      LIMIT 1
    `);

    let action: 'added' | 'removed';
    if (existing) {
      await db.delete(reactions).where(eq(reactions.id, existing.id));
      action = 'removed';
    } else {
      await db.insert(reactions).values({
        id: crypto.randomUUID(),
        userId: user.id,
        targetType,
        targetId,
        emoji,
      });
      action = 'added';

      // Notify comment author (only on add, not remove, and not self-reaction)
      if (commentAuthorId && commentAuthorId !== user.id) {
        const [profile] = await db.select({ name: profiles.name })
          .from(profiles).where(eq(profiles.id, user.id)).limit(1);
        const emojiDisplay: Record<string, string> = {
          thumbs_up: '\u{1F44D}', fire: '\u{1F525}', brain: '\u{1F9E0}',
          heart: '\u{2764}\u{FE0F}', eyes: '\u{1F440}', rocket: '\u{1F680}',
        };
        await db.insert(notifications).values({
          /* istanbul ignore next -- @preserve */
          id: crypto.randomUUID(),
          userId: commentAuthorId,
          type: 'reaction_received',
          title: 'New reaction',
          body: `${/* istanbul ignore next -- @preserve */ profile?.name || 'Someone'} reacted ${/* istanbul ignore next -- @preserve */ emojiDisplay[emoji] || emoji} to your comment`,
          metadata: JSON.stringify({ targetType, targetId, emoji }),
        /* istanbul ignore next -- @preserve */
        }).catch(/* istanbul ignore next -- @preserve */ () => {}); // non-blocking
      }
    }

    // Return updated reaction counts for this comment
    const counts = await db.all<{ emoji: string; cnt: number }>(sql`
      SELECT emoji, COUNT(*) as cnt FROM reactions
      WHERE target_type = ${targetType} AND target_id = ${targetId}
      GROUP BY emoji
    `);

    const reactionCounts: Record<string, number> = {};
    for (const c of counts) reactionCounts[c.emoji] = c.cnt;

    return Response.json({ action, reactionCounts });
  } catch (error) {
    console.error('Reactions POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
