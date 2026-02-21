-- ============================================================
-- 0023_hiring_platform_overhaul.sql
-- Adds: organizations, org members, org invitations,
--       custom challenges, email logs, agent conversations,
--       pass/fail thresholds, assessment org ownership
-- ============================================================

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  domain TEXT,
  created_by TEXT NOT NULL REFERENCES profiles(id),
  assessment_credits INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Organization members
CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES profiles(id),
  role TEXT NOT NULL DEFAULT 'member',
  invited_by TEXT REFERENCES profiles(id),
  joined_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_unique ON org_members(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);

-- 3. Organization invitations (team member invites, NOT candidate invites)
CREATE TABLE IF NOT EXISTS org_invitations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES profiles(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON org_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON org_invitations(email);

-- 4. Custom challenges (org-owned, optionally AI-generated)
CREATE TABLE IF NOT EXISTS custom_challenges (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  starter_code TEXT,
  test_cases TEXT NOT NULL,
  hidden_test_cases TEXT,
  test_harness TEXT,
  exec_time_limit INTEGER DEFAULT 5000,
  exec_memory_limit INTEGER DEFAULT 256,
  category TEXT DEFAULT 'practice',
  skill_tested TEXT,
  language TEXT DEFAULT 'javascript',
  tags TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL REFERENCES profiles(id),
  reviewed_by TEXT REFERENCES profiles(id),
  reviewed_at TEXT,
  ai_generated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_custom_challenges_org ON custom_challenges(org_id);

-- 5. Email notification logs
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  assessment_id TEXT REFERENCES assessments(id),
  invite_id TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_logs_assessment ON email_logs(assessment_id);

-- 6. AI agent conversations (for assessment builder)
CREATE TABLE IF NOT EXISTS agent_conversations (
  id TEXT PRIMARY KEY,
  assessment_id TEXT REFERENCES assessments(id),
  org_id TEXT REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES profiles(id),
  messages TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Add org ownership + pass threshold to assessments
ALTER TABLE assessments ADD COLUMN org_id TEXT REFERENCES organizations(id);
ALTER TABLE assessments ADD COLUMN pass_threshold TEXT;

-- 8. Add candidate tracking to invites
ALTER TABLE assessment_invites ADD COLUMN candidate_name TEXT;
ALTER TABLE assessment_invites ADD COLUMN last_reminder_at TEXT;
ALTER TABLE assessment_invites ADD COLUMN reminder_count INTEGER NOT NULL DEFAULT 0;

-- 9. Support custom challenges in assessment challenge links
ALTER TABLE assessment_challenges ADD COLUMN custom_challenge_id TEXT REFERENCES custom_challenges(id);
