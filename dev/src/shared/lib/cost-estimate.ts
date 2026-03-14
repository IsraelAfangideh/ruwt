/**
 * Client-side cost estimation for AI chat messages.
 * Uses approximate token counting (chars / 4) and hardcoded model pricing
 * mirroring the server-side ai-pricing.ts values.
 *
 * Costs are returned in hundredths-of-cents (same unit as the server).
 */

import { getModelById } from '@/shared/lib/ai/pricing';

const CHARS_PER_TOKEN = 4;

/**
 * Estimate the cost of sending a chat message to a given model.
 * Returns estimated cost in hundredths-of-cents (1/10000 of a dollar).
 *
 * Assumes:
 *   - Input tokens = message chars / 4  (plus ~50 tokens for system prompt overhead)
 *   - Output tokens ~ 1.5x input tokens (models tend to reply with more tokens than the prompt)
 */
export function estimateChatCost(message: string, model: string): number {
  if (!message.trim()) return 0;

  const modelInfo = getModelById(model);
  if (!modelInfo) return 0;

  // Approximate input tokens: message + rough system prompt overhead (~200 tokens)
  const messageTokens = Math.ceil(message.length / CHARS_PER_TOKEN);
  const inputTokens = messageTokens + 200;

  // Approximate output tokens: assume 1.5x the message tokens, minimum 100
  const outputTokens = Math.max(100, Math.ceil(messageTokens * 1.5));

  // Pricing is per 1M tokens, cost in hundredths-of-cents
  const inputCost = Math.ceil((inputTokens / 1_000_000) * modelInfo.input * 10000);
  const outputCost = Math.ceil((outputTokens / 1_000_000) * modelInfo.output * 10000);

  return inputCost + outputCost;
}

/**
 * Format a cost in hundredths-of-cents to a human-readable dollar string.
 */
export function formatEstimatedCost(hundredths: number): string {
  const dollars = hundredths / 10000;
  if (dollars === 0) return '$0.00';
  if (dollars < 0.0001) return '<$0.0001';
  if (dollars < 0.01) return `~$${dollars.toFixed(4)}`;
  return `~$${dollars.toFixed(2)}`;
}
