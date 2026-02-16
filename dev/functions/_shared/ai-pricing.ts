/**
 * Model pricing and token helpers for AI chat (Workers-safe, no Node).
 * 5-tier game pricing: reasoning ($$$$$), premium ($$$), mid ($$), budget ($), micro (¢).
 */

export type ModelTier = 'reasoning' | 'premium' | 'mid' | 'budget' | 'micro';

export interface ModelPricing {
  input: number;
  output: number;
  provider: string;
  tier: ModelTier;
  displayName: string;
  description: string;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b': {
    input: 0.50,
    output: 4.88,
    provider: 'cloudflare',
    tier: 'reasoning',
    displayName: 'DeepSeek R1 32B',
    description: 'Reasoning-optimized, best for complex logic',
  },
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': {
    input: 0.50,
    output: 0.60,
    provider: 'cloudflare',
    tier: 'premium',
    displayName: 'Llama 3.3 70B',
    description: 'Best overall quality, fast inference',
  },
  '@cf/meta/llama-3.1-70b-instruct': {
    input: 0.10,
    output: 0.12,
    provider: 'cloudflare',
    tier: 'mid',
    displayName: 'Llama 3.1 70B',
    description: 'Strong mid-range, good balance of cost and quality',
  },
  '@cf/qwen/qwen1.5-14b-chat-awq': {
    input: 0.08,
    output: 0.12,
    provider: 'cloudflare',
    tier: 'mid',
    displayName: 'Qwen 1.5 14B',
    description: 'Fast mid-range, good at code',
  },
  '@cf/meta/llama-3.1-8b-instruct': {
    input: 0.01,
    output: 0.01,
    provider: 'cloudflare',
    tier: 'budget',
    displayName: 'Llama 3.1 8B',
    description: 'Cheap and capable for straightforward tasks',
  },
  '@cf/mistral/mistral-7b-instruct-v0.2': {
    input: 0.01,
    output: 0.01,
    provider: 'cloudflare',
    tier: 'budget',
    displayName: 'Mistral 7B',
    description: 'Fast budget option with good instruction following',
  },
  '@cf/ibm-granite/granite-4.0-h-micro': {
    input: 0.017,
    output: 0.112,
    provider: 'cloudflare',
    tier: 'micro',
    displayName: 'Granite Micro',
    description: 'Ultra-cheap, simple tasks only',
  },
  '@cf/meta/llama-3.2-1b-instruct': {
    input: 0.027,
    output: 0.201,
    provider: 'cloudflare',
    tier: 'micro',
    displayName: 'Llama 3.2 1B',
    description: 'Tiny and fast, basic tasks',
  },
};

export function getModelPricing(model: string): ModelPricing | undefined {
  return MODEL_PRICING[model];
}

/** Returns all models sorted by tier (reasoning first). */
export function getCloudflareModels(): Array<{ id: string } & ModelPricing> {
  const tierOrder: Record<ModelTier, number> = { reasoning: 0, premium: 1, mid: 2, budget: 3, micro: 4 };
  return Object.entries(MODEL_PRICING)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);
}

/** Get fallback chain for a given tier (same tier or lower only). */
export function getTierFallbackChain(tier: ModelTier): string[] {
  const tierOrder: ModelTier[] = ['reasoning', 'premium', 'mid', 'budget', 'micro'];
  const startIdx = tierOrder.indexOf(tier);
  const allowedTiers = new Set(tierOrder.slice(startIdx));
  return Object.entries(MODEL_PRICING)
    .filter(([, p]) => allowedTiers.has(p.tier))
    .sort((a, b) => {
      const tierOrd: Record<ModelTier, number> = { reasoning: 0, premium: 1, mid: 2, budget: 3, micro: 4 };
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
