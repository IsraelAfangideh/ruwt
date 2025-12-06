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
  text: z.string(), // The full raw response from the model (including [BLOCKED] tags)
  isBlocked: z.boolean(),
  proposedRewrite: z.string().optional(),
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
}
