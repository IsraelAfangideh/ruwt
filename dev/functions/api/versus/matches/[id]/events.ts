/**
 * POST /api/versus/matches/:id/events
 * One opponent tick, streamed as SSE.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../../../../_shared/infra/db';
import { getUser } from '../../../../_shared/infra/auth';
import { challenges, versusMatches } from '../../../../../drizzle/schema.d1';
import { runOpponentTick } from '../../../../_shared/versus/opponent-loop';
import { serializeVersusMatch } from '../../../../_shared/versus/serialize';
import type { VersusSseEvent } from '../../../../_shared/versus/types';

function sseLine(event: VersusSseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
  params: Promise<{ id?: string }>;
}) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    if (!id) return Response.json({ error: 'Missing match id' }, { status: 400 });

    const db = getDb(context.env);
    const [match] = await db.select().from(versusMatches).where(eq(versusMatches.id, id)).limit(1);
    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });
    if (match.userId !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const [challenge] = await db.select().from(challenges).where(eq(challenges.id, match.challengeId)).limit(1);
    if (!challenge) return Response.json({ error: 'Challenge not found' }, { status: 404 });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: VersusSseEvent) => {
          controller.enqueue(encoder.encode(sseLine(event)));
        };
        try {
          if (match.winner) {
            emit({ type: 'done', match: serializeVersusMatch(match), continue: false });
          } else {
            await runOpponentTick({ env: context.env, db, match, challenge, emit });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Opponent tick failed';
          console.error('Versus tick error:', error);
          emit({ type: 'error', error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Versus events error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
