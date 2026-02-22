-- Performance indexes for assessment and challenge queries.
-- Eliminates full table scans on the most common lookup patterns.

-- Attempts: looked up by session (results/analytics) and by user+challenge (progress)
CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts(assessment_session_id);
CREATE INDEX IF NOT EXISTS idx_attempts_challenge_status ON attempts(challenge_id, status);
CREATE INDEX IF NOT EXISTS idx_attempts_user_status ON attempts(user_id, status);

-- AI calls: always looked up by attempt
CREATE INDEX IF NOT EXISTS idx_ai_calls_attempt ON ai_calls(attempt_id);

-- Assessment sessions: looked up by assessment + status (completion counts, results)
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_aid_status ON assessment_sessions(assessment_id, status);

-- Assessment challenges: looked up by assessment (challenge counts, builder)
CREATE INDEX IF NOT EXISTS idx_assessment_challenges_aid ON assessment_challenges(assessment_id);

-- Assessment invites: looked up by assessment (invite counts)
CREATE INDEX IF NOT EXISTS idx_assessment_invites_aid ON assessment_invites(assessment_id);

-- Assessments: looked up by creator
CREATE INDEX IF NOT EXISTS idx_assessments_created_by ON assessments(created_by);

-- Profiles: looked up by email during invite flows
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
