/**
 * Smart challenge recommendations based on user's solved categories,
 * difficulty progression, and success patterns.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '../infra/db';

export interface SmartRecommendation {
  id: string;
  title: string;
  difficulty: string;
  category: string;
  reason: string;
}

export async function getSmartRecommendations(
  db: Db,
  userId: string,
  count: number = 3
): Promise<SmartRecommendation[]> {
  const [solved, allChallenges] = await Promise.all([
    db.all<{ challenge_id: string; category: string; difficulty: string }>(sql`
      SELECT DISTINCT a.challenge_id, c.category, c.difficulty
      FROM attempts a JOIN challenges c ON a.challenge_id = c.id
      WHERE a.user_id = ${userId} AND a.status = 'passed'
    `),
    db.all<{ id: string; title: string; difficulty: string; category: string; tier: string; sort_order: number }>(
      sql`SELECT id, title, difficulty, category, tier, sort_order FROM challenges`
    ),
  ]);

  const solvedIds = new Set(solved.map(s => s.challenge_id));
  const unsolved = allChallenges.filter(c => !solvedIds.has(c.id));
  if (unsolved.length === 0) return [];

  const categorySolves: Record<string, number> = {};
  const categoryTotals: Record<string, number> = {};
  for (const s of solved) categorySolves[s.category] = (categorySolves[s.category] || 0) + 1;
  for (const c of allChallenges) categoryTotals[c.category] = (categoryTotals[c.category] || 0) + 1;

  const diffOrder: Record<string, number> = { sprint: 0, easy: 1, medium: 2, hard: 3, impossible: 4 };
  /* istanbul ignore next -- @preserve */
  const highestDiff = Math.max(0, ...solved.map(s => diffOrder[s.difficulty] ?? 0));

  const scored = unsolved.map(c => {
    let score = 0;
    const catSolves = categorySolves[c.category] || 0;
    /* istanbul ignore next -- @preserve */
    const catTotal = categoryTotals[c.category] || 1;
    /* istanbul ignore next -- @preserve */
    const diff = diffOrder[c.difficulty] ?? 2;

    if (catSolves > 0 && catSolves < catTotal) score += 30;
    if (diff === highestDiff) score += 20;
    if (diff === highestDiff + 1) score += 15;
    /* istanbul ignore next -- @preserve */
    if (c.tier === 'onboarding') score += 10;
    else if (c.tier === 'core') score += 5;
    score -= (c.sort_order || 0) * 0.1;

    let reason = '';
    if (catSolves > 0 && catSolves < catTotal) reason = `${catSolves}/${catTotal} ${c.category} solved`;
    else if (diff === highestDiff + 1) reason = `step up to ${c.difficulty}`;
    else reason = `${c.difficulty} ${c.category}`;

    return { ...c, score, reason };
  });

  scored.sort((a, b) => b.score - a.score);

  const result: SmartRecommendation[] = [];
  const usedCategories = new Set<string>();

  for (const c of scored) {
    if (result.length >= count) break;
    if (result.length < count - 1 && usedCategories.has(c.category)) continue;
    result.push({ id: c.id, title: c.title, difficulty: c.difficulty, category: c.category, reason: c.reason });
    usedCategories.add(c.category);
  }

  if (result.length < count) {
    const resultIds = new Set(result.map(r => r.id));
    for (const c of scored) {
      if (result.length >= count) break;
      if (resultIds.has(c.id)) continue;
      result.push({ id: c.id, title: c.title, difficulty: c.difficulty, category: c.category, reason: c.reason });
    }
  }

  return result;
}
