/**
 * Client-side model pricing for display. Mirrors server ai-pricing.ts.
 * 3-tier game pricing: premium ($$$), mid ($$), budget ($).
 */

export type ModelTier = 'premium' | 'mid' | 'budget';

export interface ModelInfo {
  id: string;
  displayName: string;
  tier: ModelTier;
  input: number;
  output: number;
  costIndicator: string;
}

const MODELS: ModelInfo[] = [
  {
    id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    displayName: 'Llama 3.3 70B',
    tier: 'premium',
    input: 0.50,
    output: 0.60,
    costIndicator: '$$$',
  },
  {
    id: '@cf/meta/llama-3.1-70b-instruct',
    displayName: 'Llama 3.1 70B',
    tier: 'mid',
    input: 0.10,
    output: 0.12,
    costIndicator: '$$',
  },
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    displayName: 'Llama 3.1 8B',
    tier: 'budget',
    input: 0.01,
    output: 0.01,
    costIndicator: '$',
  },
  {
    id: '@cf/mistral/mistral-7b-instruct-v0.2',
    displayName: 'Mistral 7B',
    tier: 'budget',
    input: 0.01,
    output: 0.01,
    costIndicator: '$',
  },
];

/** One model per tier for the tier selector (the primary model for each tier). */
export const TIER_MODELS: Record<ModelTier, ModelInfo> = {
  premium: MODELS[0],
  mid: MODELS[1],
  budget: MODELS[2],
};

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
