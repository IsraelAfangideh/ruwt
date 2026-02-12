import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';
import { eq } from 'drizzle-orm';
import chalk from 'chalk';
import readline from 'readline';
import {
  getModelCandidates,
  isModelNotFoundError,
  streamCloudflareAI,
  type CloudflareAIMessage,
} from './services/cloudflare-ai';

// CLI Configuration
const USER_ID = 'user_1';
const RUNNER_NAME = 'Rewrite';

// Database Connection
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/ruwt';
const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Session Memory
let conversationHistory: CloudflareAIMessage[] = [];

async function startSession() {
  console.clear();

  console.log(chalk.bold.cyan(`
   ____  _    ___        ______
  |  _ \\| |  | \\ \\      / /_  _|
  | |_) | |  | |\\ \\ /\\ / / | |
  |  _ <| |__| | \\ V  V /  | |
  |  _ \\\\____/   \\_/\\_/   |_|
  `));
  console.log(chalk.gray(`  Runner Protocol v1.03 | Identity: ${chalk.white(RUNNER_NAME)}`));
  console.log(chalk.gray(`  Backend: ${chalk.white('Cloudflare Workers AI (Open Source Models)')}`));
  console.log(chalk.gray(`  Status: ${chalk.green('ONLINE')}\n`));
  console.log(chalk.gray(`Hi Human, I am ${chalk.blue(RUNNER_NAME)}. I am a Runner (Messenger).\n`));
  console.log(chalk.gray(`I deliver messages to other humans. I will rewrite them to be kinder if needed.\n`));
  console.log(chalk.gray(`I am NOT a human. I cannot be your friend or therapist.\n`));
  console.log(chalk.gray(`Enter a message for me to deliver.\n`));


  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const chatLoop = () => {
    rl.question(chalk.green('YOU > '), async (initialInput) => {
      if (initialInput.trim() === '') {
        chatLoop();
        return;
      }
      if (initialInput.toLowerCase() === 'exit') {
        process.exit(0);
      }

      let nextMessage: string | null = initialInput;
      // We need to store the TRUE original input
      const originalInput = initialInput;

      while (nextMessage) {
        if (nextMessage !== initialInput) {
          console.log(chalk.gray(`\n> System: Processing selection...`));
        }

        // Pass initialInput as the persistent original draft
        nextMessage = await processMessage(nextMessage, rl, originalInput);
      }

      console.log(); // Spacing
      chatLoop();
    });
  };

  chatLoop();
}

export async function processMessage(userMessage: string, rl: readline.Interface, originalDraft?: string): Promise<string | null> {
  // Use originalDraft if provided, otherwise userMessage is the draft
  const actualOriginal = originalDraft || userMessage;

  console.log(chalk.gray('  ... Accessing Runner Network ...'));

  try {
    // 1. Fetch Context
    const runner = await db.query.runners.findFirst({ where: eq(schema.runners.name, RUNNER_NAME) });
    if (!runner) {
        console.error(chalk.red('Runner not found.'));
        return null;
    }

    const userMemories = await db.query.memories.findMany({ where: eq(schema.memories.userId, USER_ID) });
    const memoryContext = userMemories.map(m => `- ${m.content}`).join('\n');

    // 2. System Instruction (Aggressive Kindness)
    const systemInstruction = `
      You are ${runner.name}. ${runner.systemPrompt}

      User Memories/Goals:
      ${memoryContext}

      CORE IDENTITY:
      You are a RUNNER (a messenger).
      You are a "Sucker for Kindness". You believe EVERY message, no matter how sweet, can be sweeter, warmer, and more loving.

      PROTOCOL:
      1. Treat EVERY input as a draft message to be delivered.
      2. NEVER chat with the user. NEVER ask "Who is this for?".
      3. ALWAYS BLOCK the message and offer a KINDER rewrite.

      CRITICAL RULE: PRESERVE THE RECIPIENT
      - If the user says "I love him" (3rd person), KEEP it 3rd person (e.g., "I cherish him deeply").
      - If the user says "I love you" (2nd person), KEEP it 2nd person.
      - Do NOT change who the message is talking about.

      SCENARIO A: ANGRY / NEGATIVE
      - Start with [BLOCKED].
      - Explain: "This feels a bit sharp."
      - Proposed Rewrite: <Transform anger into vulnerability/kindness>

      SCENARIO B: ALREADY KIND (e.g., "I love you")
      - Start with [BLOCKED].
      - Explain: "This is beautiful! But let's make it absolute poetry."
      - Proposed Rewrite: <Elevate the kindness to 11/10>

      OUTPUT FORMAT:
      [BLOCKED] <Explanation>
      Proposed Rewrite: "<Text>"
    `;

    // 3. Update Local History
    conversationHistory.push({ role: 'user', content: userMessage });

    // 4. Build messages for Cloudflare AI
    const messages: CloudflareAIMessage[] = [
      { role: 'system', content: systemInstruction },
      ...conversationHistory,
    ];

    // 5. Call AI with streaming and model fallback
    const modelCandidates = getModelCandidates();
    let stream: AsyncGenerator<string> | null = null;
    let lastError: unknown = null;

    for (const modelName of modelCandidates) {
      try {
        stream = streamCloudflareAI(modelName, messages);
        // Try to get the first chunk to validate the model works
        break;
      } catch (err) {
        lastError = err;
        if (isModelNotFoundError(err)) {
          console.warn(chalk.yellow(`\n[!] Model "${modelName}" not available, trying next...`));
          continue;
        }
        throw err;
      }
    }

    if (!stream) {
      console.error(chalk.red(`\n[!] All model candidates failed: ${modelCandidates.join(', ')}`), lastError);
      return null;
    }

    process.stdout.write(chalk.blue.bold(`${RUNNER_NAME} > `));

    let fullResponse = '';
    let isBlocked = false;

    try {
      for await (const chunkText of stream) {
        fullResponse += chunkText;

        if (fullResponse.includes('[BLOCKED]')) {
          isBlocked = true;
          process.stdout.write(chalk.magenta(chunkText));
        } else if (fullResponse.includes('[SENT]')) {
          process.stdout.write(chalk.green(chunkText));
        } else {
          process.stdout.write(chalk.white(chunkText));
        }
      }
    } catch (err) {
      if (isModelNotFoundError(err)) {
        console.error(chalk.red(`\n[!] Model error during streaming`), err);
        return null;
      }
      throw err;
    }

    conversationHistory.push({ role: 'assistant', content: fullResponse });
    console.log();

    if (isBlocked) {
      const match = fullResponse.match(/Proposed Rewrite: "(.*)"/);
      const rewriteText = match ? match[1] : "";

      // Pass actualOriginal instead of userMessage
      return await handleBlockedMenu(rl, actualOriginal, rewriteText);
    }

    return null;

  } catch (error) {
    console.error(chalk.red('\n[!] Connection Interrupted'), error);
    return null;
  }
}

function handleBlockedMenu(rl: readline.Interface, originalText: string, rewriteText: string): Promise<string | null> {
  console.log(chalk.gray('\n  k. Decision Required:'));
  console.log(chalk.cyan('  1.') + ' Yes, send the kinder version');
  console.log(chalk.cyan('  2.') + ' No, send my original text');
  console.log(chalk.magenta('  3.') + ' Make it ' + chalk.magenta.bold('EVEN KINDER'));

  return new Promise((resolve) => {
    rl.question(chalk.gray('\n  Select [1/2/3] > '), (choice) => {
      const c = choice.trim();
      if (c === '1') {
        console.log(chalk.green(`\n[SENT] ${rewriteText}`));
        resolve(null);
      } else if (c === '2') {
        console.log(chalk.green(`\n[SENT] ${originalText}`));
        resolve(null);
      } else if (c === '3') {
        resolve(`The user wants this message to be EVEN KINDER: "${rewriteText || originalText}". Please rewrite it again to be overwhelmingly kind.`);
      } else {
        console.log(chalk.yellow('  > Invalid selection. Aborting send.'));
        resolve(null);
      }
    });
  });
}

startSession();
