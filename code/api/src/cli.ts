import { GoogleGenerativeAI } from '@google/generative-ai';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';
import { eq } from 'drizzle-orm';
import chalk from 'chalk';
import readline from 'readline';

// CLI Configuration
const USER_ID = 'user_1';
const RUNNER_NAME = 'Peacemaker';

// Database Connection
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5433/ruwt';
const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Init Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

// Session Memory
let conversationHistory: { role: 'user' | 'model', parts: [{ text: string }] }[] = [];

async function startSession() {
  console.clear();

  console.log(chalk.bold.cyan(`
   ____  _    ___        ______  
  |  _ \\| |  | \\ \\      / /_  _| 
  | |_) | |  | |\\ \\ /\\ / / | |   
  |  _ <| |__| | \\ V  V /  | |   
  |_| \\_\\\\____/   \\_/\\_/   |_|   
  `));
  console.log(chalk.gray(`  Runner Protocol v1.01 | Identity: ${chalk.white(RUNNER_NAME)}`));
  console.log(chalk.gray(`  Status: ${chalk.green('ONLINE')}\n`));
  console.log(chalk.gray(`Hi Human, I am ${chalk.blue(RUNNER_NAME)} and I am here to help you communicate more kindly.\n`));
  console.log(chalk.gray(`Enter a message you are thinking about sending to another human.\n`));


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

      while (nextMessage) {
        if (nextMessage !== initialInput) {
          console.log(chalk.gray(`\n> System: Processing selection...`));
        }

        nextMessage = await processMessage(nextMessage, rl);
      }
      
      console.log(); // Spacing
      chatLoop();
    });
  };

  chatLoop();
}

async function processMessage(userMessage: string, rl: readline.Interface): Promise<string | null> {
  // Simple log instead of spinner
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

    // 2. System Instruction
    const systemInstruction = `
      You are ${runner.name}. ${runner.systemPrompt}
      
      User Memories/Goals:
      ${memoryContext}
      
      PROTOCOL:
      1. Analyze the input.
      2. If it is ANGRY or VIOLATES goals:
         - Start with [BLOCKED].
         - Explain why briefly.
         - Offer a rewrite.
      3. If the user confirms (Yes, Sure, Send it, works):
         - Start with [SENT].
         - Output the FINAL message text clearly.
      4. If the user overrides (No, Send original, unhinged):
         - Start with [SENT].
         - Output the ORIGINAL message.
         - Add a bracketed note: [WARNING: GOAL VIOLATION LOGGED]
      5. If message is safe/neutral:
         - Start with [SENT].
    `;

    // 3. Update Local History
    conversationHistory.push({ role: 'user', parts: [{ text: userMessage }] });

    // 4. Call AI
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp',
        systemInstruction: systemInstruction
    });

    const chat = model.startChat({
        history: conversationHistory.slice(0, -1), 
    });

    const result = await chat.sendMessageStream(userMessage);

    process.stdout.write(chalk.blue.bold(`${RUNNER_NAME} > `));
    
    let fullResponse = '';
    let isBlocked = false;

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      
      if (fullResponse.includes('[BLOCKED]')) {
        isBlocked = true;
        process.stdout.write(chalk.red(chunkText));
      } else if (fullResponse.includes('[SENT]')) {
        process.stdout.write(chalk.green(chunkText));
      } else {
        process.stdout.write(chalk.white(chunkText));
      }
    }
    
    conversationHistory.push({ role: 'model', parts: [{ text: fullResponse }] });
    console.log(); 

    if (isBlocked) {
      return await handleBlockedMenu(rl);
    }

    return null;

  } catch (error) {
    console.error(chalk.red('\n[!] Connection Interrupted'), error);
    return null;
  }
}

function handleBlockedMenu(rl: readline.Interface): Promise<string | null> {
  console.log(chalk.gray('\n  k. Decision Required:'));
  console.log(chalk.cyan('  1.') + ' Yes, that works');
  console.log(chalk.cyan('  2.') + ' No, I want to be ' + chalk.red.bold('unhinged'));

  return new Promise((resolve) => {
    rl.question(chalk.gray('\n  Select [1/2] > '), (choice) => {
      const c = choice.trim();
      if (c === '1') {
        resolve("Yes, send the rewrite.");
      } else if (c === '2') {
        resolve("No, send the original message anyway.");
      } else {
        console.log(chalk.yellow('  > Invalid selection. Aborting send.'));
        resolve(null);
      }
    });
  });
}

startSession();
