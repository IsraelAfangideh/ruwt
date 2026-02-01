export type ModelTier = 'budget' | 'mid' | 'premium';
export type ModelProvider = 'openai' | 'anthropic' | 'cloudflare';

export interface ModelPricing {
  input: number;  // Cost per 1M tokens
  output: number; // Cost per 1M tokens
  provider: ModelProvider;
  tier: ModelTier;
  displayName: string;
  contextWindow: number;
  supportsTools: boolean;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Premium tier - OpenAI
  'gpt-4o': {
    input: 2.50,
    output: 10.00,
    provider: 'openai',
    tier: 'premium',
    displayName: 'GPT-4o',
    contextWindow: 128000,
    supportsTools: true,
  },
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.60,
    provider: 'openai',
    tier: 'mid',
    displayName: 'GPT-4o Mini',
    contextWindow: 128000,
    supportsTools: true,
  },

  // Premium tier - Anthropic
  'claude-sonnet-4-20250514': {
    input: 3.00,
    output: 15.00,
    provider: 'anthropic',
    tier: 'premium',
    displayName: 'Claude Sonnet 4',
    contextWindow: 200000,
    supportsTools: true,
  },
  'claude-3-5-haiku-20241022': {
    input: 0.80,
    output: 4.00,
    provider: 'anthropic',
    tier: 'mid',
    displayName: 'Claude 3.5 Haiku',
    contextWindow: 200000,
    supportsTools: true,
  },

  // Budget tier - Cloudflare Workers AI
  '@cf/meta/llama-3.1-70b-instruct': {
    input: 0.02,
    output: 0.02,
    provider: 'cloudflare',
    tier: 'budget',
    displayName: 'Llama 3.1 70B',
    contextWindow: 131072,
    supportsTools: false,
  },
  '@cf/meta/llama-3.1-8b-instruct': {
    input: 0.01,
    output: 0.01,
    provider: 'cloudflare',
    tier: 'budget',
    displayName: 'Llama 3.1 8B',
    contextWindow: 131072,
    supportsTools: false,
  },
  '@cf/mistral/mistral-7b-instruct-v0.2': {
    input: 0.01,
    output: 0.01,
    provider: 'cloudflare',
    tier: 'budget',
    displayName: 'Mistral 7B',
    contextWindow: 32768,
    supportsTools: false,
  },
};

export const AVAILABLE_MODELS = Object.keys(MODEL_PRICING);

export function getModelPricing(model: string): ModelPricing | undefined {
  return MODEL_PRICING[model];
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    throw new Error(`Unknown model: ${model}`);
  }

  // Cost in hundredths of cents (to avoid floating point issues)
  const inputCost = Math.ceil((inputTokens / 1_000_000) * pricing.input * 10000);
  const outputCost = Math.ceil((outputTokens / 1_000_000) * pricing.output * 10000);

  return inputCost + outputCost;
}

export function formatCost(costInHundredths: number): string {
  const dollars = costInHundredths / 10000;
  if (dollars < 0.01) {
    return `$${dollars.toFixed(4)}`;
  }
  return `$${dollars.toFixed(2)}`;
}

export function getModelsByTier(tier: ModelTier): string[] {
  return Object.entries(MODEL_PRICING)
    .filter(([, pricing]) => pricing.tier === tier)
    .map(([model]) => model);
}

export function getModelsByProvider(provider: ModelProvider): string[] {
  return Object.entries(MODEL_PRICING)
    .filter(([, pricing]) => pricing.provider === provider)
    .map(([model]) => model);
}
