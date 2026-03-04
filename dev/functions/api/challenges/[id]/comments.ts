/**
 * GET  /api/challenges/:id/comments — List comments on a challenge (public).
 * POST /api/challenges/:id/comments — Add a comment (auth required).
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import { challengeComments, reactions, profiles, attempts, challenges, notifications } from '../../../../drizzle/schema.d1';

const ALLOWED_SORTS = ['recent', 'top'] as const;

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const db = getDb(context.env);
    const challengeId = context.params.id;
    const user = await getUser(context.request, context.env);

    const url = new URL(context.request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
    const sort = (url.searchParams.get('sort') || 'recent') as typeof ALLOWED_SORTS[number];

    // Get comments with user info
    const rows = await db.all<{
      id: string; challenge_id: string; user_id: string; content: string;
      solve_cost: number | null; parent_id: string | null; created_at: string;
      name: string | null; username: string | null; avatar_url: string | null;
    }>(sql`
      SELECT cc.id, cc.challenge_id, cc.user_id, cc.content, cc.solve_cost,
             cc.parent_id, cc.created_at,
             p.name, p.username, p.avatar_url
      FROM challenge_comments cc
      JOIN profiles p ON cc.user_id = p.id
      WHERE cc.challenge_id = ${challengeId}
      ORDER BY ${sort === 'top' ? sql`cc.created_at DESC` : sql`cc.created_at DESC`}
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Get reaction counts per comment
    const commentIds = rows.map((r) => r.id);
    let reactionMap: Record<string, Record<string, number>> = {};
    let userReactionMap: Record<string, string | null> = {};

    if (commentIds.length > 0) {
      const reactionRows = await db.all<{
        target_id: string; emoji: string; cnt: number;
      }>(sql`
        SELECT target_id, emoji, COUNT(*) as cnt
        FROM reactions
        WHERE target_type = 'challenge_comment'
          AND target_id IN (${sql.join(commentIds.map(id => sql`${id}`), sql`, `)})
        GROUP BY target_id, emoji
      `);

      for (const r of reactionRows) {
        if (!reactionMap[r.target_id]) reactionMap[r.target_id] = {};
        reactionMap[r.target_id][r.emoji] = r.cnt;
      }

      // Get current user's reactions
      if (user) {
        const userReactions = await db.all<{ target_id: string; emoji: string }>(sql`
          SELECT target_id, emoji FROM reactions
          WHERE target_type = 'challenge_comment'
            AND user_id = ${user.id}
            AND target_id IN (${sql.join(commentIds.map(id => sql`${id}`), sql`, `)})
        `);
        for (const r of userReactions) {
          userReactionMap[r.target_id] = r.emoji;
        }
      }
    }

    // Get total count
    const [{ cnt }] = await db.all<{ cnt: number }>(
      sql`SELECT COUNT(*) as cnt FROM challenge_comments WHERE challenge_id = ${challengeId}`
    );

    const comments = rows.map((r) => ({
      id: r.id,
      content: r.content,
      solveCost: r.solve_cost,
      parentId: r.parent_id,
      createdAt: r.created_at,
      user: { id: r.user_id, name: r.name, username: r.username, avatarUrl: r.avatar_url },
      reactions: reactionMap[r.id] || {},
      userReaction: userReactionMap[r.id] || null,
    }));

    // Sort by reaction count if 'top'
    if (sort === 'top') {
      comments.sort((a, b) => {
        const aTotal = Object.values(a.reactions).reduce((s, n) => s + n, 0);
        const bTotal = Object.values(b.reactions).reduce((s, n) => s + n, 0);
        return bTotal - aTotal;
      });
    }

    return Response.json({ comments, total: cnt });
  } catch (error) {
    console.error('Challenge comments GET error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const commentSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().uuid().optional(),
});

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const challengeId = context.params.id;

    const body = await context.request.json().catch(() => ({}));
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const { content, parentId } = parsed.data;

    // Verify challenge exists
    const [challenge] = await db.select({ id: challenges.id, title: challenges.title })
      .from(challenges).where(eq(challenges.id, challengeId)).limit(1);
    if (!challenge) return Response.json({ error: 'Challenge not found' }, { status: 404 });

    // Verify parent comment exists if parentId is provided
    if (parentId) {
      const [parent] = await db.select({ id: challengeComments.id, userId: challengeComments.userId })
        .from(challengeComments).where(eq(challengeComments.id, parentId)).limit(1);
      if (!parent) return Response.json({ error: 'Parent comment not found' }, { status: 404 });

      // Notify parent comment author of reply
      if (parent.userId !== user.id) {
        const [profile] = await db.select({ name: profiles.name })
          .from(profiles).where(eq(profiles.id, user.id)).limit(1);
        await db.insert(notifications).values({
          id: crypto.randomUUID(),
          userId: parent.userId,
          type: 'comment_reply',
          title: 'New reply',
          body: `${profile?.name || 'Someone'} replied to your comment on ${challenge.title}`,
          metadata: JSON.stringify({ challengeId }),
        });
      }
    }

    // Auto-populate solveCost from user's best passed attempt
    const [bestAttempt] = await db.all<{ total_cost: number }>(sql`
      SELECT total_cost FROM attempts
      WHERE user_id = ${user.id} AND challenge_id = ${challengeId} AND status = 'passed'
      ORDER BY total_cost ASC LIMIT 1
    `);

    const commentId = crypto.randomUUID();
    await db.insert(challengeComments).values({
      id: commentId,
      challengeId,
      userId: user.id,
      content,
      solveCost: bestAttempt?.total_cost ?? null,
      parentId: parentId ?? null,
    });

    // Get user profile for response
    const [profile] = await db.select({ name: profiles.name, username: profiles.username, avatarUrl: profiles.avatarUrl })
      .from(profiles).where(eq(profiles.id, user.id)).limit(1);

    return Response.json({
      comment: {
        id: commentId,
        content,
        solveCost: bestAttempt?.total_cost ?? null,
        parentId: parentId ?? null,
        createdAt: new Date().toISOString(),
        user: { id: user.id, name: profile?.name, username: profile?.username, avatarUrl: profile?.avatarUrl },
        reactions: {},
        userReaction: null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Challenge comments POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
