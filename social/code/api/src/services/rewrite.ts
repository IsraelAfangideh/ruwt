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
import { getGeminiModelCandidates, isGeminiModelNotFoundError } from './gemini';

// Initialize DB
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@127.0.0.1:5432/ruwt';
const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Initialize AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export async function chatWithRewrite(payload: RewriteChatRequest): Promise<RewriteChatResponse | null> {
  const { message, userId, history, tone } = payload;
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
    const systemInstruction = generateRewritePrompt(runner.name, runner.systemPrompt, memoryContent, tone);

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

    // 3. Call AI with JSON Enforcement (retry with fallback model on 404 "model not found")
    const modelCandidates = getGeminiModelCandidates();
    let responseText: string | null = null;
    let lastError: unknown = null;

    for (const modelName of modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          systemInstruction: systemInstruction,
          generationConfig: {
            responseMimeType: "application/json", // Forces strict-ish JSON output
          }
        });

        const chat = model.startChat({
          history: validHistory, 
        });

        const result = await chat.sendMessage(message);
        responseText = result.response.text();
        break;
      } catch (err) {
        lastError = err;
        if (isGeminiModelNotFoundError(err)) {
          console.warn(`Rewrite: Gemini model "${modelName}" not available, trying next candidate...`);
          continue;
        }
        throw err;
      }
    }

    if (responseText == null) {
      console.error('Rewrite: all Gemini model candidates failed:', modelCandidates);
      throw lastError ?? new Error('Rewrite: all Gemini model candidates failed');
    }

    // 4. Parse JSON Response (Robust)
    let explanation: string | undefined;
    let proposedRewrite: string | undefined;

    try {
      const jsonResponse = JSON.parse(responseText);
      explanation = jsonResponse.explanation;
      proposedRewrite = jsonResponse.rewrite;
    } catch (parseError) {
      console.error("Failed to parse AI JSON response:", responseText);
      // Fallback: If JSON fails, treat the whole text as the explanation (safeguard)
      explanation = "I had trouble processing that specifically, but let's try to be kind.";
      proposedRewrite = responseText; 
    }

    // It's considered "Blocked"/Intercepted if we have a rewrite (which we always should now)
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