import { z } from 'zod';

// --- Existing Schema ---
export const RunnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  personality: z.string(),
});

export type Runner = z.infer<typeof RunnerSchema>;

// --- Rewrite Shared Logic ---

export const REWRITE_IDENTITY = {
  NAME: 'Rewrite',
  DEFAULT_USER_ID: 'user_1', // For prototype phase
};

// Request/Response Types for the API
export const RewriteChatRequestSchema = z.object({
  message: z.string(),
  userId: z.string().default(REWRITE_IDENTITY.DEFAULT_USER_ID),
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      parts: z.array(z.object({ text: z.string() })),
    })
  ).optional().default([]),
});

export type RewriteChatRequest = z.infer<typeof RewriteChatRequestSchema>;

export const RewriteChatResponseSchema = z.object({
  text: z.string(), // The full raw response
  isBlocked: z.boolean(),
  explanation: z.string().optional(), // The "Thought" bubble
  proposedRewrite: z.string().optional(), // The "Actionable" bubble
});

export type RewriteChatResponse = z.infer<typeof RewriteChatResponseSchema>;

// The Prompt Generator (Pure Function)
export function generateRewritePrompt(runnerName: string, baseSystemPrompt: string, userMemories: string[]): string {
  const memoryContext = userMemories.map(m => `- ${m}`).join('\n');

  return `
      SYSTEM ROLE:
      You are a high-precision Text Transformation Engine. 
      You are NOT a chat bot. You are NOT a conversational assistant. 
      You NEVER reply to the user. You ONLY transform text.

      YOUR GOAL:
      Take the user's input text (which may be angry, rough, or casual) and rewrite it to be kinder, warmer, and more professional, while strictly preserving the original intent.

      User Context/Memories:
      ${memoryContext}
      
      STRICT PROTOCOL:
      1. Treat EVERY input as a raw string to be rewritten.
      2. If the user asks a question, ignore the question and REWRITE it as a statement or a polite inquiry.
      3. If the input is aggressive (e.g. profanity), neutralize it immediately to polite professional language.
      
      CRITICAL RULE: PRESERVE THE RECIPIENT
      - If the user says "I love him" (3rd person), KEEP it 3rd person (e.g., "I cherish him deeply").
      - If the user says "I love you" (2nd person), KEEP it 2nd person.
      - Do NOT change who the message is talking about.

      OUTPUT FORMAT:
      You must respond with a SINGLE Valid JSON object. Do not include markdown formatting (like \`\`\`json).
      
      JSON Schema:
      {
        "explanation": "A very brief, empathetic thought on what tone shift is needed (max 1 sentence).",
        "rewrite": "The actual rewritten text."
      }
    `;
}

// Export mocks for testing
export * from './mocks';