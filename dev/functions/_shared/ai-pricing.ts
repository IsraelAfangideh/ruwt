/**
 * Model pricing and token helpers for AI chat (Workers-safe, no Node).
 * 5-tier game pricing: reasoning ($$$$$), premium ($$$), mid ($$), budget ($), micro (¢).
 * Three sources: cloudflare (free practice), hosted (platform keys, 2x markup), byok (user keys).
 */

export type ModelTier = 'reasoning' | 'premium' | 'mid' | 'budget' | 'micro';

export type ModelSource = 'cloudflare' | 'hosted' | 'byok';

export interface ModelPricing {
  input: number;
  output: number;
  provider: string;
  tier: ModelTier;
  displayName: string;
  description: string;
  source: ModelSource;
  actualModelId?: string; // API model ID for hosted models
}

export type BYOKProvider = 'openai' | 'anthropic' | 'google';

const MODEL_PRICING: Record<string, ModelPricing> = {
  // --- Platform-hosted models (2x markup, available to all users) ---
  'hosted:gpt-4o': {
    input: 5.00,
    output: 20.00,
    provider: 'openai',
    tier: 'premium',
    displayName: 'GPT-4o',
    description: 'OpenAI flagship, strong all-around',
    source: 'hosted',
    actualModelId: 'gpt-4o',
  },
  'hosted:gpt-4o-mini': {
    input: 0.30,
    output: 1.20,
    provider: 'openai',
    tier: 'mid',
    displayName: 'GPT-4o mini',
    description: 'Fast and affordable OpenAI model',
    source: 'hosted',
    actualModelId: 'gpt-4o-mini',
  },
  'hosted:claude-sonnet-4-5-20250929': {
    input: 6.00,
    output: 30.00,
    provider: 'anthropic',
    tier: 'premium',
    displayName: 'Claude Sonnet 4.5',
    description: 'Anthropic best balance of quality and speed',
    source: 'hosted',
    actualModelId: 'claude-sonnet-4-5-20250929',
  },
  'hosted:claude-haiku-3-5-20241022': {
    input: 1.60,
    output: 8.00,
    provider: 'anthropic',
    tier: 'mid',
    displayName: 'Claude Haiku 3.5',
    description: 'Fast and affordable Anthropic model',
    source: 'hosted',
    actualModelId: 'claude-haiku-3-5-20241022',
  },
  'hosted:gemini-2.0-flash': {
    input: 0.20,
    output: 0.80,
    provider: 'google',
    tier: 'mid',
    displayName: 'Gemini 2.0 Flash',
    description: 'Google fast and cheap model',
    source: 'hosted',
    actualModelId: 'gemini-2.0-flash',
  },
  // --- BYOK models (user provides API key, actual cost) ---
  'gpt-4o': {
    input: 2.50,
    output: 10.00,
    provider: 'openai',
    tier: 'premium',
    displayName: 'GPT-4o',
    description: 'OpenAI flagship, strong all-around (BYOK)',
    source: 'byok',
  },
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.60,
    provider: 'openai',
    tier: 'mid',
    displayName: 'GPT-4o mini',
    description: 'Fast and affordable OpenAI model (BYOK)',
    source: 'byok',
  },
  'claude-sonnet-4-5-20250929': {
    input: 3.00,
    output: 15.00,
    provider: 'anthropic',
    tier: 'premium',
    displayName: 'Claude Sonnet 4.5',
    description: 'Anthropic best balance of quality and speed (BYOK)',
    source: 'byok',
  },
  'claude-haiku-3-5-20241022': {
    input: 0.80,
    output: 4.00,
    provider: 'anthropic',
    tier: 'mid',
    displayName: 'Claude Haiku 3.5',
    description: 'Fast and affordable Anthropic model (BYOK)',
    source: 'byok',
  },
  'gemini-2.0-flash': {
    input: 0.10,
    output: 0.40,
    provider: 'google',
    tier: 'mid',
    displayName: 'Gemini 2.0 Flash',
    description: 'Google fast and cheap model (BYOK)',
    source: 'byok',
  },
  // --- Cloudflare Workers AI models (free for practice) ---
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b': {
    input: 0.50,
    output: 4.88,
    provider: 'cloudflare',
    tier: 'reasoning',
    displayName: 'DeepSeek R1 32B',
    description: 'Reasoning-optimized, best for complex logic',
    source: 'cloudflare',
  },
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': {
    input: 0.50,
    output: 0.60,
    provider: 'cloudflare',
    tier: 'premium',
    displayName: 'Llama 3.3 70B',
    description: 'Best overall quality, fast inference',
    source: 'cloudflare',
  },
  '@cf/meta/llama-3.1-70b-instruct': {
    input: 0.10,
    output: 0.12,
    provider: 'cloudflare',
    tier: 'mid',
    displayName: 'Llama 3.1 70B',
    description: 'Strong mid-range, good balance of cost and quality',
    source: 'cloudflare',
  },
  '@cf/qwen/qwen1.5-14b-chat-awq': {
    input: 0.08,
    output: 0.12,
    provider: 'cloudflare',
    tier: 'mid',
    displayName: 'Qwen 1.5 14B',
    description: 'Fast mid-range, good at code',
    source: 'cloudflare',
  },
  '@cf/meta/llama-3.1-8b-instruct': {
    input: 0.01,
    output: 0.01,
    provider: 'cloudflare',
    tier: 'budget',
    displayName: 'Llama 3.1 8B',
    description: 'Cheap and capable for straightforward tasks',
    source: 'cloudflare',
  },
  '@cf/mistral/mistral-7b-instruct-v0.2': {
    input: 0.01,
    output: 0.01,
    provider: 'cloudflare',
    tier: 'budget',
    displayName: 'Mistral 7B',
    description: 'Fast budget option with good instruction following',
    source: 'cloudflare',
  },
  '@cf/ibm-granite/granite-4.0-h-micro': {
    input: 0.017,
    output: 0.112,
    provider: 'cloudflare',
    tier: 'micro',
    displayName: 'Granite Micro',
    description: 'Ultra-cheap, simple tasks only',
    source: 'cloudflare',
  },
  '@cf/meta/llama-3.2-1b-instruct': {
    input: 0.027,
    output: 0.201,
    provider: 'cloudflare',
    tier: 'micro',
    displayName: 'Llama 3.2 1B',
    description: 'Tiny and fast, basic tasks',
    source: 'cloudflare',
  },
};

export function getModelPricing(model: string): ModelPricing | undefined {
  return MODEL_PRICING[model];
}

export function isHostedModel(model: string): boolean {
  return model.startsWith('hosted:');
}

export function isBYOKModel(model: string): boolean {
  const p = MODEL_PRICING[model];
  return !!p && p.source === 'byok';
}

export function getBYOKProvider(model: string): BYOKProvider | null {
  const p = MODEL_PRICING[model];
  if (!p || (p.source !== 'byok' && p.source !== 'hosted')) return null;
  return p.provider as BYOKProvider;
}

export function getHostedProvider(model: string): BYOKProvider | null {
  const p = MODEL_PRICING[model];
  if (!p || p.source !== 'hosted') return null;
  return p.provider as BYOKProvider;
}

export function getActualModelId(model: string): string {
  const p = MODEL_PRICING[model];
  return p?.actualModelId || model;
}

export function getCloudflareModels(): Array<{ id: string } & ModelPricing> {
  const tierOrder: Record<ModelTier, number> = { reasoning: 0, premium: 1, mid: 2, budget: 3, micro: 4 };
  return Object.entries(MODEL_PRICING)
    .filter(([, p]) => p.source === 'cloudflare')
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);
}

export function getHostedModels(): Array<{ id: string } & ModelPricing> {
  return Object.entries(MODEL_PRICING)
    .filter(([, p]) => p.source === 'hosted')
    .map(([id, p]) => ({ id, ...p }));
}

/** Get fallback chain for a given tier (same tier or lower only). Cloudflare models only. */
export function getTierFallbackChain(tier: ModelTier): string[] {
  const tierOrder: ModelTier[] = ['reasoning', 'premium', 'mid', 'budget', 'micro'];
  const startIdx = tierOrder.indexOf(tier);
  const allowedTiers = new Set(tierOrder.slice(startIdx));
  return Object.entries(MODEL_PRICING)
    .filter(([, p]) => p.source === 'cloudflare' && allowedTiers.has(p.tier))
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

/** Calculate actual API cost (without 2x markup) for platform spend tracking. */
export function calculateActualCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const p = MODEL_PRICING[model];
  if (!p || p.source !== 'hosted') return calculateCost(model, inputTokens, outputTokens);
  // Look up the BYOK version for actual pricing
  const byokId = p.actualModelId || model.replace('hosted:', '');
  const byokPricing = MODEL_PRICING[byokId];
  if (!byokPricing) return calculateCost(model, inputTokens, outputTokens);
  const inputCost = Math.ceil((inputTokens / 1_000_000) * byokPricing.input * 10000);
  const outputCost = Math.ceil((outputTokens / 1_000_000) * byokPricing.output * 10000);
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
