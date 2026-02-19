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
  username: text('username').unique(),
  bio: text('bio'),
  linkedinUrl: text('linkedin_url'),
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  lastStreakDate: text('last_streak_date'), // YYYY-MM-DD of last daily solve
  streakFreezes: integer('streak_freezes').default(0).notNull(),
  onboardingCompleted: integer('onboarding_completed').default(0).notNull(),
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

  sortOrder: integer('sort_order').default(0),
  tier: text('tier').default('core'), // 'onboarding' | 'core' | 'headline'

  language: text('language').default('javascript'), // 'javascript' | 'typescript' | 'python'
  tags: text('tags'), // JSON array: ["backend","async","testing"]

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
  replayPublic: integer('replay_public').default(1).notNull(),
  usedByok: integer('used_byok').default(0).notNull(),
  usedHosted: integer('used_hosted').default(0).notNull(),

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
  categoryWeights: text('category_weights'), // JSON: { modelSelection: number, promptEfficiency: number, debugging: number, strategy: number, speed: number }
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

// --- Replay / message history ---

export const attemptMessages = sqliteTable('attempt_messages', {
  id: text('id').primaryKey(),
  attemptId: text('attempt_id').notNull().references(() => attempts.id),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  cost: integer('cost'),
  sequence: integer('sequence').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Seasons ---

export const seasons = sqliteTable('seasons', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  startsAt: text('starts_at').notNull(),
  endsAt: text('ends_at').notNull(),
  status: text('status').default('upcoming'), // 'upcoming' | 'active' | 'completed'
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// --- Daily Challenges ---

export const dailyChallenges = sqliteTable('daily_challenges', {
  id: text('id').primaryKey(),
  challengeId: text('challenge_id').notNull().references(() => challenges.id),
  date: text('date').notNull().unique(),
  seasonId: text('season_id').references(() => seasons.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// --- Replay Comments ---

export const replayComments = sqliteTable('replay_comments', {
  id: text('id').primaryKey(),
  attemptId: text('attempt_id').notNull().references(() => attempts.id),
  userId: text('user_id').notNull().references(() => profiles.id),
  content: text('content').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// --- Certificates ---

export const certificates = sqliteTable('certificates', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  type: text('type').notNull(), // 'track_completion' | 'daily_streak' | 'efficiency_master'
  title: text('title').notNull(),
  metadata: text('metadata'), // JSON
  shareToken: text('share_token').unique(),
  earnedAt: text('earned_at').default(sql`(datetime('now'))`),
});

// --- Badges / Achievements ---

export const badges = sqliteTable('badges', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  badgeType: text('badge_type').notNull(), // e.g. 'first_solve', 'streak_7', 'penny_pincher'
  title: text('title').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(), // emoji or icon key
  metadata: text('metadata'), // JSON — extra context like { streak: 30, challengeId: '...' }
  earnedAt: text('earned_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Notifications ---

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  type: text('type').notNull(), // 'badge_earned' | 'streak_reminder' | 'leaderboard_change' | 'new_challenge' | 'competitive_nudge'
  title: text('title').notNull(),
  body: text('body').notNull(),
  metadata: text('metadata'), // JSON — link targets, badge IDs, etc.
  read: integer('read').default(0).notNull(),
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
export type AttemptMessage = typeof attemptMessages.$inferSelect;
export type NewAttemptMessage = typeof attemptMessages.$inferInsert;

export type Difficulty = 'sprint' | 'easy' | 'medium' | 'hard' | 'impossible';
export type AttemptStatus = 'in_progress' | 'submitted' | 'passed' | 'failed' | 'constraint_violated';
export type TransactionType = 'purchase' | 'ai_usage' | 'refund' | 'signup_bonus' | 'assessment_purchase';
export type ConstraintType = 'tokens' | 'cost' | 'time';
export type ChallengeCategory = 'practice' | 'model_selection' | 'prompt_efficiency' | 'iterative_debugging' | 'multi_model_strategy' | 'real_world' | 'qa_testing' | 'frontend' | 'backend_api' | 'data_engineering' | 'devops';
export type ChallengeLanguage = 'javascript' | 'typescript' | 'python';
export type CertificateType = 'track_completion' | 'daily_streak' | 'efficiency_master';
export type BadgeType = 'first_solve' | 'streak_3' | 'streak_7' | 'streak_30' | 'streak_100' | 'penny_pincher' | 'speed_demon' | 'model_master' | 'polyglot' | 'clean_sweep_easy' | 'clean_sweep_medium' | 'ten_solves' | 'twenty_five_solves' | 'fifty_solves' | 'daily_warrior';
export type NotificationType = 'badge_earned' | 'streak_reminder' | 'leaderboard_change' | 'new_challenge' | 'competitive_nudge';
export type AssessmentStatus = 'draft' | 'active' | 'archived';
export type InviteStatus = 'pending' | 'started' | 'completed' | 'expired';
export type SessionStatus = 'in_progress' | 'completed' | 'expired' | 'abandoned';
export type AccountType = 'individual' | 'team';
export type SeasonStatus = 'upcoming' | 'active' | 'completed';
export type ChallengeTier = 'onboarding' | 'core' | 'headline';

export type Season = typeof seasons.$inferSelect;
export type NewSeason = typeof seasons.$inferInsert;
export type DailyChallenge = typeof dailyChallenges.$inferSelect;
export type NewDailyChallenge = typeof dailyChallenges.$inferInsert;
export type ReplayComment = typeof replayComments.$inferSelect;
export type NewReplayComment = typeof replayComments.$inferInsert;
export type Certificate = typeof certificates.$inferSelect;
export type NewCertificate = typeof certificates.$inferInsert;
export type Badge = typeof badges.$inferSelect;
export type NewBadge = typeof badges.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
