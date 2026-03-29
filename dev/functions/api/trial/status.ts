/**
 * GET /api/trial/status
 * Returns current trial status and eligibility for the authenticated user.
 */
import { getDb } from '../../_shared/infra/db';
import { getUser } from '../../_shared/infra/auth';
import { canStartTrial, getUserOrg, getTrialStatus } from '../../_shared/org';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);

    const eligibility = await canStartTrial(db, user.id);
    const userOrg = await getUserOrg(db, user.id);
    const trial = userOrg ? await getTrialStatus(db, userOrg.org.id) : null;

    return Response.json({
      canStartTrial: eligibility.eligible,
      reason: eligibility.reason ?? null,
      trial,
    });
  } catch (error) {
    /* istanbul ignore next -- @preserve */
    console.error('Trial status error:', error);
    /* istanbul ignore next -- @preserve */
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
