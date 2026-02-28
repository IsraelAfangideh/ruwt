-- Add leaderboard_excluded column to profiles for QA/system accounts
ALTER TABLE profiles ADD COLUMN leaderboard_excluded INTEGER NOT NULL DEFAULT 0;
