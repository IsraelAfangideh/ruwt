/**
 * GET /api/daily-challenge
 * Returns today's challenge + today's mini-leaderboard.
 * Auto-seeds if no daily challenge exists for today.
 */
import { eq, and, sql, desc } from 'drizzle-orm';
import { getDb } from '../_shared/infra/db';
import { dailyChallenges, challenges, attempts, profiles, seasons } from '../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const db = getDb(context.env);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check for existing daily challenge
    let [daily] = await db
      .select({
        id: dailyChallenges.id,
        challengeId: dailyChallenges.challengeId,
        date: dailyChallenges.date,
        seasonId: dailyChallenges.seasonId,
      })
      .from(dailyChallenges)
      .where(eq(dailyChallenges.date, today))
      .limit(1);

    // Auto-seed if none exists for today
    if (!daily) {
      // Get recent daily challenge IDs to avoid repeats (small window to preserve easy pool)
      const recentDailies = await db
        .select({ challengeId: dailyChallenges.challengeId })
        .from(dailyChallenges)
        .orderBy(desc(dailyChallenges.date))
        .limit(5);
      const recentIds = new Set(recentDailies.map((d) => d.challengeId));

      // Pick a challenge not recently used — NEVER allow hard/impossible for daily
      const allChallenges = await db.select().from(challenges);
      const eligible = allChallenges.filter((c) => !['hard', 'impossible'].includes(c.difficulty || ''));
      const candidates = eligible.filter((c) => !recentIds.has(c.id));
      const pool = candidates.length > 0 ? candidates : eligible;

      // Prefer sprint/easy, then medium
      const easyPool = pool.filter((c) => ['sprint', 'easy'].includes(c.difficulty || ''));
      const mediumPool = pool.filter((c) => c.difficulty === 'medium');
      const finalPool = easyPool.length > 0 ? easyPool : mediumPool.length > 0 ? mediumPool : pool;

      // Simple rotation: pick based on day-of-year mod pool size
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      const picked = finalPool[dayOfYear % finalPool.length];

      // Get active season
      const [activeSeason] = await db
        .select({ id: seasons.id })
        .from(seasons)
        .where(eq(seasons.status, 'active'))
        .limit(1);

      const newId = crypto.randomUUID();
      await db.insert(dailyChallenges).values({
        id: newId,
        challengeId: picked.id,
        date: today,
        seasonId: activeSeason?.id || null,
      });

      daily = { id: newId, challengeId: picked.id, date: today, seasonId: activeSeason?.id || null };
    }

    // Fetch challenge details
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, daily.challengeId))
      .limit(1);

    // Today's mini-leaderboard: passed attempts submitted today
    const todayLeaderboard = await db
      .select({
        attemptId: attempts.id,
        userId: attempts.userId,
        userName: profiles.name,
        userEmail: profiles.email,
        avatarUrl: profiles.avatarUrl,
        totalCost: attempts.totalCost,
        inputTokens: attempts.inputTokens,
        outputTokens: attempts.outputTokens,
        submittedAt: attempts.submittedAt,
      })
      .from(attempts)
      .innerJoin(profiles, eq(attempts.userId, profiles.id))
      .where(
        and(
          eq(attempts.challengeId, daily.challengeId),
          eq(attempts.status, 'passed'),
          sql`${attempts.submittedAt} >= ${today}`
        )
      )
      .orderBy(attempts.totalCost)
      .limit(20);

    // Countdown to next daily (midnight UTC)
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const secondsUntilNext = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);

    return Response.json({
      date: today,
      challenge: challenge
        ? {
            id: challenge.id,
            title: challenge.title,
            description: challenge.description,
            difficulty: challenge.difficulty,
            category: challenge.category,
          }
        : null,
      leaderboard: todayLeaderboard.map((r, i) => ({
        rank: i + 1,
        user: {
          id: r.userId,
          name: r.userName || r.userEmail?.split('@')[0],
          avatarUrl: r.avatarUrl,
        },
        attemptId: r.attemptId,
        cost: r.totalCost,
        tokens: r.inputTokens + r.outputTokens,
        submittedAt: r.submittedAt,
      })),
      secondsUntilNext,
    });
  } catch (error) {
    console.error('Daily challenge error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
