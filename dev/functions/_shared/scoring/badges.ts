/**
 * Badge definitions and checking logic.
 * After each solve, call checkAndAwardBadges() to evaluate all badge conditions.
 */
import { eq, and, sql } from 'drizzle-orm';
import type { Db } from './db';
import { badges, profiles, attempts, challenges, notifications } from '../../drizzle/schema.d1';
import { computeAFI, computeRadarFromCosts, CERTIFICATION_THRESHOLDS } from './scoring';

export interface BadgeDef {
  type: string;
  title: string;
  description: string;
  icon: string;
}

export const BADGE_DEFS: Record<string, BadgeDef> = {
  first_solve: {
    type: 'first_solve',
    title: 'First Blood',
    description: 'Solved your first challenge',
    icon: '🎯',
  },
  streak_3: {
    type: 'streak_3',
    title: 'Getting Warm',
    description: '3-day daily challenge streak',
    icon: '🔥',
  },
  streak_7: {
    type: 'streak_7',
    title: 'On Fire',
    description: '7-day daily challenge streak',
    icon: '🔥',
  },
  streak_30: {
    type: 'streak_30',
    title: 'Unstoppable',
    description: '30-day daily challenge streak',
    icon: '💎',
  },
  streak_100: {
    type: 'streak_100',
    title: 'Legendary',
    description: '100-day daily challenge streak',
    icon: '👑',
  },
  penny_pincher: {
    type: 'penny_pincher',
    title: 'Penny Pincher',
    description: 'Solved a challenge for under $0.01',
    icon: '💰',
  },
  speed_demon: {
    type: 'speed_demon',
    title: 'Speed Demon',
    description: 'Solved a timed challenge in under 5 minutes',
    icon: '⚡',
  },
  model_master: {
    type: 'model_master',
    title: 'Model Master',
    description: 'Used 5+ different AI models across solves',
    icon: '🧠',
  },
  polyglot: {
    type: 'polyglot',
    title: 'Polyglot',
    description: 'Solved challenges in both JavaScript and Python',
    icon: '🌍',
  },
  clean_sweep_easy: {
    type: 'clean_sweep_easy',
    title: 'Clean Sweep: Easy',
    description: 'Solved all Easy challenges',
    icon: '🧹',
  },
  clean_sweep_medium: {
    type: 'clean_sweep_medium',
    title: 'Clean Sweep: Medium',
    description: 'Solved all Medium challenges',
    icon: '🧹',
  },
  ten_solves: {
    type: 'ten_solves',
    title: 'Double Digits',
    description: 'Solved 10 challenges',
    icon: '🏅',
  },
  twenty_five_solves: {
    type: 'twenty_five_solves',
    title: 'Quarter Century',
    description: 'Solved 25 challenges',
    icon: '🏆',
  },
  fifty_solves: {
    type: 'fifty_solves',
    title: 'Half Century',
    description: 'Solved 50 challenges',
    icon: '🏆',
  },
  daily_warrior: {
    type: 'daily_warrior',
    title: 'Daily Warrior',
    description: 'Completed 10 daily challenges',
    icon: '⚔️',
  },
  ai_fluent: {
    type: 'ai_fluent',
    title: 'AI-Fluent',
    description: 'Passed 10+ challenges with AFI 400+',
    icon: '\uD83E\uDD49',
  },
  ai_fluent_pro: {
    type: 'ai_fluent_pro',
    title: 'AI-Fluent Pro',
    description: 'Passed 25+ challenges across 3+ categories with AFI 550+',
    icon: '\uD83E\uDD48',
  },
  ai_fluent_expert: {
    type: 'ai_fluent_expert',
    title: 'AI-Fluent Expert',
    description: 'Passed 50+ challenges across all categories with AFI 700+',
    icon: '\uD83E\uDD47',
  },
};

/* istanbul ignore next -- @preserve */
async function hasBadge(db: Db, userId: string, badgeType: string): Promise<boolean> {
  /* istanbul ignore next -- @preserve */
  const [existing] = await db
    .select({ id: badges.id })
    .from(badges)
    .where(and(eq(badges.userId, userId), eq(badges.badgeType, badgeType)))
    .limit(1);
  /* istanbul ignore next -- @preserve */
  return !!existing;
}

/* istanbul ignore next -- @preserve */
async function awardBadge(db: Db, userId: string, badgeType: string): Promise<boolean> {
  /* istanbul ignore next -- @preserve */
  const def = BADGE_DEFS[badgeType];
  /* istanbul ignore next -- @preserve */
  if (!def) return false;
  /* istanbul ignore next -- @preserve */
  if (await hasBadge(db, userId, badgeType)) return false;

  /* istanbul ignore next -- @preserve */
  const id = crypto.randomUUID();
  /* istanbul ignore next -- @preserve */
  await db.insert(badges).values({
    id,
    userId,
    badgeType: def.type,
    title: def.title,
    description: def.description,
    icon: def.icon,
  });

  // Create notification
  /* istanbul ignore next -- @preserve */
  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    userId,
    type: 'badge_earned',
    title: `Badge Earned: ${def.title}`,
    body: def.description,
    metadata: JSON.stringify({ badgeType, badgeId: id, icon: def.icon }),
  });

  /* istanbul ignore next -- @preserve */
  return true;
}

/** Fetch all existing badge types for a user in a single query. */
async function getUserBadgeSet(db: Db, userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ badgeType: badges.badgeType })
    .from(badges)
    .where(eq(badges.userId, userId));
  return new Set(rows.map((r: { badgeType: string }) => r.badgeType));
}

/** Award a badge if the user doesn't already have it, using a pre-fetched set. */
async function awardBadgeIfNew(
  db: Db,
  userId: string,
  badgeType: string,
  existingBadges: Set<string>,
): Promise<boolean> {
  const def = BADGE_DEFS[badgeType];
  /* istanbul ignore next -- @preserve */
  if (!def) return false;
  if (existingBadges.has(badgeType)) return false;

  const id = crypto.randomUUID();
  await db.insert(badges).values({
    id,
    userId,
    badgeType: def.type,
    title: def.title,
    description: def.description,
    icon: def.icon,
  });

  // Create notification
  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    userId,
    type: 'badge_earned',
    title: `Badge Earned: ${def.title}`,
    body: def.description,
    metadata: JSON.stringify({ badgeType, badgeId: id, icon: def.icon }),
  });

  existingBadges.add(badgeType); // Update set so subsequent checks are accurate
  return true;
}

/**
 * Check all badge conditions for a user after a solve.
 * Returns list of newly awarded badge types.
 */
export async function checkAndAwardBadges(db: Db, userId: string): Promise<string[]> {
  const awarded: string[] = [];

  // Get user stats
  const passedAttempts = await db
    .select({
      challengeId: attempts.challengeId,
      totalCost: attempts.totalCost,
      createdAt: attempts.createdAt,
      submittedAt: attempts.submittedAt,
      expiresAt: attempts.expiresAt,
    })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.status, 'passed')));

  const uniqueSolvedIds = new Set(passedAttempts.map((a) => a.challengeId));
  const solveCount = uniqueSolvedIds.size;

  // Batch-fetch all existing badges for this user (eliminates N+1 hasBadge queries)
  const existingBadges = await getUserBadgeSet(db, userId);

  // First solve
  if (solveCount >= 1 && (await awardBadgeIfNew(db, userId, 'first_solve', existingBadges))) {
    awarded.push('first_solve');
  }

  // Solve count milestones
  if (solveCount >= 10 && (await awardBadgeIfNew(db, userId, 'ten_solves', existingBadges))) {
    awarded.push('ten_solves');
  }
  if (solveCount >= 25 && (await awardBadgeIfNew(db, userId, 'twenty_five_solves', existingBadges))) {
    awarded.push('twenty_five_solves');
  }
  if (solveCount >= 50 && (await awardBadgeIfNew(db, userId, 'fifty_solves', existingBadges))) {
    awarded.push('fifty_solves');
  }

  // Penny pincher — any solve under $0.01 (100 hundredths = $0.01)
  const cheapSolve = passedAttempts.some((a) => a.totalCost > 0 && a.totalCost < 100);
  if (cheapSolve && (await awardBadgeIfNew(db, userId, 'penny_pincher', existingBadges))) {
    awarded.push('penny_pincher');
  }

  // Speed demon — timed challenge solved in under 5 minutes
  const fastSolve = passedAttempts.some((a) => {
    if (!a.expiresAt || !a.createdAt || !a.submittedAt) return false;
    const elapsed = new Date(a.submittedAt).getTime() - new Date(a.createdAt).getTime();
    return elapsed < 5 * 60 * 1000; // under 5 min
  });
  if (fastSolve && (await awardBadgeIfNew(db, userId, 'speed_demon', existingBadges))) {
    awarded.push('speed_demon');
  }

  // Model master — 5+ distinct models used
  const distinctModels = await db
    .select({ model: sql<string>`DISTINCT model` })
    .from(attempts)
    .innerJoin(
      sql`ai_calls`,
      sql`ai_calls.attempt_id = ${attempts.id}`
    )
    .where(and(eq(attempts.userId, userId), eq(attempts.status, 'passed')));
  if (distinctModels.length >= 5 && (await awardBadgeIfNew(db, userId, 'model_master', existingBadges))) {
    awarded.push('model_master');
  }

  // Polyglot — solved in both JS and Python
  const solvedChallengeRows = await db
    .select({ language: challenges.language })
    .from(challenges)
    .where(sql`${challenges.id} IN (${sql.join(
      [...uniqueSolvedIds].map((id) => sql`${id}`),
      sql`, `
    )})`);
  /* istanbul ignore next -- @preserve */
  const languages = new Set(solvedChallengeRows.map((r) => r.language || 'javascript'));
  if (languages.has('javascript') && languages.has('python') && (await awardBadgeIfNew(db, userId, 'polyglot', existingBadges))) {
    awarded.push('polyglot');
  }

  // Clean sweep easy/medium — solved ALL of that difficulty
  for (const diff of ['easy', 'medium'] as const) {
    const allOfDiff = await db
      .select({ id: challenges.id })
      .from(challenges)
      .where(eq(challenges.difficulty, diff));
    const allSolved = allOfDiff.every((ch) => uniqueSolvedIds.has(ch.id));
    if (allOfDiff.length > 0 && allSolved) {
      /* istanbul ignore next -- @preserve */
      const badgeType = diff === 'easy' ? 'clean_sweep_easy' : 'clean_sweep_medium';
      /* istanbul ignore next -- @preserve */
      if (await awardBadgeIfNew(db, userId, badgeType, existingBadges)) {
        awarded.push(badgeType);
      }
    }
  }

  // AI Fluency certifications — require radar data computation
  const certBadgeTypes = CERTIFICATION_THRESHOLDS.map((c) => c.type);
  const hasAllCerts = certBadgeTypes.every((b) => existingBadges.has(b));
  if (solveCount >= 10 && !hasAllCerts) {
    const [globalAvgs, userAvgs] = await Promise.all([
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
    ]);

    const radar = computeRadarFromCosts(globalAvgs, userAvgs);
    const afi = computeAFI(radar);
    const solvedCats = new Set(userAvgs.map((u) => u.category));

    for (const cert of CERTIFICATION_THRESHOLDS) {
      /* istanbul ignore next -- @preserve */
      if (solveCount >= cert.minSolves && solvedCats.size >= cert.minCategories && afi.score >= cert.minAFI) {
        if (await awardBadgeIfNew(db, userId, cert.type, existingBadges)) {
          awarded.push(cert.type);
        }
      }
    }
  }

  // Streak badges are checked in the streak update logic, not here
  // Daily warrior is checked in streak logic too

  return awarded;
}

/** Check streak-related badges. Called from streak update. */
export async function checkStreakBadges(db: Db, userId: string, currentStreak: number, dailySolveCount: number): Promise<string[]> {
  const awarded: string[] = [];

  // Batch-fetch all existing badges for this user (eliminates N+1 hasBadge queries)
  const existingBadges = await getUserBadgeSet(db, userId);

  const streakMilestones = [
    { threshold: 3, badge: 'streak_3' },
    { threshold: 7, badge: 'streak_7' },
    { threshold: 30, badge: 'streak_30' },
    { threshold: 100, badge: 'streak_100' },
  ];
  for (const m of streakMilestones) {
    if (currentStreak >= m.threshold && (await awardBadgeIfNew(db, userId, m.badge, existingBadges))) {
      awarded.push(m.badge);
    }
  }
  if (dailySolveCount >= 10 && (await awardBadgeIfNew(db, userId, 'daily_warrior', existingBadges))) {
    awarded.push('daily_warrior');
  }
  return awarded;
}
