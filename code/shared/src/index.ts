import { z } from 'zod';

// --- Existing Schema ---
export const RunnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  personality: z.string(),
});

export type Runner = z.infer<typeof RunnerSchema>;

// --- Peacemaker Shared Logic ---

export const PEACEMAKER_IDENTITY = {
  NAME: 'Peacemaker',
  DEFAULT_USER_ID: 'user_1', // For prototype phase
};

// Request/Response Types for the API
export const PeacemakerChatRequestSchema = z.object({
  message: z.string(),
  userId: z.string().default(PEACEMAKER_IDENTITY.DEFAULT_USER_ID),
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      parts: z.array(z.object({ text: z.string() })),
    })
  ).optional().default([]),
});

export type PeacemakerChatRequest = z.infer<typeof PeacemakerChatRequestSchema>;

export const PeacemakerChatResponseSchema = z.object({
  text: z.string(), // The full raw response
  isBlocked: z.boolean(),
  explanation: z.string().optional(), // The "Thought" bubble
  proposedRewrite: z.string().optional(), // The "Actionable" bubble
});

export type PeacemakerChatResponse = z.infer<typeof PeacemakerChatResponseSchema>;

// The Prompt Generator (Pure Function)
export function generatePeacemakerPrompt(runnerName: string, baseSystemPrompt: string, userMemories: string[]): string {
  const memoryContext = userMemories.map(m => `- ${m}`).join('\n');

  return `
      You are ${runnerName}. ${baseSystemPrompt}
      
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

      OUTPUT FORMAT:
      You must respond in a specific format to separate your thought process from the rewrite.
      
      [EXPLANATION]
      <Your kind, empathetic explanation of why we should rewrite this.>
      
      [REWRITE]
      <The actual text of the rewrite, and NOTHING else.>
      
      [END]

      Example:
      [EXPLANATION]
      This feels a bit sharp. Let's add some warmth to it.
      [REWRITE]
      I am feeling a bit overwhelmed right now, can we talk later?
      [END]
    `;
}
