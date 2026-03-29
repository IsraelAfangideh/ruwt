/**
 * Shared daily challenge seeding logic.
 * Used by streak-nudge, retention, and daily-challenge endpoints.
 */
import { sql } from 'drizzle-orm';

export interface DailyChallenge {
  challenge_id: string;
  title: string;
  difficulty: string;
}

interface Db {
  all: <T>(query: any) => Promise<T[]>;
  run: (query: any) => Promise<any>;
}

/**
 * Get today's daily challenge, auto-seeding one if none exists.
 * Returns null only if there are no eligible challenges in the DB at all.
 */
export async function getOrSeedDailyChallenge(db: Db): Promise<DailyChallenge | null> {
  const today = new Date().toISOString().split('T')[0];

  const [existing] = await db.all<DailyChallenge>(
    sql`SELECT dc.challenge_id, c.title, c.difficulty
        FROM daily_challenges dc JOIN challenges c ON dc.challenge_id = c.id
        WHERE dc.date = ${today} LIMIT 1`
  );

  if (existing) return existing;

  // Auto-seed: pick a challenge not recently used, never hard/impossible
  const recentDailies = await db.all<{ challenge_id: string }>(
    sql`SELECT challenge_id FROM daily_challenges ORDER BY date DESC LIMIT 5`
  );
  const recentIds = new Set(recentDailies.map(d => d.challenge_id));

  const allChallenges = await db.all<{ id: string; title: string; difficulty: string }>(
    sql`SELECT id, title, difficulty FROM challenges`
  );
  /* istanbul ignore next -- @preserve */
  const eligible = allChallenges.filter(c => !['hard', 'impossible'].includes(c.difficulty || ''));
  const candidates = eligible.filter(c => !recentIds.has(c.id));
  const pool = candidates.length > 0 ? candidates : eligible;

  /* istanbul ignore next -- @preserve */
  const easyPool = pool.filter(c => ['sprint', 'easy'].includes(c.difficulty || ''));
  const mediumPool = pool.filter(c => c.difficulty === 'medium');
  /* istanbul ignore next -- @preserve */
  const finalPool = easyPool.length > 0 ? easyPool : mediumPool.length > 0 ? mediumPool : pool;

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const picked = finalPool[dayOfYear % finalPool.length];

  if (!picked) return null;

  const newId = crypto.randomUUID();
  const [activeSeason] = await db.all<{ id: string }>(
    sql`SELECT id FROM seasons WHERE status = 'active' LIMIT 1`
  );
  await db.run(sql`INSERT INTO daily_challenges (id, challenge_id, date, season_id)
    VALUES (${newId}, ${picked.id}, ${today}, ${activeSeason?.id || null})`);

  return { challenge_id: picked.id, title: picked.title, difficulty: picked.difficulty };
}
