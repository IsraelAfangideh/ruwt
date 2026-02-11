/**
 * D1 (SQLite) schema for Cloudflare Pages Functions.
 * Use TEXT for UUIDs and enums; JSON stored as TEXT.
 * Timestamps stored as ISO strings for compatibility.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  credits: integer('credits').default(0).notNull(),
  accountType: text('account_type').default('individual').notNull(), // 'individual' | 'team'
  assessmentCredits: integer('assessment_credits').default(0).notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const challenges = sqliteTable('challenges', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  difficulty: text('difficulty').notNull(), // 'easy' | 'medium' | 'hard'
  starterCode: text('starter_code'),
  testCases: text('test_cases').notNull(), // JSON string

  execTimeLimit: integer('exec_time_limit').default(5000),
  execMemoryLimit: integer('exec_memory_limit').default(256),

  maxTokens: integer('max_tokens'),
  maxCost: integer('max_cost'),
  wallClockLimit: integer('wall_clock_limit'),

  category: text('category').default('practice'), // 'practice' | 'model_selection' | 'prompt_efficiency' | 'iterative_debugging'
  skillTested: text('skill_tested'),

  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const attempts = sqliteTable('attempts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  challengeId: text('challenge_id').notNull().references(() => challenges.id),
  status: text('status').default('in_progress').notNull(),
  totalCost: integer('total_cost').default(0).notNull(),
  inputTokens: integer('input_tokens').default(0).notNull(),
  outputTokens: integer('output_tokens').default(0).notNull(),
  finalCode: text('final_code'),
  passedTests: integer('passed_tests').default(0).notNull(),
  totalTests: integer('total_tests').default(0).notNull(),

  expiresAt: text('expires_at'),
  violatedConstraint: text('violated_constraint'),

  assessmentSessionId: text('assessment_session_id'),

  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  submittedAt: text('submitted_at'),
});

export const aiCalls = sqliteTable('ai_calls', {
  id: text('id').primaryKey(),
  attemptId: text('attempt_id').notNull().references(() => attempts.id),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  cost: integer('cost').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  type: text('type').notNull(), // 'purchase' | 'ai_usage' | 'refund' | 'signup_bonus' | 'assessment_purchase'
  amount: integer('amount').notNull(),
  stripeId: text('stripe_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Assessment tables ---

export const assessments = sqliteTable('assessments', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  timeLimit: integer('time_limit').notNull(), // seconds
  status: text('status').default('draft').notNull(), // 'draft' | 'active' | 'archived'
  createdBy: text('created_by').notNull().references(() => profiles.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const assessmentChallenges = sqliteTable('assessment_challenges', {
  id: text('id').primaryKey(),
  assessmentId: text('assessment_id').notNull().references(() => assessments.id),
  challengeId: text('challenge_id').notNull().references(() => challenges.id),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export const assessmentInvites = sqliteTable('assessment_invites', {
  id: text('id').primaryKey(),
  assessmentId: text('assessment_id').notNull().references(() => assessments.id),
  candidateEmail: text('candidate_email'),
  token: text('token').notNull().unique(),
  status: text('status').default('pending').notNull(), // 'pending' | 'started' | 'completed' | 'expired'
  expiresAt: text('expires_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const assessmentSessions = sqliteTable('assessment_sessions', {
  id: text('id').primaryKey(),
  assessmentId: text('assessment_id').notNull().references(() => assessments.id),
  inviteId: text('invite_id').references(() => assessmentInvites.id),
  userId: text('user_id').notNull().references(() => profiles.id),
  status: text('status').default('in_progress').notNull(), // 'in_progress' | 'completed' | 'expired' | 'abandoned'
  currentChallengeIndex: integer('current_challenge_index').default(0).notNull(),
  totalCost: integer('total_cost').default(0).notNull(),
  totalTokens: integer('total_tokens').default(0).notNull(),
  startedAt: text('started_at').default(sql`(datetime('now'))`).notNull(),
  completedAt: text('completed_at'),
  expiresAt: text('expires_at').notNull(),
  shareToken: text('share_token').unique(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Type exports ---

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Challenge = typeof challenges.$inferSelect;
export type NewChallenge = typeof challenges.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type AiCall = typeof aiCalls.$inferSelect;
export type NewAiCall = typeof aiCalls.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Assessment = typeof assessments.$inferSelect;
export type NewAssessment = typeof assessments.$inferInsert;
export type AssessmentChallenge = typeof assessmentChallenges.$inferSelect;
export type NewAssessmentChallenge = typeof assessmentChallenges.$inferInsert;
export type AssessmentInvite = typeof assessmentInvites.$inferSelect;
export type NewAssessmentInvite = typeof assessmentInvites.$inferInsert;
export type AssessmentSession = typeof assessmentSessions.$inferSelect;
export type NewAssessmentSession = typeof assessmentSessions.$inferInsert;

export type Difficulty = 'easy' | 'medium' | 'hard';
export type AttemptStatus = 'in_progress' | 'submitted' | 'passed' | 'failed' | 'constraint_violated';
export type TransactionType = 'purchase' | 'ai_usage' | 'refund' | 'signup_bonus' | 'assessment_purchase';
export type ConstraintType = 'tokens' | 'cost' | 'time';
export type ChallengeCategory = 'practice' | 'model_selection' | 'prompt_efficiency' | 'iterative_debugging';
export type AssessmentStatus = 'draft' | 'active' | 'archived';
export type InviteStatus = 'pending' | 'started' | 'completed' | 'expired';
export type SessionStatus = 'in_progress' | 'completed' | 'expired' | 'abandoned';
export type AccountType = 'individual' | 'team';
