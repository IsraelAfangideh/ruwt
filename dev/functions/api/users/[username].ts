/**
 * GET /api/users/:username
 * Public profile — no auth required.
 * Returns user info, stats, radar chart data, and recent replays.
 */
import { eq, and, sql, desc } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import { computeAFI, computeRadarFromCosts, determineCertification } from '../../_shared/scoring';
import { profiles, attempts, challenges, badges, follows } from '../../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env; params: { username: string } }) {
  try {
    const db = getDb(context.env);
    const username = context.params.username;

    if (!username) {
      return Response.json({ error: 'Username required' }, { status: 400 });
    }

    // Find profile by username
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.username, username))
      .limit(1);

    if (!profile) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Compute stats: solved count, avg cost
    const [stats] = await db
      .select({
        solved: sql<number>`COUNT(DISTINCT CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.challengeId} END)`,
        avgCost: sql<number>`AVG(CASE WHEN ${attempts.status} = 'passed' THEN ${attempts.totalCost} END)`,
      })
      .from(attempts)
      .where(eq(attempts.userId, profile.id));

    // Compute global rank (number of users with more solved or same solved + lower avg cost)
    const rankResult = await db.all(sql`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id,
          COUNT(DISTINCT CASE WHEN status = 'passed' THEN challenge_id END) as solved,
          AVG(CASE WHEN status = 'passed' THEN total_cost END) as avg_cost
        FROM attempts
        GROUP BY user_id
        HAVING solved > 0
      ) t
      WHERE t.solved > ${Number(stats?.solved || 0)}
        OR (t.solved = ${Number(stats?.solved || 0)} AND t.avg_cost < ${Number(stats?.avgCost || 0)})
    `);
    /* istanbul ignore next -- @preserve */
    const globalRank = (rankResult[0] as any)?.rank ?? 0;

    // Recent passed replays (last 10)
    const recentReplays = await db
      .select({
        attemptId: attempts.id,
        challengeId: attempts.challengeId,
        challengeTitle: challenges.title,
        challengeDifficulty: challenges.difficulty,
        challengeCategory: challenges.category,
        totalCost: attempts.totalCost,
        inputTokens: attempts.inputTokens,
        outputTokens: attempts.outputTokens,
        submittedAt: attempts.submittedAt,
      })
      .from(attempts)
      .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
      .where(and(eq(attempts.userId, profile.id), eq(attempts.status, 'passed'), eq(attempts.replayPublic, 1)))
      .orderBy(desc(attempts.submittedAt))
      .limit(10);

    // Badges earned by this user
    const userBadges = await db
      .select({
        badgeType: badges.badgeType,
        title: badges.title,
        description: badges.description,
        icon: badges.icon,
        earnedAt: badges.earnedAt,
      })
      .from(badges)
      .where(eq(badges.userId, profile.id))
      .orderBy(desc(badges.earnedAt));

    // Follower / following counts
    const [[followerCount], [followingCount]] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(follows).where(eq(follows.followingId, profile.id)),
      db.select({ count: sql<number>`COUNT(*)` }).from(follows).where(eq(follows.followerId, profile.id)),
    ]);

    // Check if current viewer follows this user
    let isFollowing = false;
    const viewer = await getUser(context.request, context.env);
    /* istanbul ignore next -- @preserve */
    if (viewer && viewer.id !== profile.id) {
      /* istanbul ignore next -- @preserve */
      const [fol] = await db
        .select({ id: follows.id })
        .from(follows)
        .where(and(eq(follows.followerId, viewer.id), eq(follows.followingId, profile.id)))
        .limit(1);
      /* istanbul ignore next -- @preserve */
      isFollowing = !!fol;
    }

    // Similar solvers: users who solved the same challenges
    const similarSolvers = await db.all(sql`
      SELECT p.username, p.name, p.avatar_url as avatarUrl, COUNT(DISTINCT a2.challenge_id) as shared
      FROM attempts a1
      JOIN attempts a2 ON a1.challenge_id = a2.challenge_id AND a1.user_id != a2.user_id
      JOIN profiles p ON a2.user_id = p.id
      WHERE a1.user_id = ${profile.id}
        AND a1.status = 'passed' AND a2.status = 'passed'
        AND p.username IS NOT NULL
        AND p.leaderboard_excluded = 0
      GROUP BY a2.user_id
      ORDER BY shared DESC
      LIMIT 5
    `);

    // Radar chart: per-category avg cost relative to global avg
    const [globalAvgs, userAvgs] = await Promise.all([
      db
        .select({
          category: challenges.category,
          avgCost: sql<number>`AVG(${attempts.totalCost})`,
        })
        .from(attempts)
        .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
        .where(eq(attempts.status, 'passed'))
        .groupBy(challenges.category),
      db
        .select({
          category: challenges.category,
          avgCost: sql<number>`AVG(${attempts.totalCost})`,
        })
        .from(attempts)
        .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
        .where(and(eq(attempts.userId, profile.id), eq(attempts.status, 'passed')))
        .groupBy(challenges.category),
    ]);

    const radar = computeRadarFromCosts(globalAvgs, userAvgs);

    // Compute AI Fluency Index from radar data
    const afi = computeAFI(radar);

    // Determine certification level
    const solvedCount = Number(stats?.solved || 0);
    const solvedCategories = new Set(userAvgs.map((u) => u.category));
    const certification = determineCertification(solvedCount, solvedCategories.size, afi.score);

    return Response.json({
      user: {
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        username: profile.username,
        bio: profile.bio,
        createdAt: profile.createdAt,
      },
      stats: {
        solved: solvedCount,
        avgCost: stats?.avgCost != null ? Math.round(Number(stats.avgCost)) : 0,
        globalRank,
        followers: Number(followerCount?.count || 0),
        following: Number(followingCount?.count || 0),
      },
      afi: {
        score: afi.score,
        tier: afi.tier,
        label: afi.label,
      },
      certification,
      isFollowing,
      badges: userBadges,
      similarSolvers,
      radar,
      recentReplays,
    });
  } catch (error) {
    console.error('Public profile error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
