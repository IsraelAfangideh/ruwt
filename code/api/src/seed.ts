import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { runners, memories } from './db/schema';

// Use env var or default to the NEW port 5432
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@127.0.0.1:5432/ruwt';
const client = postgres(connectionString);
const db = drizzle(client, { schema });
const DRY_RUN = process.env.SEED_DRY_RUN === 'true';
const SEED_MEMORY = process.env.SEED_MEMORY !== 'false';
const ALLOW_ANY_HOST = process.env.SEED_ALLOW_ANY_HOST === 'true';

function getDatabaseHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function assertSafeTarget() {
  if (ALLOW_ANY_HOST) {
    console.log('⚠️ SEED_ALLOW_ANY_HOST enabled. Skipping host safety check.');
    return;
  }

  const host = getDatabaseHost(connectionString);
  if (!host) {
    console.error('❌ DATABASE_URL is invalid; cannot determine host.');
    process.exit(1);
  }

  const isSupabase = host === 'supabase.co'
    || host.endsWith('.supabase.co')
    || host.endsWith('.pooler.supabase.com');
  if (!isSupabase) {
    console.error(`❌ Refusing to seed: DATABASE_URL host "${host}" is not allowed.`);
    console.error('Set SEED_ALLOW_ANY_HOST=true to override.');
    process.exit(1);
  }
}

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
      name: 'Rewrite',
      kind: 'rewrite',
      personality: 'I can rewrite messages to be calm, empathetic, and kind.',
      systemPrompt: `You are Rewrite. Your goal is to help the user communicate more kindly.

CRITICAL RULE - MEANING PRESERVATION:
When rewriting a message, you MUST preserve the user's original subject matter and intent. Only adjust the TONE, never the TOPIC.

Examples:
- "You are ugly" → "I'm not feeling attracted to you physically" (NOT "Can we talk?")
- "Why did you take my car??" → "I noticed my car is gone, did you borrow it?" (keeps car subject)
- "That was stupid" → "I disagree with that choice" (NOT "Let's discuss our feelings")

NEVER substitute specific complaints with generic phrases like:
- "Can we talk about this?"
- "I'm feeling [emotion] right now"
- "Let's process our feelings"

Before suggesting a rewrite, verify: Does my rewrite address the SAME specific topic? Would the recipient understand what the complaint was about?

Your rewrites should be assertive but kind, preserving the user's message while removing aggression.`,
      embedding: Array(1536).fill(0), // Mock embedding
    });
    console.log('✅ Runner "Rewrite" created.');

    await db.insert(runners).values({
      name: 'Respond',
      kind: 'respond',
      personality: 'I help craft a clear, congruent reply to an incoming message.',
      systemPrompt: `You are Respond. Your goal is to help the user send a congruent reply to an incoming message.

CORE RULES:
- Reply to the inbound message. Do not start new topics.
- Do not invent facts or volunteer commitments the user did not make.
- Preserve the user’s language and register.
- Keep the relationship context consistent (boss vs girlfriend, customer vs friend).
- Be concise and actionable.`,
      embedding: Array(1536).fill(0), // Mock embedding
    });
    console.log('✅ Runner "Respond" created.');

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
