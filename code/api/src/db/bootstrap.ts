import postgres from 'postgres';

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:password@127.0.0.1:5432/ruwt';

/**
 * Ensure required Postgres extensions exist before schema sync.
 *
 * - pgcrypto: needed for gen_random_uuid() (used by drizzle's defaultRandom()).
 * - vector: needed for pgvector columns.
 *
 * Safe to run repeatedly.
 */
async function main() {
  const sql = postgres(connectionString, { max: 1 });

  try {
    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;
    await sql`CREATE EXTENSION IF NOT EXISTS "vector"`;
    console.log('DB extensions ensured');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('Failed to ensure DB extensions:', err);
  process.exit(1);
});
