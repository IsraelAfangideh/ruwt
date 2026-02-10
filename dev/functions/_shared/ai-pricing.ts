/**
 * Model pricing and token helpers for AI chat (Workers-safe, no Node).
 */
const MODEL_PRICING: Record<
  string,
  { input: number; output: number; provider: string }
> = {
  'gpt-4o': { input: 2.5, output: 10, provider: 'openai' },
  'gpt-4o-mini': { input: 0.15, output: 0.6, provider: 'openai' },
  'claude-sonnet-4-20250514': { input: 3, output: 15, provider: 'anthropic' },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4, provider: 'anthropic' },
  '@cf/meta/llama-3.1-70b-instruct': { input: 0.02, output: 0.02, provider: 'cloudflare' },
  '@cf/meta/llama-3.1-8b-instruct': { input: 0.01, output: 0.01, provider: 'cloudflare' },
  '@cf/mistral/mistral-7b-instruct-v0.2': { input: 0.01, output: 0.01, provider: 'cloudflare' },
};

export function getModelPricing(model: string) {
  return MODEL_PRICING[model];
}

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const p = MODEL_PRICING[model];
  if (!p) throw new Error(`Unknown model: ${model}`);
  const inputCost = Math.ceil((inputTokens / 1_000_000) * p.input * 10000);
  const outputCost = Math.ceil((outputTokens / 1_000_000) * p.output * 10000);
  return inputCost + outputCost;
}

const CHARS_PER_TOKEN = 4;

export function countMessageTokens(
  messages: Array<{ role: string; content: string }>
): number {
  let n = 3;
  for (const m of messages) {
    n += 4 + Math.ceil((m.role.length + m.content.length) / CHARS_PER_TOKEN);
  }
  return n;
}
