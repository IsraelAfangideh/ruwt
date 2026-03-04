/**
 * POST /api/trial/start
 * Start a 30-day free trial for the authenticated user.
 * Creates an org if the user doesn't have one, sets trial dates + zero counters.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import {
  canStartTrial,
  getUserOrg,
  TRIAL_DURATION_DAYS,
  getTrialStatus,
} from '../../_shared/org';
import { profiles, organizations, orgMembers } from '../../../drizzle/schema.d1';

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);

    const eligibility = await canStartTrial(db, user.id);
    if (!eligibility.eligible) {
      return Response.json(
        { error: eligibility.reason || 'Not eligible for trial', code: 'TRIAL_NOT_ELIGIBLE' },
        { status: 403 },
      );
    }

    const now = new Date();
    const trialEnds = new Date(now);
    trialEnds.setDate(trialEnds.getDate() + TRIAL_DURATION_DAYS);

    // Create or update org FIRST (before marking trial as used)
    let userOrg = await getUserOrg(db, user.id);
    if (userOrg) {
      // Only allow org owner/admin to start trial on an existing org
      if (userOrg.role !== 'owner' && userOrg.role !== 'admin') {
        return Response.json(
          { error: 'Only org owners can start a trial', code: 'TRIAL_NOT_ELIGIBLE' },
          { status: 403 },
        );
      }
      // User has an existing org — set trial dates on it
      await db
        .update(organizations)
        .set({
          trialStartedAt: now.toISOString(),
          trialEndsAt: trialEnds.toISOString(),
          trialAssessmentsUsed: 0,
          trialInvitesUsed: 0,
        })
        .where(eq(organizations.id, userOrg.org.id));
    } else {
      // Create a new org
      const orgId = crypto.randomUUID();
      const userEmail = user.email || '';
      const orgName = userEmail.includes('@')
        ? `${userEmail.split('@')[1].split('.')[0]} Team`
        : 'My Team';

      await db.insert(organizations).values({
        id: orgId,
        name: orgName,
        createdBy: user.id,
        trialStartedAt: now.toISOString(),
        trialEndsAt: trialEnds.toISOString(),
        trialAssessmentsUsed: 0,
        trialInvitesUsed: 0,
      });

      await db.insert(orgMembers).values({
        id: crypto.randomUUID(),
        orgId,
        userId: user.id,
        role: 'owner',
      });

      userOrg = await getUserOrg(db, user.id);
    }

    // Mark trial as used AFTER org creation succeeds (prevents lockout if org insert fails)
    await db
      .update(profiles)
      .set({ accountType: 'team', trialUsed: 1 })
      .where(eq(profiles.id, user.id));

    const trial = userOrg ? await getTrialStatus(db, userOrg.org.id) : null;

    return Response.json({ trial, orgId: userOrg?.org.id }, { status: 201 });
  } catch (error) {
    console.error('Trial start error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
