/**
 * POST /api/admin/backfill-streaks
 * One-time endpoint to recalculate streaks for all users from their solve history.
 * Requires authenticated admin user (ADMIN_USER_IDS env var).
 */
import { eq, sql, desc } from 'drizzle-orm';
import { getDb } from '../../_shared/infra/db';
import { getUser } from '../../_shared/infra/auth';
import { profiles, attempts } from '../../../drizzle/schema.d1';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const adminIds = context.env.ADMIN_USER_IDS?.split(',').map((id) => id.trim()).filter(Boolean) ?? [];
  if (adminIds.length === 0 || !adminIds.includes(user.id)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb(context.env);
  const today = new Date().toISOString().split('T')[0];

  // Get all users
  const allProfiles = await db
    .select({ id: profiles.id })
    .from(profiles);

  const results: { userId: string; currentStreak: number; longestStreak: number; lastStreakDate: string | null }[] = [];

  for (const profile of allProfiles) {
    // Get distinct dates (YYYY-MM-DD) this user solved a challenge, most recent first
    const solveDates = await db
      .select({
        date: sql<string>`DATE(${attempts.submittedAt})`.as('date'),
      })
      .from(attempts)
      .where(
        sql`${attempts.userId} = ${profile.id} AND ${attempts.status} = 'passed' AND ${attempts.submittedAt} IS NOT NULL`
      )
      .groupBy(sql`DATE(${attempts.submittedAt})`)
      .orderBy(desc(sql`DATE(${attempts.submittedAt})`));

    if (solveDates.length === 0) {
      results.push({ userId: profile.id, currentStreak: 0, longestStreak: 0, lastStreakDate: null });
      continue;
    }

    const dates = solveDates.map(r => r.date);
    const lastDate = dates[0];

    // Calculate current streak (consecutive days ending at most recent solve)
    let currentStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T00:00:00Z');
      const curr = new Date(dates[i] + 'T00:00:00Z');
      const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Check if the current streak is still active (last solve was today or yesterday)
    const lastSolve = new Date(lastDate + 'T00:00:00Z');
    const todayDate = new Date(today + 'T00:00:00Z');
    const daysSinceLast = (todayDate.getTime() - lastSolve.getTime()) / 86400000;
    if (daysSinceLast > 1) {
      // Streak is broken — last solve was more than 1 day ago
      currentStreak = 0;
    }

    // Calculate longest streak across all history
    let longestStreak = 1;
    let runLength = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T00:00:00Z');
      const curr = new Date(dates[i] + 'T00:00:00Z');
      const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
      if (diffDays === 1) {
        runLength++;
        longestStreak = Math.max(longestStreak, runLength);
      } else {
        runLength = 1;
      }
    }

    await db
      .update(profiles)
      .set({
        currentStreak,
        longestStreak,
        lastStreakDate: lastDate,
      })
      .where(eq(profiles.id, profile.id));

    results.push({ userId: profile.id, currentStreak, longestStreak, lastStreakDate: lastDate });
  }

  const updated = results.filter(r => r.currentStreak > 0 || r.longestStreak > 0);

  return Response.json({
    total: allProfiles.length,
    updated: updated.length,
    results: updated,
  });
}
