/**
 * Client-side model pricing for display. Mirrors server ai-pricing.ts.
 * 5-tier game pricing: reasoning ($$$$$), premium ($$$), mid ($$), budget ($), micro (¢).
 * All models are Cloudflare Workers AI.
 */

export type ModelTier = 'reasoning' | 'premium' | 'mid' | 'budget' | 'micro';

export interface ModelInfo {
  id: string;
  displayName: string;
  tier: ModelTier;
  input: number;
  output: number;
  costIndicator: string;
  description: string;
  supportsTools?: boolean;
  supportsJsonMode?: boolean;
}

const MODELS: ModelInfo[] = [
  // Reasoning tier
  {
    id: '@cf/openai/gpt-oss-120b',
    displayName: 'GPT-OSS 120B',
    tier: 'reasoning',
    input: 0.35,
    output: 0.75,
    costIndicator: '$$$$$',
    description: 'OpenAI open-weight 120B, strongest reasoning',
  },
  {
    id: '@cf/qwen/qwq-32b',
    displayName: 'QwQ 32B',
    tier: 'reasoning',
    input: 0.66,
    output: 1.00,
    costIndicator: '$$$$$',
    description: 'Dedicated reasoning, competitive with o1-mini',
  },
  {
    id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    displayName: 'DeepSeek R1 32B',
    tier: 'reasoning',
    input: 0.50,
    output: 4.88,
    costIndicator: '$$$$$',
    description: 'DeepSeek reasoning distilled from R1',
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
    supportsTools: true,
    supportsJsonMode: true,
  },
  {
    id: '@cf/mistralai/mistral-small-3.1-24b-instruct',
    displayName: 'Mistral Small 3.1',
    tier: 'premium',
    input: 0.35,
    output: 0.56,
    costIndicator: '$$$',
    description: 'Mistral 24B, 128k context window',
    supportsTools: true,
  },
  {
    id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    displayName: 'Llama 3.3 70B',
    tier: 'premium',
    input: 0.50,
    output: 0.60,
    costIndicator: '$$$',
    description: 'Meta 70B, fast fp8 inference',
    supportsTools: true,
    supportsJsonMode: true,
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
    supportsTools: true,
  },
  {
    id: '@cf/google/gemma-3-12b-it',
    displayName: 'Gemma 3 12B',
    tier: 'mid',
    input: 0.35,
    output: 0.56,
    costIndicator: '$$',
    description: 'Google Gemma 3, multimodal capable',
  },
  {
    id: '@cf/openai/gpt-oss-20b',
    displayName: 'GPT-OSS 20B',
    tier: 'mid',
    input: 0.20,
    output: 0.30,
    costIndicator: '$$',
    description: 'OpenAI open-weight 20B, fast and capable',
  },
  {
    id: '@cf/meta/llama-3.1-70b-instruct',
    displayName: 'Llama 3.1 70B',
    tier: 'mid',
    input: 0.10,
    output: 0.12,
    costIndicator: '$$',
    description: 'Strong mid-range, good balance',
    supportsTools: true,
    supportsJsonMode: true,
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
  },
  {
    id: '@cf/zai-org/glm-4.7-flash',
    displayName: 'GLM-4.7 Flash',
    tier: 'budget',
    input: 0.06,
    output: 0.40,
    costIndicator: '$',
    description: '131k context, fast and cheap',
  },
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    displayName: 'Llama 3.1 8B',
    tier: 'budget',
    input: 0.01,
    output: 0.01,
    costIndicator: '$',
    description: 'Cheap and capable for straightforward tasks',
    supportsTools: true,
    supportsJsonMode: true,
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
  },
  {
    id: '@cf/meta/llama-3.2-1b-instruct',
    displayName: 'Llama 3.2 1B',
    tier: 'micro',
    input: 0.027,
    output: 0.201,
    costIndicator: '\u00A2',
    description: 'Tiny and fast, basic tasks',
  },
];

/** One model per tier for the tier selector (the primary/default Cloudflare model for each tier). */
export const TIER_MODELS: Record<ModelTier, ModelInfo> = {
  reasoning: MODELS.find((m) => m.tier === 'reasoning')!,
  premium: MODELS.find((m) => m.tier === 'premium')!,
  mid: MODELS.find((m) => m.tier === 'mid')!,
  budget: MODELS.find((m) => m.tier === 'budget')!,
  micro: MODELS.find((m) => m.tier === 'micro')!,
};

/** Canonical tier ordering (cheapest → most expensive). */
export const TIER_ORDER: ModelTier[] = ['micro', 'budget', 'mid', 'premium', 'reasoning'];

/** Models available for a given tier. */
export function getModelsForTier(tier: ModelTier): ModelInfo[] {
  return MODELS.filter((m) => m.tier === tier);
}

export function getAllModels(): ModelInfo[] {
  return MODELS;
}

export function getModelById(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}

export function getCloudflareModels(): ModelInfo[] {
  return MODELS;
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

/** Estimate cost of a typical chat message (in hundredths-of-a-cent) for a given tier. */
export function estimateTypicalMessageCost(tier: ModelTier): number {
  // Typical exchange: ~500 input tokens, ~750 output tokens
  const m = TIER_MODELS[tier];
  const inputCost = Math.ceil((500 / 1_000_000) * m.input * 10000);
  const outputCost = Math.ceil((750 / 1_000_000) * m.output * 10000);
  return inputCost + outputCost;
}

/** Estimate how many messages fit in a budget (in hundredths-of-a-cent) for a given tier. */
export function estimateMessagesForBudget(budgetHundredths: number, tier: ModelTier): number {
  const costPerMsg = estimateTypicalMessageCost(tier);
  return costPerMsg > 0 ? Math.floor(budgetHundredths / costPerMsg) : 999;
}
