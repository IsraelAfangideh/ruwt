-- Social features: follows, bookmarks, notification preferences
-- Migration 0052

-- Follows table
CREATE TABLE IF NOT EXISTS follows (
  id TEXT PRIMARY KEY,
  follower_id TEXT NOT NULL REFERENCES profiles(id),
  following_id TEXT NOT NULL REFERENCES profiles(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- Bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  target_type TEXT NOT NULL, -- 'challenge' | 'replay'
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id, created_at);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) UNIQUE,
  badge_earned INTEGER NOT NULL DEFAULT 1,
  streak_reminder INTEGER NOT NULL DEFAULT 1,
  leaderboard_change INTEGER NOT NULL DEFAULT 1,
  new_challenge INTEGER NOT NULL DEFAULT 1,
  competitive_nudge INTEGER NOT NULL DEFAULT 1,
  comment_reply INTEGER NOT NULL DEFAULT 1,
  comment_on_solved INTEGER NOT NULL DEFAULT 1,
  replay_comment INTEGER NOT NULL DEFAULT 1,
  reaction_received INTEGER NOT NULL DEFAULT 1,
  mention INTEGER NOT NULL DEFAULT 1,
  new_follower INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
