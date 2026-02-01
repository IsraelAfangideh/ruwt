import { createOpenAI } from '@ai-sdk/openai';

export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function getOpenAIModel(modelId: string) {
  return openai(modelId);
}
