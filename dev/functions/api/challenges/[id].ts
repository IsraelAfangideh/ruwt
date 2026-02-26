/**
 * GET /api/challenges/:id
 * Single challenge by id. No auth required.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { challenges } from '../../../drizzle/schema.d1';

export async function onRequestGet(context: {
  request: Request;
  env: Env;
  params: Promise<{ id?: string }>;
}) {
  try {
    const params = await context.params;
    const id = params?.id;
    if (!id) {
      return Response.json({ error: 'Missing challenge id' }, { status: 400 });
    }
    const db = getDb(context.env);
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, id))
      .limit(1);
    if (!challenge) {
      return Response.json({ error: 'Challenge not found' }, { status: 404 });
    }
    let hiddenTestCount = 0;
    if (challenge.hiddenTestCases) {
      try { hiddenTestCount = JSON.parse(challenge.hiddenTestCases).length; } catch {}
    }
    const { hiddenTestCases: _stripped, ...rest } = challenge;
    return Response.json({
      ...rest,
      tags: challenge.tags ? (() => { try { return JSON.parse(challenge.tags); } catch { return []; } })() : [],
      hiddenTestCount,
    });
  } catch (error) {
    console.error('Challenge get error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
