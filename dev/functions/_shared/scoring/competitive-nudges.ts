/**
 * After a successful solve, check if it beats any existing solve on that
 * challenge and notify the beaten users via in-app notification.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '../infra/db';

export async function createCompetitiveNudges(
  db: Db,
  solverId: string,
  challengeId: string,
  solverCost: number
): Promise<void> {
  const beaten = await db.all<{
    user_id: string;
    best_cost: number;
    challenge_title: string;
  }>(sql`
    SELECT a.user_id, MIN(a.total_cost) as best_cost, c.title as challenge_title
    FROM attempts a
    JOIN challenges c ON a.challenge_id = c.id
    WHERE a.challenge_id = ${challengeId}
      AND a.status = 'passed'
      AND a.user_id != ${solverId}
      AND a.total_cost > ${solverCost}
    GROUP BY a.user_id
  `);

  if (beaten.length === 0) return;

  const [solver] = await db.all<{ name: string | null }>(
    sql`SELECT name FROM profiles WHERE id = ${solverId}`
  );
  const solverName = solver?.name || 'Someone';

  for (const b of beaten) {
    const challengeTitle = b.challenge_title || 'a challenge';
    /* istanbul ignore next -- @preserve */
    const solverCostDisplay = (solverCost ?? 0) / 10000;
    const beatenCostDisplay = (b.best_cost ?? 0) / 10000;
    await db.run(sql`INSERT INTO notifications (id, user_id, type, title, body, metadata)
      VALUES (
        ${crypto.randomUUID()},
        ${b.user_id},
        'competitive_nudge',
        ${`${solverName} beat your solution`},
        ${`${solverName} solved "${challengeTitle}" for $${solverCostDisplay.toFixed(4)}. your best was $${beatenCostDisplay.toFixed(4)}.`},
        ${JSON.stringify({ challengeId, solverUserId: solverId, solverCost, beatenCost: b.best_cost })}
      )`);
  }
}
