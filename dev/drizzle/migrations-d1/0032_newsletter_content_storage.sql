-- 0032_newsletter_content_storage.sql
-- Store full newsletter content for retrieval + Resend ID for deliverability tracking.
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=./drizzle/migrations-d1/0032_newsletter_content_storage.sql

ALTER TABLE newsletter_logs ADD COLUMN html_body TEXT;
ALTER TABLE newsletter_logs ADD COLUMN text_body TEXT;
ALTER TABLE newsletter_logs ADD COLUMN resend_id TEXT;
ALTER TABLE newsletter_logs ADD COLUMN user_id TEXT;
ALTER TABLE newsletter_logs ADD COLUMN user_state TEXT;
ALTER TABLE newsletter_logs ADD COLUMN personal_hook TEXT;
