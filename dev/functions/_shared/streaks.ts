/**
 * Streak tracking logic.
 * A streak increments when a user solves any challenge each day.
 * Streaks reset if a day is missed (unless a streak freeze is used).
 */
import { eq, and, sql } from 'drizzle-orm';
import type { Db } from './db';
import { profiles, attempts, dailyChallenges, notifications } from '../../drizzle/schema.d1';
import { checkStreakBadges } from './badges';

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

function yesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Called after a user solves any challenge.
 * Updates their streak, checks for freeze usage, awards streak badges.
 */
export async function updateStreak(db: Db, userId: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  newBadges: string[];
  streakFreezeUsed: boolean;
}> {
  const today = todayUTC();
  const yesterday = yesterdayUTC();

  // Get current profile
  const [profile] = await db
    .select({
      currentStreak: profiles.currentStreak,
      longestStreak: profiles.longestStreak,
      lastStreakDate: profiles.lastStreakDate,
      streakFreezes: profiles.streakFreezes,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!profile) return { currentStreak: 0, longestStreak: 0, newBadges: [], streakFreezeUsed: false };

  // Already counted today
  if (profile.lastStreakDate === today) {
    return {
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      newBadges: [],
      streakFreezeUsed: false,
    };
  }

  let newStreak = profile.currentStreak;
  let streakFreezeUsed = false;

  if (profile.lastStreakDate === yesterday) {
    // Consecutive day — extend streak
    newStreak += 1;
  } else if (profile.lastStreakDate && profile.lastStreakDate < yesterday) {
    // Missed day(s) — check if we have a freeze for yesterday
    const daysBetween = Math.floor(
      (new Date(today).getTime() - new Date(profile.lastStreakDate).getTime()) / 86400000
    );
    if (daysBetween === 2 && profile.streakFreezes > 0) {
      // Exactly missed 1 day — use a freeze
      newStreak += 1;
      streakFreezeUsed = true;
    } else {
      // Streak broken, start fresh
      newStreak = 1;
    }
  } else {
    // First ever daily solve
    newStreak = 1;
  }

  const newLongest = Math.max(profile.longestStreak, newStreak);

  await db
    .update(profiles)
    .set({
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastStreakDate: today,
      ...(streakFreezeUsed ? { streakFreezes: profile.streakFreezes - 1 } : {}),
    })
    .where(eq(profiles.id, userId));

  // Count total daily challenge solves for this user
  const dailySolveCountResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${dailyChallenges.date})` })
    .from(dailyChallenges)
    .innerJoin(attempts, and(
      eq(attempts.challengeId, dailyChallenges.challengeId),
      eq(attempts.userId, userId),
      eq(attempts.status, 'passed'),
    ));
  const dailySolveCount = dailySolveCountResult[0]?.count ?? 0;

  // Check streak badges
  const newBadges = await checkStreakBadges(db, userId, newStreak, dailySolveCount);

  return { currentStreak: newStreak, longestStreak: newLongest, newBadges, streakFreezeUsed };
}

/**
 * Purchase a streak freeze (costs 5000 credits).
 */
export const STREAK_FREEZE_COST = 5000;

export async function buyStreakFreeze(db: Db, userId: string): Promise<{ success: boolean; error?: string }> {
  const [profile] = await db
    .select({ credits: profiles.credits, streakFreezes: profiles.streakFreezes })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!profile) return { success: false, error: 'Profile not found' };
  if (profile.credits < STREAK_FREEZE_COST) return { success: false, error: 'Not enough credits' };
  if (profile.streakFreezes >= 3) return { success: false, error: 'Maximum 3 streak freezes' };

  await db
    .update(profiles)
    .set({
      credits: profile.credits - STREAK_FREEZE_COST,
      streakFreezes: profile.streakFreezes + 1,
    })
    .where(eq(profiles.id, userId));

  return { success: true };
}
