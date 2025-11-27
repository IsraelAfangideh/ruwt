import { pgTable, text, uuid, vector, timestamp } from 'drizzle-orm/pg-core';

export const runners = pgTable('runners', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  personality: text('personality').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  // Vector embedding for personality matching (768 dims for Google Gemini embeddings typically, or 1536 for OpenAI)
  // We'll keep it flexible, but noting the shift to Google AI might imply different dimensions if we use their embeddings.
  embedding: vector('embedding', { dimensions: 1536 }), 
});

export const memories = pgTable('memories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(), // Simple string ID for CLI MVP
  content: text('content').notNull(), // "I want to be kinder"
  createdAt: timestamp('created_at').defaultNow(),
});

export type Runner = typeof runners.$inferSelect;
export type NewRunner = typeof runners.$inferInsert;
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
