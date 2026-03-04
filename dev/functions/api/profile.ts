/**
 * GET /api/profile — Current user profile (credits, etc.). Auth required.
 * PATCH /api/profile — Update username. Auth required.
 */
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { getUserOrg, getTrialStatus, canStartTrial } from '../_shared/org';
import { ensureProfile } from '../_shared/ensure-profile';
import { profiles } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);

    // Ensure profile exists (creates with signup bonus on first call)
    await ensureProfile(db, user, context.env);

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Auto-capture timezone from Cloudflare's geolocation (non-blocking, one-time)
    const cfTimezone = (context.request as any).cf?.timezone as string | undefined;
    if (cfTimezone && profile.timezone !== cfTimezone) {
      db.update(profiles).set({ timezone: cfTimezone }).where(eq(profiles.id, user.id)).run().catch(() => {});
    }

    // Look up org subscription status + trial
    let subscriptionStatus = 'none';
    let subscriptionPlan: string | null = null;
    let subscriptionEndsAt: string | null = null;

    const userOrg = await getUserOrg(db, user.id);
    if (userOrg) {
      subscriptionStatus = userOrg.org.subscriptionStatus ?? 'none';
      subscriptionPlan = userOrg.org.subscriptionPlan ?? null;
      subscriptionEndsAt = userOrg.org.subscriptionEndsAt ?? null;
    }

    const trial = userOrg ? await getTrialStatus(db, userOrg.org.id) : null;
    const trialEligibility = await canStartTrial(db, user.id);

    return Response.json({
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      credits: profile.credits,
      username: profile.username,
      onboardingCompleted: profile.onboardingCompleted,
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      lastStreakDate: profile.lastStreakDate,
      streakFreezes: profile.streakFreezes,
      newsletterSubscribed: profile.newsletterSubscribed,
      accountType: profile.accountType,
      subscriptionStatus,
      subscriptionPlan,
      subscriptionEndsAt,
      trial,
      canStartTrial: trialEligibility.eligible,
    });
  } catch (error) {
    console.error('Profile error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestPatch(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const profileUpdateSchema = z.object({
      username: z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username must be at most 30 characters')
        .regex(/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/, 'Lowercase alphanumeric and hyphens only, cannot start or end with a hyphen')
        .optional(),
      onboardingCompleted: z.union([z.literal(0), z.literal(1)]).optional(),
      newsletterSubscribed: z.union([z.literal(0), z.literal(1)]).optional(),
      accountType: z.enum(['individual', 'team']).optional(),
    }).refine(data => data.username !== undefined || data.onboardingCompleted !== undefined || data.newsletterSubscribed !== undefined || data.accountType !== undefined, {
      message: 'No valid fields to update',
    });

    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { username, onboardingCompleted, newsletterSubscribed, accountType } = parsed.data;

    const db = getDb(context.env);
    const updates: Record<string, unknown> = {};

    if (onboardingCompleted !== undefined) {
      updates.onboardingCompleted = onboardingCompleted;
    }

    if (newsletterSubscribed !== undefined) {
      updates.newsletterSubscribed = newsletterSubscribed;
    }

    if (accountType !== undefined) {
      updates.accountType = accountType;
    }

    if (username !== undefined) {

      // Check uniqueness
      const [existing] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.username, username))
        .limit(1);

      if (existing && existing.id !== user.id) {
        return Response.json({ error: 'Username already taken' }, { status: 409 });
      }

      updates.username = username;
    }

    /* istanbul ignore next -- @preserve Zod .refine() ensures at least one field; this is a safety net */
    if (Object.keys(updates).length === 0) { return Response.json({ error: 'No valid fields to update' }, { status: 400 }); }

    await db
      .update(profiles)
      .set(updates)
      .where(eq(profiles.id, user.id));

    return Response.json(updates);
  } catch (error) {
    console.error('Profile update error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
