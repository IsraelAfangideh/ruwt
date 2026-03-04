-- Teams free trial: add trial tracking columns
ALTER TABLE profiles ADD COLUMN trial_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN trial_started_at TEXT;
ALTER TABLE organizations ADD COLUMN trial_ends_at TEXT;
ALTER TABLE organizations ADD COLUMN trial_assessments_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN trial_invites_used INTEGER NOT NULL DEFAULT 0;
