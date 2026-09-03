/**
 * GET /api/versus/matches/:id
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../../../_shared/infra/db';
import { getUser } from '../../../_shared/infra/auth';
import { versusMatches } from '../../../../drizzle/schema.d1';
import { serializeVersusMatch } from '../../../_shared/versus/serialize';
import { estimateVersusMatchCost } from '../../../_shared/versus/cost';

export async function onRequestGet(context: {
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

    return Response.json({
      match: serializeVersusMatch(match),
      estimatedCost: estimateVersusMatchCost(match.opponentModel),
    });
  } catch (error) {
    console.error('Get versus match by id error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
