import { GoogleGenerativeAI } from '@google/generative-ai';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { 
  generateRewritePrompt, 
  REWRITE_IDENTITY, 
  RewriteChatRequest, 
  RewriteChatResponse 
} from '@ruwt/shared';

// Initialize DB
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@127.0.0.1:5432/ruwt';
const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Initialize AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export async function chatWithRewrite(payload: RewriteChatRequest): Promise<RewriteChatResponse | null> {
  const { message, userId, history } = payload;
  const runnerName = REWRITE_IDENTITY.NAME;

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
    const systemInstruction = generateRewritePrompt(runner.name, runner.systemPrompt, memoryContent);

    // 3. Call AI
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      systemInstruction: systemInstruction
    });

    // Valid History: Must start with 'user'. Filter out leading 'model' messages.
    let validHistory = history;
    if (validHistory.length > 0 && validHistory[0].role !== 'user') {
      const firstUserIndex = validHistory.findIndex(h => h.role === 'user');
      if (firstUserIndex !== -1) {
        validHistory = validHistory.slice(firstUserIndex);
      } else {
        validHistory = [];
      }
    }

    const chat = model.startChat({
      history: validHistory, 
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    // 4. Parse Response for Blocking Logic
    // New Format: [EXPLANATION] ... [REWRITE] ... [END]
    
    let explanation = undefined;
    let proposedRewrite = undefined;

    // Check for new format first
    if (responseText.includes('[EXPLANATION]') && responseText.includes('[REWRITE]')) {
      const expMatch = responseText.match(/\[EXPLANATION\]\s*([\s\S]*?)\s*\[REWRITE\]/);
      const rewMatch = responseText.match(/\[REWRITE\]\s*([\s\S]*?)(\s*\[END\]|$)/);
      
      explanation = expMatch ? expMatch[1].trim() : undefined;
      proposedRewrite = rewMatch ? rewMatch[1].trim() : undefined;
    } 
    // Fallback to old format (robustness)
    else if (responseText.includes('[BLOCKED]')) {
       const parts = responseText.split('Proposed Rewrite:');
       explanation = parts[0].replace('[BLOCKED]', '').trim();
       const match = responseText.match(/Proposed Rewrite: "(.*)"/);
       proposedRewrite = match ? match[1] : undefined;
    }

    // It's considered "Blocked"/Intercepted if we have a rewrite
    const isBlocked = !!proposedRewrite;

    return {
      text: responseText,
      isBlocked,
      explanation,
      proposedRewrite
    };

  } catch (error) {
    console.error('Rewrite Service Error:', error);
    throw error;
  }
}

