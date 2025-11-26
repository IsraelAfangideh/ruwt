import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { runners, memories } from './db/schema';
import { eq } from 'drizzle-orm';

// CLI Configuration
const USER_ID = 'user_1'; // Hardcoded for MVP
const RUNNER_NAME = 'Peacemaker';

// Database Connection
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/ruwt';
const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  // 1. Parse Input
  const args = process.argv.slice(2);
  const userMessage = args.join(' ');

  if (!userMessage) {
    console.error('Please provide a message to process. Example: bun run cli "I hate you!"');
    process.exit(1);
  }

  console.log(`\n📝 Analyzing message: "${userMessage}"...\n`);

  // 2. Fetch Runner Context
  const runner = await db.query.runners.findFirst({
    where: eq(runners.name, RUNNER_NAME),
  });

  if (!runner) {
    console.error(`Runner "${RUNNER_NAME}" not found. Please run seed script first.`);
    process.exit(1);
  }

  // 3. Fetch User Memories
  const userMemories = await db.query.memories.findMany({
    where: eq(memories.userId, USER_ID),
  });
  const memoryContext = userMemories.map(m => `- ${m.content}`).join('\n');

  // 4. Call AI
  const systemPrompt = `
    You are ${runner.name}. ${runner.systemPrompt}
    
    Here is what you know about the user's goals/memories:
    ${memoryContext}
    
    Your task:
    1. Analyze the user's message.
    2. If it violates their goals (e.g. they want to be kind but message is angry), REFUSE to send it.
    3. Propose a rewrite that aligns with their goals.
    4. If it is fine, just say "Message looks good."
  `;

  try {
    const { text } = await generateText({
      model: google('gemini-1.5-flash'),
      system: systemPrompt,
      prompt: `User Message: "${userMessage}"`,
    });

    console.log('🤖 Runner Response:');
    console.log('-------------------');
    console.log(text);
    console.log('-------------------');

  } catch (error) {
    console.error('AI Error:', error);
  }

  process.exit(0);
}

main();

