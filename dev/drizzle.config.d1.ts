import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './drizzle/schema.d1.ts',
  out: './drizzle/migrations-d1',
  dialect: 'sqlite',
});
