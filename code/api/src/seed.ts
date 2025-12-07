import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { runners, memories } from './db/schema';

// Use env var or default to the NEW port 5432
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@127.0.0.1:5432/ruwt';
const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
  console.log('🔌 Connecting to database...');
  
  // 1. Enable Vector Extension (Critical for pgvector)
  try {
    await client`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('✅ Extension "vector" enabled.');
  } catch (e) {
    console.error('⚠️ Failed to enable vector extension (might already exist or permissions issue):', e);
  }

  console.log('🌱 Seeding database...');

  // 2. Clear existing data
  try {
    await db.delete(runners);
    await db.delete(memories);
  } catch (e) {
    console.log('ℹ️ Tables might not exist yet, skipping delete.');
  }

  // 3. Insert Runner
  try {
    await db.insert(runners).values({
      name: 'Peacemaker',
      personality: 'Calm, empathetic, and focused on de-escalation.',
      systemPrompt: 'You are a Peacemaker. Your goal is to help the user communicate more kindly. Always check their stated goals before allowing a message. If a message is aggressive, rewrite it to be assertive but kind.',
      embedding: Array(1536).fill(0), // Mock embedding
    });
    console.log('✅ Runner "Peacemaker" created.');

    // 4. Insert Memory
    await db.insert(memories).values({
      userId: 'user_1',
      content: 'Goal: I want to be kinder and stop burning bridges when I am angry.',
    });
    console.log('✅ User Memory created.');

  } catch (e: any) {
    if (e.code === '42P01') { // undefined_table
      console.log('⚠️ Tables do not exist yet. Please run "bun run db:migrate" now that the extension is enabled.');
    } else {
      console.error('❌ Error during seeding:', e);
    }
  }

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
