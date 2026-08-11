/**
 * In-memory SQLite test database using better-sqlite3 + Drizzle.
 *
 * Provides a real Drizzle ORM instance backed by an in-memory SQLite DB
 * for integration tests that need actual SQL execution (not mocked chains).
 *
 * Usage:
 *   import { createTestDb, resetDb } from './test-db';
 *   const { db, sqlite } = createTestDb();
 *   // ... run tests with `db` (Drizzle instance) ...
 *   resetDb(sqlite);   // truncate all tables between tests
 *   sqlite.close();    // cleanup after suite
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../../drizzle/schema.d1';

/**
 * DDL statements that replicate the current D1 schema in-memory.
 * Kept in sync with drizzle/schema.d1.ts — add new tables here when schema evolves.
 */
const DDL = `
-- Core tables
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  credits INTEGER DEFAULT 0 NOT NULL,
  account_type TEXT DEFAULT 'individual' NOT NULL,
  assessment_credits INTEGER DEFAULT 0 NOT NULL,
  username TEXT UNIQUE,
  bio TEXT,
  linkedin_url TEXT,
  current_streak INTEGER DEFAULT 0 NOT NULL,
  longest_streak INTEGER DEFAULT 0 NOT NULL,
  last_streak_date TEXT,
  streak_freezes INTEGER DEFAULT 0 NOT NULL,
  onboarding_completed INTEGER DEFAULT 0 NOT NULL,
  newsletter_subscribed INTEGER DEFAULT 1 NOT NULL,
  timezone TEXT,
  leaderboard_excluded INTEGER DEFAULT 0 NOT NULL,
  trial_used INTEGER DEFAULT 0 NOT NULL,
  preferred_mode TEXT,
  afi_score INTEGER DEFAULT 0 NOT NULL,
  afi_tier TEXT DEFAULT 'novice' NOT NULL,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  landing_path TEXT,
  attributed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  starter_code TEXT,
  test_cases TEXT NOT NULL,
  hidden_test_cases TEXT,
  test_harness TEXT,
  readonly_prefix TEXT,
  use_stdin INTEGER DEFAULT 0 NOT NULL,
  exec_time_limit INTEGER DEFAULT 5000,
  exec_memory_limit INTEGER DEFAULT 256,
  max_tokens INTEGER,
  max_cost INTEGER,
  wall_clock_limit INTEGER,
  category TEXT DEFAULT 'practice',
  skill_tested TEXT,
  sort_order INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'core',
  language TEXT DEFAULT 'javascript',
  tags TEXT,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  challenge_id TEXT NOT NULL REFERENCES challenges(id),
  status TEXT DEFAULT 'in_progress' NOT NULL,
  total_cost INTEGER DEFAULT 0 NOT NULL,
  input_tokens INTEGER DEFAULT 0 NOT NULL,
  output_tokens INTEGER DEFAULT 0 NOT NULL,
  final_code TEXT,
  passed_tests INTEGER DEFAULT 0 NOT NULL,
  total_tests INTEGER DEFAULT 0 NOT NULL,
  expires_at TEXT,
  violated_constraint TEXT,
  assessment_session_id TEXT,
  replay_public INTEGER DEFAULT 1 NOT NULL,
  used_byok INTEGER DEFAULT 0 NOT NULL,
  used_hosted INTEGER DEFAULT 0 NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  submitted_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_calls (
  id TEXT PRIMARY KEY NOT NULL,
  attempt_id TEXT NOT NULL REFERENCES attempts(id),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  stripe_id TEXT,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  domain TEXT,
  created_by TEXT NOT NULL REFERENCES profiles(id),
  assessment_credits INTEGER DEFAULT 0 NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'none' NOT NULL,
  subscription_plan TEXT,
  subscription_ends_at TEXT,
  trial_started_at TEXT,
  trial_ends_at TEXT,
  trial_assessments_used INTEGER DEFAULT 0 NOT NULL,
  trial_invites_used INTEGER DEFAULT 0 NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES profiles(id),
  role TEXT DEFAULT 'member' NOT NULL,
  invited_by TEXT REFERENCES profiles(id),
  joined_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS org_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' NOT NULL,
  expires_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES profiles(id),
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

-- Custom Challenges
CREATE TABLE IF NOT EXISTS custom_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medium' NOT NULL,
  starter_code TEXT,
  test_cases TEXT NOT NULL,
  hidden_test_cases TEXT,
  test_harness TEXT,
  exec_time_limit INTEGER DEFAULT 5000,
  exec_memory_limit INTEGER DEFAULT 256,
  category TEXT DEFAULT 'practice',
  skill_tested TEXT,
  language TEXT DEFAULT 'javascript',
  tags TEXT,
  status TEXT DEFAULT 'draft' NOT NULL,
  created_by TEXT NOT NULL REFERENCES profiles(id),
  reviewed_by TEXT REFERENCES profiles(id),
  reviewed_at TEXT,
  ai_generated INTEGER DEFAULT 0 NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

-- Assessments
CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  time_limit INTEGER NOT NULL,
  status TEXT DEFAULT 'draft' NOT NULL,
  created_by TEXT NOT NULL REFERENCES profiles(id),
  category_weights TEXT,
  company_name TEXT,
  company_logo_url TEXT,
  welcome_message TEXT,
  org_id TEXT REFERENCES organizations(id),
  pass_threshold TEXT,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS assessment_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  assessment_id TEXT NOT NULL REFERENCES assessments(id),
  challenge_id TEXT NOT NULL REFERENCES challenges(id),
  custom_challenge_id TEXT REFERENCES custom_challenges(id),
  sort_order INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS assessment_invites (
  id TEXT PRIMARY KEY NOT NULL,
  assessment_id TEXT NOT NULL REFERENCES assessments(id),
  candidate_email TEXT,
  candidate_name TEXT,
  token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' NOT NULL,
  expires_at TEXT,
  last_reminder_at TEXT,
  reminder_count INTEGER DEFAULT 0 NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS assessment_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  assessment_id TEXT NOT NULL REFERENCES assessments(id),
  invite_id TEXT REFERENCES assessment_invites(id),
  user_id TEXT NOT NULL REFERENCES profiles(id),
  status TEXT DEFAULT 'in_progress' NOT NULL,
  current_challenge_index INTEGER DEFAULT 0 NOT NULL,
  total_cost INTEGER DEFAULT 0 NOT NULL,
  total_tokens INTEGER DEFAULT 0 NOT NULL,
  started_at TEXT DEFAULT (datetime('now')) NOT NULL,
  completed_at TEXT,
  expires_at TEXT NOT NULL,
  share_token TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

-- Email & Agent Logs
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  assessment_id TEXT REFERENCES assessments(id),
  invite_id TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  sent_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_conversations (
  id TEXT PRIMARY KEY NOT NULL,
  assessment_id TEXT REFERENCES assessments(id),
  org_id TEXT REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES profiles(id),
  messages TEXT DEFAULT '[]' NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL
);

-- Replay / Messages
CREATE TABLE IF NOT EXISTS attempt_messages (
  id TEXT PRIMARY KEY NOT NULL,
  attempt_id TEXT NOT NULL REFERENCES attempts(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost INTEGER,
  code_snapshot TEXT,
  sequence INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

-- Seasons & Daily
CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT DEFAULT 'upcoming',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  challenge_id TEXT NOT NULL REFERENCES challenges(id),
  date TEXT NOT NULL UNIQUE,
  season_id TEXT REFERENCES seasons(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Social
CREATE TABLE IF NOT EXISTS replay_comments (
  id TEXT PRIMARY KEY NOT NULL,
  attempt_id TEXT NOT NULL REFERENCES attempts(id),
  user_id TEXT NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS challenge_comments (
  id TEXT PRIMARY KEY NOT NULL,
  challenge_id TEXT NOT NULL REFERENCES challenges(id),
  user_id TEXT NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  solve_cost INTEGER,
  parent_id TEXT,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS reactions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  metadata TEXT,
  share_token TEXT UNIQUE,
  earned_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  badge_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  metadata TEXT,
  earned_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS error_logs (
  id TEXT PRIMARY KEY NOT NULL,
  timestamp TEXT DEFAULT (datetime('now')) NOT NULL,
  level TEXT NOT NULL DEFAULT 'error',
  endpoint TEXT,
  method TEXT,
  user_id TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  request_body TEXT,
  suggested_fix TEXT,
  email_sent INTEGER NOT NULL DEFAULT 0,
  resolved INTEGER NOT NULL DEFAULT 0,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS newsletter_logs (
  id TEXT PRIMARY KEY NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  html_body TEXT,
  text_body TEXT,
  resend_id TEXT,
  user_id TEXT,
  user_state TEXT,
  personal_hook TEXT,
  digest_type TEXT DEFAULT 'daily',
  sent_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata TEXT,
  read INTEGER DEFAULT 0 NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS follows (
  id TEXT PRIMARY KEY NOT NULL,
  follower_id TEXT NOT NULL REFERENCES profiles(id),
  following_id TEXT NOT NULL REFERENCES profiles(id),
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  badge_earned INTEGER DEFAULT 1 NOT NULL,
  streak_reminder INTEGER DEFAULT 1 NOT NULL,
  leaderboard_change INTEGER DEFAULT 1 NOT NULL,
  new_challenge INTEGER DEFAULT 1 NOT NULL,
  competitive_nudge INTEGER DEFAULT 1 NOT NULL,
  comment_reply INTEGER DEFAULT 1 NOT NULL,
  comment_on_solved INTEGER DEFAULT 1 NOT NULL,
  replay_comment INTEGER DEFAULT 1 NOT NULL,
  reaction_received INTEGER DEFAULT 1 NOT NULL,
  mention INTEGER DEFAULT 1 NOT NULL,
  new_follower INTEGER DEFAULT 1 NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS afi_history (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  score INTEGER NOT NULL,
  tier TEXT NOT NULL,
  solve_count INTEGER DEFAULT 0 NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now')) NOT NULL
);
`;

/** All table names in reverse dependency order (children before parents) for safe deletion. */
const TABLE_NAMES = [
  'afi_history',
  'notification_preferences',
  'bookmarks',
  'follows',
  'notifications',
  'newsletter_logs',
  'error_logs',
  'badges',
  'certificates',
  'reactions',
  'challenge_comments',
  'replay_comments',
  'daily_challenges',
  'seasons',
  'attempt_messages',
  'agent_conversations',
  'email_logs',
  'assessment_sessions',
  'assessment_invites',
  'assessment_challenges',
  'assessments',
  'custom_challenges',
  'org_invitations',
  'org_members',
  'organizations',
  'transactions',
  'ai_calls',
  'attempts',
  'challenges',
  'profiles',
];

export interface TestDb {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sqlite: InstanceType<typeof Database>;
}

/**
 * Create an in-memory SQLite database with all schema tables.
 * Returns a Drizzle ORM instance and the underlying better-sqlite3 handle.
 */
export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:');
  // Enable foreign keys for realistic constraint enforcement
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(DDL);

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

/**
 * Truncate all tables (delete all rows) while preserving schema.
 * Respects FK ordering — children deleted before parents.
 */
export function resetDb(sqlite: InstanceType<typeof Database>): void {
  // Temporarily disable FK checks for clean truncation
  sqlite.pragma('foreign_keys = OFF');
  for (const table of TABLE_NAMES) {
    sqlite.exec(`DELETE FROM ${table}`);
  }
  sqlite.pragma('foreign_keys = ON');
}
