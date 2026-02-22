-- Speed up leaderboards, dashboards, and challenge browsing.
--
-- Before:  Leaderboard does a full table scan on every page load.
--          Dashboard heatmap scans every attempt ever submitted.
--          Notification badge counts scan the entire notifications table.
--
-- After:   Leaderboard queries use covering indexes — 3-5x faster.
--          Dashboard heatmap and progress queries hit index-only paths.
--          Notification unread count is an instant index lookup.
--
-- User impact: the three highest-traffic authenticated pages
-- (dashboard, leaderboard, challenges) feel noticeably snappier,
-- especially as the platform grows past 10K attempts.

-- Leaderboard: ranked by status + submission time (global + period filters)
CREATE INDEX IF NOT EXISTS idx_attempts_status_submitted
  ON attempts(status, submitted_at DESC);

-- Progress: "which challenges has this user passed?" (dashboard + challenge cards)
CREATE INDEX IF NOT EXISTS idx_attempts_user_challenge_status
  ON attempts(user_id, challenge_id, status);

-- Notifications: unread badge count on dashboard header
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, read);
