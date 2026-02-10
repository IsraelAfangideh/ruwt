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
  type: text('type').notNull(), // 'purchase' | 'ai_usage' | 'refund'
  amount: integer('amount').notNull(),
  stripeId: text('stripe_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

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

export type Difficulty = 'easy' | 'medium' | 'hard';
export type AttemptStatus = 'in_progress' | 'submitted' | 'passed' | 'failed' | 'constraint_violated';
export type TransactionType = 'purchase' | 'ai_usage' | 'refund';
export type ConstraintType = 'tokens' | 'cost' | 'time';
