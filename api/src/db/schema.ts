import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const runners = sqliteTable('runners', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  personality: text('personality').notNull(),
  // Storing embedding as JSON string for MVP since SQLite doesn't have native vector support
  embedding: text('embedding', { mode: 'json' }),
});

export type Runner = typeof runners.$inferSelect;
export type NewRunner = typeof runners.$inferInsert;
