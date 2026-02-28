-- Fix notifications with "undefined" interpolation in title/body.
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=./drizzle/migrations-d1/0037_fix_undefined_notifications.sql

-- Delete streak reminders with broken "undefined" in the title
DELETE FROM notifications WHERE title LIKE '%undefined%';

-- Also clean up any body text that contains "undefined"
DELETE FROM notifications WHERE body LIKE '%undefined%';
