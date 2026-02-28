-- Add digest_type column to newsletter_logs for tracking different email types
ALTER TABLE newsletter_logs ADD COLUMN digest_type TEXT DEFAULT 'daily';
