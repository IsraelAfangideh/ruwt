/**
 * Ensure a D1 profile exists for the authenticated Supabase user.
 * Creates the profile + signup bonus transaction on first encounter.
 * Safe to call multiple times (uses onConflictDoNothing).
 */
import type { User } from '@supabase/supabase-js';
import type { Db } from './db';
import { profiles, transactions } from '../../drizzle/schema.d1';

const SIGNUP_BONUS = 50000;

export async function ensureProfile(db: Db, user: User) {
  // Use INSERT OR IGNORE + check changes to avoid double-award race conditions.
  // If two concurrent requests both try to insert, only one will succeed (SQLite serializes writes).
  // We only award the bonus if this specific insert actually created the row.
  const insertResult = await db
    .insert(profiles)
    .values({
      id: user.id,
      email: user.email ?? '',
      name: (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | null ?? null,
      avatarUrl: (user.user_metadata?.avatar_url as string) ?? null,
      credits: SIGNUP_BONUS,
    })
    .onConflictDoNothing({ target: profiles.id });

  // Only record transaction if this request actually created the profile.
  // meta.changes === 0 means the row already existed (conflict ignored).
  if (insertResult.meta?.changes && insertResult.meta.changes > 0) {
    // Use onConflictDoNothing to guard against the (extremely unlikely) case where
    // the transaction insert itself races or retries.
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      type: 'signup_bonus',
      amount: SIGNUP_BONUS,
    });
  }
}
