import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { and, eq } from 'drizzle-orm';
import * as schema from './db/schema';
import { runners, memories } from './db/schema';

// Use env var or default to the NEW port 5432
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@127.0.0.1:5432/ruwt';
const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function seed() {
  console.log('🔌 Connecting to database...');
  
  // 1. Enable Vector Extension (Critical for pgvector)
  try {
    await client`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('✅ Extension "vector" enabled.');
  } catch (e) {
    console.error('⚠️ Failed to enable vector extension (might already exist or permissions issue):', e);
  }

  try {
    console.log('🌱 Seeding database (idempotent)...');

    const seedRunners = [
      {
        name: 'Rewrite',
        kind: 'rewrite' as const,
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
      },
      {
        name: 'Respond',
        kind: 'respond' as const,
        personality: 'I help craft a clear, congruent reply to an incoming message.',
        systemPrompt: `You are Respond. Your goal is to help the user send a congruent reply to an incoming message.

CORE RULES:
- Reply to the inbound message. Do not start new topics.
- Do not invent facts or volunteer commitments the user did not make.
- Preserve the user’s language and register.
- Keep the relationship context consistent (boss vs girlfriend, customer vs friend).
- Be concise and actionable.`,
        embedding: Array(1536).fill(0), // Mock embedding
      },
    ];

    const seedMemory = {
      userId: 'user_1',
      content: 'Goal: I want to be kinder and stop burning bridges when I am angry.',
    };

    await db.transaction(async (tx) => {
      for (const runner of seedRunners) {
        await tx.insert(runners).values(runner).onConflictDoUpdate({
          target: runners.name,
          set: {
            kind: runner.kind,
            personality: runner.personality,
            systemPrompt: runner.systemPrompt,
            embedding: runner.embedding,
          },
        });
        console.log(`✅ Runner "${runner.name}" ensured.`);
      }

      const existingMemory = await tx.query.memories.findFirst({
        where: and(
          eq(memories.userId, seedMemory.userId),
          eq(memories.content, seedMemory.content)
        ),
      });

      if (!existingMemory) {
        await tx.insert(memories).values(seedMemory);
        console.log('✅ User Memory created.');
      } else {
        console.log('ℹ️ User Memory already exists.');
      }
    });

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
