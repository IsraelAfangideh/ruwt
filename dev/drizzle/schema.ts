import { pgTable, text, integer, timestamp, pgEnum, jsonb, uuid } from 'drizzle-orm/pg-core';

// Enums
export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard']);
export const attemptStatusEnum = pgEnum('attempt_status', [
  'in_progress',
  'submitted',
  'passed',
  'failed',
  'constraint_violated'
]);
export const transactionTypeEnum = pgEnum('transaction_type', ['purchase', 'ai_usage', 'refund']);
export const constraintTypeEnum = pgEnum('constraint_type', ['tokens', 'cost', 'time']);

// Users table (extends Supabase auth.users)
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  credits: integer('credits').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Challenges
export const challenges = pgTable('challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  difficulty: difficultyEnum('difficulty').notNull(),
  starterCode: text('starter_code'),
  testCases: jsonb('test_cases').notNull().$type<Array<{ input: string; expectedOutput: string }>>(),

  // Code execution constraints (Judge0)
  execTimeLimit: integer('exec_time_limit').default(5000),
  execMemoryLimit: integer('exec_memory_limit').default(256),

  // Challenge constraints (optional - null means no limit)
  maxTokens: integer('max_tokens'),
  maxCost: integer('max_cost'),
  wallClockLimit: integer('wall_clock_limit'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Attempts
export const attempts = pgTable('attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id),
  challengeId: uuid('challenge_id').notNull().references(() => challenges.id),
  status: attemptStatusEnum('status').default('in_progress').notNull(),
  totalCost: integer('total_cost').default(0).notNull(),
  inputTokens: integer('input_tokens').default(0).notNull(),
  outputTokens: integer('output_tokens').default(0).notNull(),
  finalCode: text('final_code'),
  passedTests: integer('passed_tests').default(0).notNull(),
  totalTests: integer('total_tests').default(0).notNull(),

  // Constraint tracking
  expiresAt: timestamp('expires_at'),
  violatedConstraint: constraintTypeEnum('violated_constraint'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  submittedAt: timestamp('submitted_at'),
});

// AI Calls (individual API calls within an attempt)
export const aiCalls = pgTable('ai_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  attemptId: uuid('attempt_id').notNull().references(() => attempts.id),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  cost: integer('cost').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Transactions (credit purchases, usage deductions)
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id),
  type: transactionTypeEnum('type').notNull(),
  amount: integer('amount').notNull(),
  stripeId: text('stripe_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Type exports
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
