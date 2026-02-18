-- Engagement features: streaks, badges, notifications, onboarding
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=./drizzle/migrations-d1/0002_engagement.sql

-- Add streak + onboarding columns to profiles
ALTER TABLE profiles ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN longest_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN last_streak_date TEXT;
ALTER TABLE profiles ADD COLUMN streak_freezes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0;

-- Badges / achievements
CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  badge_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  metadata TEXT,
  earned_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_badges_user ON badges(user_id);
CREATE UNIQUE INDEX idx_badges_user_type ON badges(user_id, badge_type);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at);

-- Seed Season 1
INSERT OR IGNORE INTO seasons (id, name, starts_at, ends_at, status)
VALUES ('season-1', 'Season 1: Genesis', '2026-02-18', '2026-05-18', 'active');
