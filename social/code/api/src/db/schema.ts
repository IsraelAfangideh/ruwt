import { pgTable, text, uuid, vector, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const runners = pgTable('runners', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  kind: text('kind').notNull().default('rewrite'),
  personality: text('personality').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  // Vector embedding for personality matching (1536 dims, standard for OpenAI-compatible embeddings)
  embedding: vector('embedding', { dimensions: 1536 }), 
});

export const memories = pgTable('memories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(), // Simple string ID for CLI MVP
  content: text('content').notNull(), // "I want to be kinder"
  createdAt: timestamp('created_at').defaultNow(),
});

export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  runner: text('runner').notNull(),
  reason: text('reason').notNull(),
  details: text('details'),
  contactEmail: text('contact_email'),
  ipAddress: text('ip_address'),
  messages: jsonb('messages'),
  clientMeta: jsonb('client_meta'),
  notificationSent: boolean('notification_sent').default(false).notNull(),
  notifiedAt: timestamp('notified_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const anonymousUsers = pgTable('anonymous_users', {
  anonymousUserId: text('anonymous_user_id').primaryKey(),
  firstSeenAt: timestamp('first_seen_at').defaultNow(),
  lastSeenAt: timestamp('last_seen_at').defaultNow(),
  firstRunnerName: text('first_runner_name'),
  firstIpAddress: text('first_ip_address'),
  firstUserAgent: text('first_user_agent'),
  platform: text('platform'),
  appVersion: text('app_version'),
  locale: text('locale'),
  timezone: text('timezone'),
});


export type Runner = typeof runners.$inferSelect;
export type NewRunner = typeof runners.$inferInsert;
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type AnonymousUser = typeof anonymousUsers.$inferSelect;
export type NewAnonymousUser = typeof anonymousUsers.$inferInsert;