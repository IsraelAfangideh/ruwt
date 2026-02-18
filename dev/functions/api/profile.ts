/**
 * GET /api/profile — Current user profile (credits, etc.). Auth required.
 * PATCH /api/profile — Update username. Auth required.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { ensureProfile } from '../_shared/ensure-profile';
import { profiles } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);

    // Ensure profile exists (creates with signup bonus on first call)
    await ensureProfile(db, user);

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    return Response.json({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      credits: profile.credits,
      username: profile.username,
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

    const body = await context.request.json().catch(() => ({})) as { username?: string };
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return Response.json({ error: 'Username is required' }, { status: 400 });
    }

    // Validate: lowercase alphanumeric + hyphens, 3-30 chars
    const usernameRegex = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
    if (!usernameRegex.test(username)) {
      return Response.json({
        error: 'Username must be 3-30 characters, lowercase alphanumeric and hyphens only, cannot start or end with a hyphen',
      }, { status: 400 });
    }

    const db = getDb(context.env);

    // Check uniqueness
    const [existing] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.username, username))
      .limit(1);

    if (existing && existing.id !== user.id) {
      return Response.json({ error: 'Username already taken' }, { status: 409 });
    }

    await db
      .update(profiles)
      .set({ username })
      .where(eq(profiles.id, user.id));

    return Response.json({ username });
  } catch (error) {
    console.error('Profile update error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
