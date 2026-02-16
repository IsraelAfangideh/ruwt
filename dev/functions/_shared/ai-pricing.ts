/**
 * Model pricing and token helpers for AI chat (Workers-safe, no Node).
 * 3-tier game pricing: premium ($$$), mid ($$), budget ($).
 */

export type ModelTier = 'premium' | 'mid' | 'budget';

export interface ModelPricing {
  input: number;
  output: number;
  provider: string;
  tier: ModelTier;
  displayName: string;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': {
    input: 0.50,
    output: 0.60,
    provider: 'cloudflare',
    tier: 'premium',
    displayName: 'Llama 3.3 70B',
  },
  '@cf/meta/llama-3.1-70b-instruct': {
    input: 0.10,
    output: 0.12,
    provider: 'cloudflare',
    tier: 'mid',
    displayName: 'Llama 3.1 70B',
  },
  '@cf/meta/llama-3.1-8b-instruct': {
    input: 0.01,
    output: 0.01,
    provider: 'cloudflare',
    tier: 'budget',
    displayName: 'Llama 3.1 8B',
  },
  '@cf/mistral/mistral-7b-instruct-v0.2': {
    input: 0.01,
    output: 0.01,
    provider: 'cloudflare',
    tier: 'budget',
    displayName: 'Mistral 7B',
  },
};

export function getModelPricing(model: string): ModelPricing | undefined {
  return MODEL_PRICING[model];
}

/** Returns all models sorted by tier (premium first). */
export function getCloudflareModels(): Array<{ id: string } & ModelPricing> {
  const tierOrder: Record<ModelTier, number> = { premium: 0, mid: 1, budget: 2 };
  return Object.entries(MODEL_PRICING)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);
}

/** Get fallback chain for a given tier (same tier or lower only). */
export function getTierFallbackChain(tier: ModelTier): string[] {
  const tierOrder: ModelTier[] = ['premium', 'mid', 'budget'];
  const startIdx = tierOrder.indexOf(tier);
  const allowedTiers = new Set(tierOrder.slice(startIdx));
  return Object.entries(MODEL_PRICING)
    .filter(([, p]) => allowedTiers.has(p.tier))
    .sort((a, b) => {
      const tierOrd: Record<ModelTier, number> = { premium: 0, mid: 1, budget: 2 };
      return tierOrd[a[1].tier] - tierOrd[b[1].tier];
    })
    .map(([id]) => id);
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
