/**
 * Client-side model pricing for display. Mirrors server ai-pricing.ts.
 * 5-tier game pricing: reasoning ($$$$$), premium ($$$), mid ($$), budget ($), micro (¢).
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
}

const MODELS: ModelInfo[] = [
  {
    id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    displayName: 'DeepSeek R1 32B',
    tier: 'reasoning',
    input: 0.50,
    output: 4.88,
    costIndicator: '$$$$$',
    description: 'Reasoning-optimized, best for complex logic',
  },
  {
    id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    displayName: 'Llama 3.3 70B',
    tier: 'premium',
    input: 0.50,
    output: 0.60,
    costIndicator: '$$$',
    description: 'Best overall quality, fast inference',
  },
  {
    id: '@cf/meta/llama-3.1-70b-instruct',
    displayName: 'Llama 3.1 70B',
    tier: 'mid',
    input: 0.10,
    output: 0.12,
    costIndicator: '$$',
    description: 'Strong mid-range, good balance',
  },
  {
    id: '@cf/qwen/qwen1.5-14b-chat-awq',
    displayName: 'Qwen 1.5 14B',
    tier: 'mid',
    input: 0.08,
    output: 0.12,
    costIndicator: '$$',
    description: 'Fast mid-range, good at code',
  },
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    displayName: 'Llama 3.1 8B',
    tier: 'budget',
    input: 0.01,
    output: 0.01,
    costIndicator: '$',
    description: 'Cheap and capable for straightforward tasks',
  },
  {
    id: '@cf/mistral/mistral-7b-instruct-v0.2',
    displayName: 'Mistral 7B',
    tier: 'budget',
    input: 0.01,
    output: 0.01,
    costIndicator: '$',
    description: 'Fast budget option',
  },
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

/** One model per tier for the tier selector (the primary/default model for each tier). */
export const TIER_MODELS: Record<ModelTier, ModelInfo> = {
  reasoning: MODELS[0],
  premium: MODELS[1],
  mid: MODELS[2],
  budget: MODELS[4],
  micro: MODELS[6],
};

/** All models available for a given tier. */
export function getModelsForTier(tier: ModelTier): ModelInfo[] {
  return MODELS.filter((m) => m.tier === tier);
}

export function getAllModels(): ModelInfo[] {
  return MODELS;
}

export function getModelById(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
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
