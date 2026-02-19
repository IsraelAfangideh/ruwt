/**
 * Client-side model pricing for display. Mirrors server ai-pricing.ts.
 * 5-tier game pricing: reasoning ($$$$$), premium ($$$), mid ($$), budget ($), micro (¢).
 * Three sources: cloudflare (free practice), hosted (platform keys, 2x markup), byok (user keys).
 */

export type ModelTier = 'reasoning' | 'premium' | 'mid' | 'budget' | 'micro';

export type ModelSource = 'cloudflare' | 'hosted' | 'byok';

export type BYOKProvider = 'openai' | 'anthropic' | 'google';

export interface ModelInfo {
  id: string;
  displayName: string;
  tier: ModelTier;
  input: number;
  output: number;
  costIndicator: string;
  description: string;
  provider?: BYOKProvider; // set for BYOK models
  source: ModelSource;
  hostedProvider?: BYOKProvider; // set for hosted models
}

const MODELS: ModelInfo[] = [
  // --- Platform-hosted models (2x markup, available to all users) ---
  {
    id: 'hosted:gpt-4o',
    displayName: 'GPT-4o',
    tier: 'premium',
    input: 5.00,
    output: 20.00,
    costIndicator: '$$$',
    description: 'OpenAI flagship',
    source: 'hosted',
    hostedProvider: 'openai',
  },
  {
    id: 'hosted:gpt-4o-mini',
    displayName: 'GPT-4o mini',
    tier: 'mid',
    input: 0.30,
    output: 1.20,
    costIndicator: '$$',
    description: 'Fast OpenAI model',
    source: 'hosted',
    hostedProvider: 'openai',
  },
  {
    id: 'hosted:claude-sonnet-4-5-20250929',
    displayName: 'Claude Sonnet 4.5',
    tier: 'premium',
    input: 6.00,
    output: 30.00,
    costIndicator: '$$$',
    description: 'Anthropic best balance',
    source: 'hosted',
    hostedProvider: 'anthropic',
  },
  {
    id: 'hosted:claude-haiku-3-5-20241022',
    displayName: 'Claude Haiku 3.5',
    tier: 'mid',
    input: 1.60,
    output: 8.00,
    costIndicator: '$$',
    description: 'Fast Anthropic model',
    source: 'hosted',
    hostedProvider: 'anthropic',
  },
  {
    id: 'hosted:gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    tier: 'mid',
    input: 0.20,
    output: 0.80,
    costIndicator: '$$',
    description: 'Google fast model',
    source: 'hosted',
    hostedProvider: 'google',
  },
  // --- BYOK models ---
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    tier: 'premium',
    input: 2.50,
    output: 10.00,
    costIndicator: '$$$',
    description: 'OpenAI flagship (BYOK)',
    provider: 'openai',
    source: 'byok',
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o mini',
    tier: 'mid',
    input: 0.15,
    output: 0.60,
    costIndicator: '$$',
    description: 'Fast OpenAI model (BYOK)',
    provider: 'openai',
    source: 'byok',
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    displayName: 'Claude Sonnet 4.5',
    tier: 'premium',
    input: 3.00,
    output: 15.00,
    costIndicator: '$$$',
    description: 'Anthropic best balance (BYOK)',
    provider: 'anthropic',
    source: 'byok',
  },
  {
    id: 'claude-haiku-3-5-20241022',
    displayName: 'Claude Haiku 3.5',
    tier: 'mid',
    input: 0.80,
    output: 4.00,
    costIndicator: '$$',
    description: 'Fast Anthropic model (BYOK)',
    provider: 'anthropic',
    source: 'byok',
  },
  {
    id: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    tier: 'mid',
    input: 0.10,
    output: 0.40,
    costIndicator: '$$',
    description: 'Google fast model (BYOK)',
    provider: 'google',
    source: 'byok',
  },
  // --- Cloudflare Workers AI models ---
  // Reasoning tier
  {
    id: '@cf/openai/gpt-oss-120b',
    displayName: 'GPT-OSS 120B',
    tier: 'reasoning',
    input: 0.35,
    output: 0.75,
    costIndicator: '$$$$$',
    description: 'OpenAI open-weight 120B, strongest reasoning',
    source: 'cloudflare',
  },
  {
    id: '@cf/qwen/qwq-32b',
    displayName: 'QwQ 32B',
    tier: 'reasoning',
    input: 0.66,
    output: 1.00,
    costIndicator: '$$$$$',
    description: 'Dedicated reasoning, competitive with o1-mini',
    source: 'cloudflare',
  },
  {
    id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    displayName: 'DeepSeek R1 32B',
    tier: 'reasoning',
    input: 0.50,
    output: 4.88,
    costIndicator: '$$$$$',
    description: 'DeepSeek reasoning distilled from R1',
    source: 'cloudflare',
  },
  // Premium tier
  {
    id: '@cf/qwen/qwen2.5-coder-32b-instruct',
    displayName: 'Qwen2.5 Coder 32B',
    tier: 'premium',
    input: 0.66,
    output: 1.00,
    costIndicator: '$$$',
    description: 'Code-specialized, top-tier for coding tasks',
    source: 'cloudflare',
  },
  {
    id: '@cf/mistralai/mistral-small-3.1-24b-instruct',
    displayName: 'Mistral Small 3.1',
    tier: 'premium',
    input: 0.35,
    output: 0.56,
    costIndicator: '$$$',
    description: 'Mistral 24B, 128k context window',
    source: 'cloudflare',
  },
  {
    id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    displayName: 'Llama 3.3 70B',
    tier: 'premium',
    input: 0.50,
    output: 0.60,
    costIndicator: '$$$',
    description: 'Meta 70B, fast fp8 inference',
    source: 'cloudflare',
  },
  // Mid tier
  {
    id: '@cf/meta/llama-4-scout-17b-16e-instruct',
    displayName: 'Llama 4 Scout',
    tier: 'mid',
    input: 0.27,
    output: 0.85,
    costIndicator: '$$',
    description: 'Llama 4 MoE with 16 experts',
    source: 'cloudflare',
  },
  {
    id: '@cf/google/gemma-3-12b-it',
    displayName: 'Gemma 3 12B',
    tier: 'mid',
    input: 0.35,
    output: 0.56,
    costIndicator: '$$',
    description: 'Google Gemma 3, multimodal capable',
    source: 'cloudflare',
  },
  {
    id: '@cf/openai/gpt-oss-20b',
    displayName: 'GPT-OSS 20B',
    tier: 'mid',
    input: 0.20,
    output: 0.30,
    costIndicator: '$$',
    description: 'OpenAI open-weight 20B, fast and capable',
    source: 'cloudflare',
  },
  {
    id: '@cf/meta/llama-3.1-70b-instruct',
    displayName: 'Llama 3.1 70B',
    tier: 'mid',
    input: 0.10,
    output: 0.12,
    costIndicator: '$$',
    description: 'Strong mid-range, good balance',
    source: 'cloudflare',
  },
  {
    id: '@cf/qwen/qwen1.5-14b-chat-awq',
    displayName: 'Qwen 1.5 14B',
    tier: 'mid',
    input: 0.08,
    output: 0.12,
    costIndicator: '$$',
    description: 'Fast mid-range, good at code',
    source: 'cloudflare',
  },
  // Budget tier
  {
    id: '@cf/qwen/qwen3-30b-a3b-fp8',
    displayName: 'Qwen3 30B MoE',
    tier: 'budget',
    input: 0.051,
    output: 0.34,
    costIndicator: '$',
    description: 'Qwen3 MoE, ultra-cheap for its size',
    source: 'cloudflare',
  },
  {
    id: '@cf/zai-org/glm-4.7-flash',
    displayName: 'GLM-4.7 Flash',
    tier: 'budget',
    input: 0.06,
    output: 0.40,
    costIndicator: '$',
    description: '131k context, fast and cheap',
    source: 'cloudflare',
  },
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    displayName: 'Llama 3.1 8B',
    tier: 'budget',
    input: 0.01,
    output: 0.01,
    costIndicator: '$',
    description: 'Cheap and capable for straightforward tasks',
    source: 'cloudflare',
  },
  {
    id: '@cf/mistral/mistral-7b-instruct-v0.2',
    displayName: 'Mistral 7B',
    tier: 'budget',
    input: 0.01,
    output: 0.01,
    costIndicator: '$',
    description: 'Fast budget option',
    source: 'cloudflare',
  },
  // Micro tier
  {
    id: '@cf/ibm-granite/granite-4.0-h-micro',
    displayName: 'Granite Micro',
    tier: 'micro',
    input: 0.017,
    output: 0.112,
    costIndicator: '\u00A2',
    description: 'Ultra-cheap, simple tasks only',
    source: 'cloudflare',
  },
  {
    id: '@cf/meta/llama-3.2-1b-instruct',
    displayName: 'Llama 3.2 1B',
    tier: 'micro',
    input: 0.027,
    output: 0.201,
    costIndicator: '\u00A2',
    description: 'Tiny and fast, basic tasks',
    source: 'cloudflare',
  },
];

/** One model per tier for the tier selector (the primary/default Cloudflare model for each tier). */
const cfModels = MODELS.filter((m) => m.source === 'cloudflare');
export const TIER_MODELS: Record<ModelTier, ModelInfo> = {
  reasoning: cfModels.find((m) => m.tier === 'reasoning')!,
  premium: cfModels.find((m) => m.tier === 'premium')!,
  mid: cfModels.find((m) => m.tier === 'mid')!,
  budget: cfModels.find((m) => m.tier === 'budget')!,
  micro: cfModels.find((m) => m.tier === 'micro')!,
};

/** Cloudflare models available for a given tier (excludes BYOK and hosted). */
export function getModelsForTier(tier: ModelTier): ModelInfo[] {
  return MODELS.filter((m) => m.tier === tier && m.source === 'cloudflare');
}

/** Hosted models available for a given tier. */
export function getHostedModelsForTier(tier: ModelTier): ModelInfo[] {
  return MODELS.filter((m) => m.tier === tier && m.source === 'hosted');
}

export function getAllModels(): ModelInfo[] {
  return MODELS;
}

export function getModelById(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}

export function isBYOKModel(model: ModelInfo): boolean {
  return model.source === 'byok';
}

export function isHostedModel(model: ModelInfo): boolean {
  return model.source === 'hosted';
}

export function getCloudflareModels(): ModelInfo[] {
  return MODELS.filter((m) => m.source === 'cloudflare');
}

export function getBYOKModels(): ModelInfo[] {
  return MODELS.filter((m) => m.source === 'byok');
}

export function getHostedModels(): ModelInfo[] {
  return MODELS.filter((m) => m.source === 'hosted');
}

/** Get BYOK equivalent for a hosted model (for savings comparison). */
export function getBYOKEquivalent(hostedModel: ModelInfo): ModelInfo | undefined {
  if (hostedModel.source !== 'hosted' || !hostedModel.hostedProvider) return undefined;
  return MODELS.find(m =>
    m.source === 'byok' &&
    m.provider === hostedModel.hostedProvider &&
    m.tier === hostedModel.tier
  );
}

export function formatCostFromHundredths(hundredths: number): string {
  const dollars = hundredths / 10000;
  return dollars < 0.01 ? `$${dollars.toFixed(4)}` : `$${dollars.toFixed(2)}`;
}

export function tierColor(tier: ModelTier): string {
  switch (tier) {
    case 'reasoning': return '#a78bfa'; // purple
    case 'premium': return '#da8ee7';   // pink
    case 'mid': return '#c9a962';       // gold
    case 'budget': return '#3fb950';    // green
    case 'micro': return '#8b949e';     // gray
  }
}

export function tierLabel(tier: ModelTier): string {
  switch (tier) {
    case 'reasoning': return 'Reasoning';
    case 'premium': return 'Premium';
    case 'mid': return 'Mid';
    case 'budget': return 'Budget';
    case 'micro': return 'Micro';
  }
}
