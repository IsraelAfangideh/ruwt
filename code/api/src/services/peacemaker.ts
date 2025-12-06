import { GoogleGenerativeAI } from '@google/generative-ai';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { 
  generatePeacemakerPrompt, 
  PEACEMAKER_IDENTITY, 
  PeacemakerChatRequest, 
  PeacemakerChatResponse 
} from '@ruwt/shared';

// Initialize DB (Reusing the connection logic pattern)
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/ruwt';
const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Initialize AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export async function chatWithPeacemaker(payload: PeacemakerChatRequest): Promise<PeacemakerChatResponse | null> {
  const { message, userId, history } = payload;
  const runnerName = PEACEMAKER_IDENTITY.NAME;

  try {
    // 1. Fetch Context
    const runner = await db.query.runners.findFirst({ 
      where: eq(schema.runners.name, runnerName) 
    });
    
    if (!runner) { 
      console.error('Runner not found:', runnerName); 
      return null; 
    }

    const userMemories = await db.query.memories.findMany({ 
      where: eq(schema.memories.userId, userId) 
    });
    const memoryContent = userMemories.map(m => m.content);

    // 2. Generate System Prompt using Shared Logic
    const systemInstruction = generatePeacemakerPrompt(runner.name, runner.systemPrompt, memoryContent);

    // 3. Call AI
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      systemInstruction: systemInstruction
    });

    const chat = model.startChat({
      history: history, 
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    // 4. Parse Response for Blocking Logic
    const isBlocked = responseText.includes('[BLOCKED]');
    let proposedRewrite = undefined;

    if (isBlocked) {
      const match = responseText.match(/Proposed Rewrite: "(.*)"/);
      proposedRewrite = match ? match[1] : undefined;
    }

    return {
      text: responseText,
      isBlocked,
      proposedRewrite
    };

  } catch (error) {
    console.error('Peacemaker Service Error:', error);
    throw error;
  }
}

