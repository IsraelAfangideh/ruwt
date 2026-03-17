-- Session replay: R2 key for high-frequency event blobs, disclosure tracking
ALTER TABLE assessment_sessions ADD COLUMN replay_r2_key TEXT;
ALTER TABLE assessment_sessions ADD COLUMN disclosure_accepted INTEGER DEFAULT 0 NOT NULL;
