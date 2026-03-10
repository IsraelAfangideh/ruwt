-- Add preferred_mode column to profiles for persisting Practice/Hiring mode preference
ALTER TABLE profiles ADD COLUMN preferred_mode TEXT DEFAULT NULL;
