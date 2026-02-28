/**
 * After a user's first solve, notify users 1-2 positions above them
 * on the leaderboard that a new competitor has appeared.
 */
import { sql } from 'drizzle-orm';
import type { Db } from './db';

export async function createNewUserNearRankNotifications(
  db: Db,
  userId: string
): Promise<void> {
  const [solveCount] = await db.all<{ count: number }>(
    sql`SELECT COUNT(DISTINCT challenge_id) as count
        FROM attempts WHERE user_id = ${userId} AND status = 'passed'`
  );
  if ((solveCount?.count ?? 0) !== 1) return;

  const [user] = await db.all<{ name: string | null }>(
    sql`SELECT name FROM profiles WHERE id = ${userId}`
  );
  const userName = user?.name || 'A new user';

  const leaderboard = await db.all<{ user_id: string; solve_count: number }>(
    sql`SELECT user_id, COUNT(DISTINCT challenge_id) as solve_count
        FROM attempts WHERE status = 'passed'
        GROUP BY user_id
        ORDER BY solve_count DESC`
  );

  const userIndex = leaderboard.findIndex(r => r.user_id === userId);
  if (userIndex === -1) return;

  const toNotify = leaderboard
    .slice(Math.max(0, userIndex - 2), userIndex)
    .filter(r => r.user_id !== userId);

  for (const target of toNotify) {
    const gap = target.solve_count - (leaderboard[userIndex]?.solve_count ?? 0);
    await db.run(sql`INSERT INTO notifications (id, user_id, type, title, body, metadata)
      VALUES (
        ${crypto.randomUUID()},
        ${target.user_id},
        'leaderboard_change',
        ${`${userName} joined the leaderboard`},
        ${gap === 0 ? `${userName} is tied with you.` : `${userName} is ${gap} solve${gap > 1 ? 's' : ''} behind you.`},
        ${JSON.stringify({ newUserId: userId, gap })}
      )`);
  }
}
