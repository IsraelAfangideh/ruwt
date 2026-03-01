-- Demo data seed for assessment results dashboard
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=scripts/seed-demo.sql

-- === Candidate profiles ===
INSERT OR IGNORE INTO profiles (id, email, username, credits)
VALUES
  ('demo-candidate-a', 'alice.chen@example.com', 'alicechen', 50000),
  ('demo-candidate-b', 'bob.martinez@example.com', 'bobmartinez', 50000),
  ('demo-candidate-c', 'carol.nguyen@example.com', 'carolnguyen', 50000);

-- === Demo assessment ===
INSERT OR IGNORE INTO assessments (id, title, description, time_limit, status, created_by, org_id, company_name, company_logo_url, welcome_message, category_weights, pass_threshold, created_at)
VALUES (
  'demo-assessment-001',
  'Senior Full-Stack Engineer Assessment',
  'Evaluates AI-augmented coding efficiency across model selection, prompt crafting, and debugging. Candidates solve 5 challenges in 90 minutes.',
  5400,
  'active',
  'd7a63964-db06-40d8-b870-ecb16485313f',
  'de68250b-afe9-41e2-9205-e2574d4ebc3c',
  'Ruwt',
  NULL,
  'Welcome! You have 90 minutes to complete 5 coding challenges. Use AI wisely — efficiency matters as much as correctness.',
  '{"modelSelection":25,"promptEfficiency":25,"debugging":20,"strategy":20,"speed":10}',
  '{"enabled":true,"mode":"weighted_average","minOverall":60,"dimensions":{"modelSelection":50,"promptEfficiency":50,"debugging":40,"strategy":40,"speed":30}}',
  '2026-02-25T10:00:00Z'
);

-- === Link 5 challenges to the assessment ===
INSERT OR IGNORE INTO assessment_challenges (id, assessment_id, challenge_id, sort_order)
VALUES
  ('demo-ac-1', 'demo-assessment-001', 'string-formatter', 0),
  ('demo-ac-2', 'demo-assessment-001', 'one-shot-csv-parser', 1),
  ('demo-ac-3', 'demo-assessment-001', 'bug-hunt-off-by-one', 2),
  ('demo-ac-4', 'demo-assessment-001', 'regex-pattern-matcher', 3),
  ('demo-ac-5', 'demo-assessment-001', 'api-client-generator', 4);

-- === 3 invites ===
INSERT OR IGNORE INTO assessment_invites (id, assessment_id, candidate_email, candidate_name, token, status, expires_at, created_at)
VALUES
  ('demo-invite-a', 'demo-assessment-001', 'alice.chen@example.com', 'Alice Chen', 'demo-token-alice', 'completed', '2026-04-01T00:00:00Z', '2026-02-25T10:30:00Z'),
  ('demo-invite-b', 'demo-assessment-001', 'bob.martinez@example.com', 'Bob Martinez', 'demo-token-bob', 'completed', '2026-04-01T00:00:00Z', '2026-02-25T11:00:00Z'),
  ('demo-invite-c', 'demo-assessment-001', 'carol.nguyen@example.com', 'Carol Nguyen', 'demo-token-carol', 'started', '2026-04-01T00:00:00Z', '2026-02-25T11:30:00Z');

-- === 3 assessment sessions ===
-- Alice: completed, efficient ($2.40 total) — the PASS candidate
INSERT OR IGNORE INTO assessment_sessions (id, assessment_id, invite_id, user_id, status, current_challenge_index, total_cost, total_tokens, started_at, completed_at, expires_at, share_token, created_at)
VALUES (
  'demo-session-a', 'demo-assessment-001', 'demo-invite-a', 'demo-candidate-a',
  'completed', 5, 24000, 185000,
  '2026-02-26T09:00:00Z', '2026-02-26T10:12:00Z', '2026-02-26T10:30:00Z',
  'share-alice-demo', '2026-02-26T09:00:00Z'
);

-- Bob: completed, expensive ($8.70 total) — the REVIEW candidate
INSERT OR IGNORE INTO assessment_sessions (id, assessment_id, invite_id, user_id, status, current_challenge_index, total_cost, total_tokens, started_at, completed_at, expires_at, share_token, created_at)
VALUES (
  'demo-session-b', 'demo-assessment-001', 'demo-invite-b', 'demo-candidate-b',
  'completed', 5, 87000, 420000,
  '2026-02-27T14:00:00Z', '2026-02-27T15:25:00Z', '2026-02-27T15:30:00Z',
  'share-bob-demo', '2026-02-27T14:00:00Z'
);

-- Carol: in-progress (challenge 3 of 5)
INSERT OR IGNORE INTO assessment_sessions (id, assessment_id, invite_id, user_id, status, current_challenge_index, total_cost, total_tokens, started_at, completed_at, expires_at, share_token, created_at)
VALUES (
  'demo-session-c', 'demo-assessment-001', 'demo-invite-c', 'demo-candidate-c',
  'in_progress', 2, 15000, 95000,
  '2026-02-28T11:00:00Z', NULL, '2026-02-28T12:30:00Z',
  'share-carol-demo', '2026-02-28T11:00:00Z'
);

-- === ALICE's attempts (5/5 passed, efficient) ===
INSERT OR IGNORE INTO attempts (id, user_id, challenge_id, status, total_cost, input_tokens, output_tokens, passed_tests, total_tests, assessment_session_id, created_at, submitted_at)
VALUES
  ('demo-att-a1', 'demo-candidate-a', 'string-formatter', 'passed', 2800, 4200, 1800, 8, 8, 'demo-session-a', '2026-02-26T09:02:00Z', '2026-02-26T09:10:00Z'),
  ('demo-att-a2', 'demo-candidate-a', 'one-shot-csv-parser', 'passed', 3200, 5100, 2100, 10, 10, 'demo-session-a', '2026-02-26T09:12:00Z', '2026-02-26T09:25:00Z'),
  ('demo-att-a3', 'demo-candidate-a', 'bug-hunt-off-by-one', 'passed', 4500, 7200, 3000, 6, 6, 'demo-session-a', '2026-02-26T09:27:00Z', '2026-02-26T09:42:00Z'),
  ('demo-att-a4', 'demo-candidate-a', 'regex-pattern-matcher', 'passed', 6200, 9800, 4200, 12, 12, 'demo-session-a', '2026-02-26T09:44:00Z', '2026-02-26T10:00:00Z'),
  ('demo-att-a5', 'demo-candidate-a', 'api-client-generator', 'passed', 7300, 11500, 4800, 15, 15, 'demo-session-a', '2026-02-26T10:02:00Z', '2026-02-26T10:12:00Z');

-- === BOB's attempts (3/5 passed, expensive models) ===
INSERT OR IGNORE INTO attempts (id, user_id, challenge_id, status, total_cost, input_tokens, output_tokens, passed_tests, total_tests, assessment_session_id, created_at, submitted_at)
VALUES
  ('demo-att-b1', 'demo-candidate-b', 'string-formatter', 'passed', 12000, 18000, 8000, 8, 8, 'demo-session-b', '2026-02-27T14:02:00Z', '2026-02-27T14:18:00Z'),
  ('demo-att-b2', 'demo-candidate-b', 'one-shot-csv-parser', 'passed', 15000, 22000, 10000, 10, 10, 'demo-session-b', '2026-02-27T14:20:00Z', '2026-02-27T14:45:00Z'),
  ('demo-att-b3', 'demo-candidate-b', 'bug-hunt-off-by-one', 'failed', 18000, 28000, 12000, 3, 6, 'demo-session-b', '2026-02-27T14:47:00Z', '2026-02-27T15:05:00Z'),
  ('demo-att-b4', 'demo-candidate-b', 'regex-pattern-matcher', 'passed', 22000, 35000, 15000, 12, 12, 'demo-session-b', '2026-02-27T15:07:00Z', '2026-02-27T15:20:00Z'),
  ('demo-att-b5', 'demo-candidate-b', 'api-client-generator', 'failed', 20000, 32000, 14000, 8, 15, 'demo-session-b', '2026-02-27T15:22:00Z', '2026-02-27T15:25:00Z');

-- === CAROL's attempts (2/2 so far, in-progress) ===
INSERT OR IGNORE INTO attempts (id, user_id, challenge_id, status, total_cost, input_tokens, output_tokens, passed_tests, total_tests, assessment_session_id, created_at, submitted_at)
VALUES
  ('demo-att-c1', 'demo-candidate-c', 'string-formatter', 'passed', 5000, 7500, 3200, 8, 8, 'demo-session-c', '2026-02-28T11:02:00Z', '2026-02-28T11:15:00Z'),
  ('demo-att-c2', 'demo-candidate-c', 'one-shot-csv-parser', 'passed', 6000, 9200, 3800, 10, 10, 'demo-session-c', '2026-02-28T11:17:00Z', '2026-02-28T11:35:00Z'),
  ('demo-att-c3', 'demo-candidate-c', 'bug-hunt-off-by-one', 'in_progress', 4000, 6000, 2500, 0, 0, 'demo-session-c', '2026-02-28T11:37:00Z', NULL);

-- === AI CALLS (model diversity) ===
-- Alice: uses budget/mid-tier models efficiently
INSERT OR IGNORE INTO ai_calls (id, attempt_id, model, input_tokens, output_tokens, cost, created_at)
VALUES
  ('demo-ai-a1-1', 'demo-att-a1', 'llama-3.3-8b', 2800, 1200, 1800, '2026-02-26T09:03:00Z'),
  ('demo-ai-a1-2', 'demo-att-a1', 'llama-3.3-8b', 1400, 600, 1000, '2026-02-26T09:07:00Z'),
  ('demo-ai-a2-1', 'demo-att-a2', 'llama-3.3-8b', 3400, 1400, 2200, '2026-02-26T09:13:00Z'),
  ('demo-ai-a2-2', 'demo-att-a2', 'deepseek-r1-14b', 1700, 700, 1000, '2026-02-26T09:20:00Z'),
  ('demo-ai-a3-1', 'demo-att-a3', 'deepseek-r1-14b', 4800, 2000, 3000, '2026-02-26T09:28:00Z'),
  ('demo-ai-a3-2', 'demo-att-a3', 'llama-3.3-8b', 2400, 1000, 1500, '2026-02-26T09:36:00Z'),
  ('demo-ai-a4-1', 'demo-att-a4', 'llama-3.3-70b', 5200, 2200, 3500, '2026-02-26T09:45:00Z'),
  ('demo-ai-a4-2', 'demo-att-a4', 'llama-3.3-8b', 4600, 2000, 2700, '2026-02-26T09:55:00Z'),
  ('demo-ai-a5-1', 'demo-att-a5', 'deepseek-r1-14b', 6800, 2800, 4200, '2026-02-26T10:03:00Z'),
  ('demo-ai-a5-2', 'demo-att-a5', 'llama-3.3-8b', 4700, 2000, 3100, '2026-02-26T10:08:00Z');

-- Bob: uses premium models aggressively
INSERT OR IGNORE INTO ai_calls (id, attempt_id, model, input_tokens, output_tokens, cost, created_at)
VALUES
  ('demo-ai-b1-1', 'demo-att-b1', 'claude-3.5-sonnet', 9000, 4000, 6000, '2026-02-27T14:03:00Z'),
  ('demo-ai-b1-2', 'demo-att-b1', 'gpt-4o', 9000, 4000, 6000, '2026-02-27T14:10:00Z'),
  ('demo-ai-b2-1', 'demo-att-b2', 'claude-3.5-sonnet', 11000, 5000, 7500, '2026-02-27T14:21:00Z'),
  ('demo-ai-b2-2', 'demo-att-b2', 'gpt-4o', 11000, 5000, 7500, '2026-02-27T14:35:00Z'),
  ('demo-ai-b3-1', 'demo-att-b3', 'claude-3.5-sonnet', 14000, 6000, 9000, '2026-02-27T14:48:00Z'),
  ('demo-ai-b3-2', 'demo-att-b3', 'gpt-4o', 14000, 6000, 9000, '2026-02-27T14:58:00Z'),
  ('demo-ai-b4-1', 'demo-att-b4', 'claude-3.5-sonnet', 17500, 7500, 11000, '2026-02-27T15:08:00Z'),
  ('demo-ai-b4-2', 'demo-att-b4', 'gpt-4o', 17500, 7500, 11000, '2026-02-27T15:15:00Z'),
  ('demo-ai-b5-1', 'demo-att-b5', 'claude-3.5-sonnet', 16000, 7000, 10000, '2026-02-27T15:22:00Z'),
  ('demo-ai-b5-2', 'demo-att-b5', 'gpt-4o', 16000, 7000, 10000, '2026-02-27T15:24:00Z');

-- Carol: mixed strategy (mid-tier, some reasoning)
INSERT OR IGNORE INTO ai_calls (id, attempt_id, model, input_tokens, output_tokens, cost, created_at)
VALUES
  ('demo-ai-c1-1', 'demo-att-c1', 'llama-3.3-70b', 5000, 2100, 3200, '2026-02-28T11:03:00Z'),
  ('demo-ai-c1-2', 'demo-att-c1', 'deepseek-r1-14b', 2500, 1100, 1800, '2026-02-28T11:10:00Z'),
  ('demo-ai-c2-1', 'demo-att-c2', 'llama-3.3-70b', 6200, 2600, 4000, '2026-02-28T11:18:00Z'),
  ('demo-ai-c2-2', 'demo-att-c2', 'llama-3.3-8b', 3000, 1200, 2000, '2026-02-28T11:28:00Z'),
  ('demo-ai-c3-1', 'demo-att-c3', 'llama-3.3-70b', 4000, 1700, 2700, '2026-02-28T11:38:00Z'),
  ('demo-ai-c3-2', 'demo-att-c3', 'deepseek-r1-14b', 2000, 800, 1300, '2026-02-28T11:42:00Z');
