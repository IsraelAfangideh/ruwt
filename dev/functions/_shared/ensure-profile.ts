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

  if (insertResult.meta?.changes && insertResult.meta.changes > 0) {
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      type: 'signup_bonus',
      amount: SIGNUP_BONUS,
    });
  }
}
