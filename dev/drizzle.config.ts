import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env.local when running drizzle-kit (npm run db:push, etc.)
config({ path: '.env.local' });

export default defineConfig({
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
