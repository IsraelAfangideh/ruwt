-- 0046_add_newsletter_subscribed.sql
-- Add newsletter_subscribed column to profiles.
-- This column existed on production (added manually) but was never in a migration,
-- causing preview D1 databases to fail on any INSERT into profiles.
ALTER TABLE profiles ADD COLUMN newsletter_subscribed INTEGER NOT NULL DEFAULT 1;
