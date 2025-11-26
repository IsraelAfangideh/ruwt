import { pgTable, text, uuid, vector } from 'drizzle-orm/pg-core';

export const runners = pgTable('runners', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  personality: text('personality').notNull(),
  // Vector embedding for personality matching (1536 dims for OpenAI)
  embedding: vector('embedding', { dimensions: 1536 }),
});

export type Runner = typeof runners.$inferSelect;
export type NewRunner = typeof runners.$inferInsert;
