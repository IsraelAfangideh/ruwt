/**
 * Model pricing and token helpers for AI chat (Workers-safe, no Node).
 * 5-tier game pricing: reasoning ($$$$$), premium ($$$), mid ($$), budget ($), micro (¢).
 * All models are Cloudflare Workers AI.
 */

export type ModelTier = 'reasoning' | 'premium' | 'mid' | 'budget' | 'micro';

export interface ModelPricing {
  input: number;
  output: number;
  provider: string;
  tier: ModelTier;
  displayName: string;
  description: string;
  supportsTools?: boolean;
  supportsJsonMode?: boolean;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Reasoning tier
  '@cf/openai/gpt-oss-120b': {
    input: 0.35,
    output: 0.75,
    provider: 'cloudflare',
    tier: 'reasoning',
    displayName: 'GPT-OSS 120B',
    description: 'OpenAI open-weight 120B, strongest reasoning',
    supportsTools: true,
  },
  '@cf/qwen/qwq-32b': {
    input: 0.66,
    output: 1.00,
    provider: 'cloudflare',
    tier: 'reasoning',
    displayName: 'QwQ 32B',
    description: 'Dedicated reasoning model, competitive with o1-mini',
  },
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b': {
    input: 0.50,
    output: 4.88,
    provider: 'cloudflare',
    tier: 'reasoning',
    displayName: 'DeepSeek R1 32B',
    description: 'DeepSeek reasoning distilled from R1',
  },
  // Premium tier
  '@cf/qwen/qwen2.5-coder-32b-instruct': {
    input: 0.66,
    output: 1.00,
    provider: 'cloudflare',
    tier: 'premium',
    displayName: 'Qwen2.5 Coder 32B',
    description: 'Code-specialized, top-tier for coding tasks',
    supportsTools: true,
    supportsJsonMode: true,
  },
  '@cf/mistralai/mistral-small-3.1-24b-instruct': {
    input: 0.35,
    output: 0.56,
    provider: 'cloudflare',
    tier: 'premium',
    displayName: 'Mistral Small 3.1',
    description: 'Mistral 24B, 128k context, strong tool use',
    supportsTools: true,
  },
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': {
    input: 0.50,
    output: 0.60,
    provider: 'cloudflare',
    tier: 'premium',
    displayName: 'Llama 3.3 70B',
    description: 'Meta 70B, fast fp8 inference',
    supportsTools: true,
    supportsJsonMode: true,
  },
  // Mid tier
  '@cf/meta/llama-4-scout-17b-16e-instruct': {
    input: 0.27,
    output: 0.85,
    provider: 'cloudflare',
    tier: 'mid',
    displayName: 'Llama 4 Scout',
    description: 'Llama 4 MoE with 16 experts, native tool use',
    supportsTools: true,
  },
  '@cf/google/gemma-3-12b-it': {
    input: 0.35,
    output: 0.56,
    provider: 'cloudflare',
    tier: 'mid',
    displayName: 'Gemma 3 12B',
    description: 'Google Gemma 3, multimodal capable',
  },
  '@cf/openai/gpt-oss-20b': {
    input: 0.20,
    output: 0.30,
    provider: 'cloudflare',
    tier: 'mid',
    displayName: 'GPT-OSS 20B',
    description: 'OpenAI open-weight 20B, fast and capable',
  },
  '@cf/meta/llama-3.1-70b-instruct': {
    input: 0.10,
    output: 0.12,
    provider: 'cloudflare',
    tier: 'mid',
    displayName: 'Llama 3.1 70B',
    description: 'Strong mid-range, good balance of cost and quality',
    supportsTools: true,
    supportsJsonMode: true,
  },
  // Budget tier
  '@cf/qwen/qwen3-30b-a3b-fp8': {
    input: 0.051,
    output: 0.34,
    provider: 'cloudflare',
    tier: 'budget',
    displayName: 'Qwen3 30B MoE',
    description: 'Qwen3 MoE, ultra-cheap for its size',
    supportsTools: true,
  },
  '@cf/zai-org/glm-4.7-flash': {
    input: 0.06,
    output: 0.40,
    provider: 'cloudflare',
    tier: 'budget',
    displayName: 'GLM-4.7 Flash',
    description: '131k context, built for multi-turn tool calling',
    supportsTools: true,
  },
  '@cf/meta/llama-3.1-8b-instruct': {
    input: 0.01,
    output: 0.01,
    provider: 'cloudflare',
    tier: 'budget',
    displayName: 'Llama 3.1 8B',
    description: 'Cheap and capable for straightforward tasks',
    supportsTools: true,
    supportsJsonMode: true,
  },
  // Micro tier
  '@cf/ibm-granite/granite-4.0-h-micro': {
    input: 0.017,
    output: 0.112,
    provider: 'cloudflare',
    tier: 'micro',
    displayName: 'Granite Micro',
    description: 'Ultra-cheap, agentic-capable',
    supportsTools: true,
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

/** Get models that support native function calling (tools). */
export function getToolCapableModels(): string[] {
  return Object.entries(MODEL_PRICING)
    .filter(([, p]) => p.supportsTools)
    .map(([id]) => id);
}

/** Get tool-capable fallback chain for a given tier. */
export function getToolCapableFallbackChain(tier: ModelTier): string[] {
  const tierOrder: ModelTier[] = ['reasoning', 'premium', 'mid', 'budget', 'micro'];
  const startIdx = tierOrder.indexOf(tier);
  const allowedTiers = new Set(tierOrder.slice(startIdx));
  return Object.entries(MODEL_PRICING)
    .filter(([, p]) => allowedTiers.has(p.tier) && p.supportsTools)
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
