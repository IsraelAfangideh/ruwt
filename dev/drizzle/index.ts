import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Load .env.local when DATABASE_URL is missing (e.g. running scripts from CLI)
if (!process.env.DATABASE_URL) {
  config({ path: '.env.local' });
}

const connectionString = process.env.DATABASE_URL!;

// For use in API routes and server components
const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export * from './schema';
