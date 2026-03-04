-- Add code_snapshot column to attempt_messages for video-like replay experience
ALTER TABLE attempt_messages ADD COLUMN code_snapshot TEXT;
