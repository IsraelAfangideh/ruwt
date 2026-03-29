/**
 * Updates a user's cached AFI score on their profile and records history.
 * Called after each successful solve (non-blocking, fire-and-forget).
 */
import { eq, and, sql } from 'drizzle-orm';
import type { Db } from '../infra/db';
import { profiles, attempts, challenges, afiHistory } from '../../../drizzle/schema.d1';
import { computeAFI, computeRadarFromCosts } from '../scoring/scoring';

export async function updateProfileAFI(db: Db, userId: string): Promise<void> {
  // Fetch global + user avg costs per category in parallel
  const [globalAvgs, userAvgs, solveCountRow] = await Promise.all([
    db.select({ category: challenges.category, avgCost: sql<number>`AVG(${attempts.totalCost})` })
      .from(attempts)
      .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
      .where(eq(attempts.status, 'passed'))
      .groupBy(challenges.category),
    db.select({ category: challenges.category, avgCost: sql<number>`AVG(${attempts.totalCost})` })
      .from(attempts)
      .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
      .where(and(eq(attempts.userId, userId), eq(attempts.status, 'passed')))
      .groupBy(challenges.category),
    db.select({ count: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END)` })
      .from(attempts)
      .where(eq(attempts.userId, userId)),
  ]);

  const solveCount = Number(solveCountRow[0]?.count || 0);
  const radar = computeRadarFromCosts(globalAvgs, userAvgs);
  const afi = computeAFI(radar);

  // Update profile with cached AFI
  await db.update(profiles)
    .set({ afiScore: afi.score, afiTier: afi.tier })
    .where(eq(profiles.id, userId));

  // Record history snapshot (max one per day per user — upsert by date)
  const today = new Date().toISOString().split('T')[0];
  const historyId = `${userId}_${today}`;
  await db.insert(afiHistory)
    .values({
      id: historyId,
      userId,
      score: afi.score,
      tier: afi.tier,
      solveCount,
    })
    .onConflictDoNothing(); // If already recorded today, skip
}
