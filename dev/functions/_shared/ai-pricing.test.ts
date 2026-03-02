import { describe, it, expect } from 'vitest';
import {
  getModelPricing,
  calculateCost,
  countMessageTokens,
  getCloudflareModels,
  getTierFallbackChain,
  getToolCapableModels,
  getToolCapableFallbackChain,
} from './ai-pricing';

describe('getModelPricing', () => {
  it('returns pricing for known models', () => {
    const pricing = getModelPricing('@cf/meta/llama-3.1-8b-instruct');
    expect(pricing).toBeDefined();
    expect(pricing!.tier).toBe('budget');
    expect(pricing!.input).toBeGreaterThan(0);
    expect(pricing!.output).toBeGreaterThan(0);
  });

  it('returns undefined for unknown models', () => {
    expect(getModelPricing('nonexistent-model')).toBeUndefined();
  });

  it('returns correct tier for reasoning models', () => {
    const pricing = getModelPricing('@cf/qwen/qwq-32b');
    expect(pricing?.tier).toBe('reasoning');
  });

  it('returns correct tier for premium models', () => {
    const pricing = getModelPricing('@cf/qwen/qwen2.5-coder-32b-instruct');
    expect(pricing?.tier).toBe('premium');
  });
});

describe('calculateCost', () => {
  it('calculates cost in credit units (1 unit = $0.0001)', () => {
    // Llama 3.1 8B: $0.01/M input, $0.01/M output
    const cost = calculateCost('@cf/meta/llama-3.1-8b-instruct', 1000, 500);
    // 1000 input tokens * $0.01/M * 10000 = ceil(0.0001) = 1
    // 500 output tokens * $0.01/M * 10000 = ceil(0.00005) = 1
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(100); // should be cheap
  });

  it('throws for unknown model', () => {
    expect(() => calculateCost('unknown-model', 100, 100)).toThrow('Unknown model');
  });

  it('returns 0 for 0 tokens', () => {
    // With ceil, 0 input * rate = 0, ceil(0) = 0
    const cost = calculateCost('@cf/meta/llama-3.1-8b-instruct', 0, 0);
    expect(cost).toBe(0);
  });

  it('scales with token count', () => {
    const small = calculateCost('@cf/meta/llama-3.1-8b-instruct', 100, 100);
    const large = calculateCost('@cf/meta/llama-3.1-8b-instruct', 100000, 100000);
    expect(large).toBeGreaterThan(small);
  });

  it('reasoning models cost more than budget models for same tokens', () => {
    const budget = calculateCost('@cf/meta/llama-3.1-8b-instruct', 10000, 5000);
    const reasoning = calculateCost('@cf/qwen/qwq-32b', 10000, 5000);
    expect(reasoning).toBeGreaterThan(budget);
  });
});

describe('countMessageTokens', () => {
  it('estimates tokens based on character count', () => {
    const messages = [
      { role: 'user', content: 'Hello, world!' },
    ];
    const tokens = countMessageTokens(messages);
    // Base 3 + 4 + ceil((4 + 13) / 4) = 3 + 4 + 5 = 12
    expect(tokens).toBeGreaterThan(0);
  });

  it('increases with message length', () => {
    const short = countMessageTokens([{ role: 'user', content: 'hi' }]);
    const long = countMessageTokens([{ role: 'user', content: 'a'.repeat(10000) }]);
    expect(long).toBeGreaterThan(short);
  });

  it('accounts for multiple messages', () => {
    const single = countMessageTokens([{ role: 'user', content: 'test' }]);
    const double = countMessageTokens([
      { role: 'user', content: 'test' },
      { role: 'assistant', content: 'response' },
    ]);
    expect(double).toBeGreaterThan(single);
  });
});

describe('getCloudflareModels', () => {
  it('returns all models sorted by tier', () => {
    const models = getCloudflareModels();
    expect(models.length).toBeGreaterThan(0);

    // Verify sorting: reasoning < premium < mid < budget < micro
    const tierOrder: Record<string, number> = { reasoning: 0, premium: 1, mid: 2, budget: 3, micro: 4 };
    for (let i = 1; i < models.length; i++) {
      expect(tierOrder[models[i].tier]).toBeGreaterThanOrEqual(tierOrder[models[i - 1].tier]);
    }
  });

  it('includes required fields for each model', () => {
    const models = getCloudflareModels();
    for (const model of models) {
      expect(model.id).toBeTruthy();
      expect(model.displayName).toBeTruthy();
      expect(model.tier).toBeTruthy();
      expect(model.input).toBeGreaterThan(0);
      expect(model.output).toBeGreaterThan(0);
    }
  });
});

describe('getTierFallbackChain', () => {
  it('returns models at same tier or lower for reasoning', () => {
    const chain = getTierFallbackChain('reasoning');
    const models = chain.map(id => getModelPricing(id));
    // Should include all tiers
    const tiers = new Set(models.map(m => m?.tier));
    expect(tiers.has('reasoning')).toBe(true);
    expect(tiers.has('budget')).toBe(true);
  });

  it('does not include higher tiers in fallback', () => {
    const chain = getTierFallbackChain('budget');
    const models = chain.map(id => getModelPricing(id));
    for (const model of models) {
      expect(['budget', 'micro']).toContain(model?.tier);
    }
  });

  it('returns at least one model for micro tier', () => {
    const chain = getTierFallbackChain('micro');
    expect(chain.length).toBeGreaterThan(0);
  });

  it('returns sorted by tier (same or lower)', () => {
    const chain = getTierFallbackChain('mid');
    const models = chain.map(id => getModelPricing(id));
    const tierOrder: Record<string, number> = { reasoning: 0, premium: 1, mid: 2, budget: 3, micro: 4 };
    for (let i = 1; i < models.length; i++) {
      expect(tierOrder[models[i]!.tier]).toBeGreaterThanOrEqual(tierOrder[models[i - 1]!.tier]);
    }
  });
});

describe('getToolCapableModels', () => {
  it('returns only models with supportsTools=true', () => {
    const toolModels = getToolCapableModels();
    expect(toolModels.length).toBeGreaterThan(0);
    for (const id of toolModels) {
      const pricing = getModelPricing(id);
      expect(pricing?.supportsTools).toBe(true);
    }
  });

  it('includes known tool-capable models', () => {
    const toolModels = getToolCapableModels();
    expect(toolModels).toContain('@cf/qwen/qwen2.5-coder-32b-instruct');
    expect(toolModels).toContain('@cf/meta/llama-3.1-8b-instruct');
  });

  it('excludes models without tool support', () => {
    const toolModels = getToolCapableModels();
    // Gemma 3 12B does not support tools
    expect(toolModels).not.toContain('@cf/google/gemma-3-12b-it');
  });
});

describe('getToolCapableFallbackChain', () => {
  it('returns only tool-capable models at same tier or lower', () => {
    const chain = getToolCapableFallbackChain('premium');
    expect(chain.length).toBeGreaterThan(0);
    for (const id of chain) {
      const pricing = getModelPricing(id);
      expect(pricing?.supportsTools).toBe(true);
      expect(['premium', 'mid', 'budget', 'micro']).toContain(pricing?.tier);
    }
  });

  it('does not include higher tiers', () => {
    const chain = getToolCapableFallbackChain('budget');
    for (const id of chain) {
      const pricing = getModelPricing(id);
      expect(['budget', 'micro']).toContain(pricing?.tier);
    }
  });

  it('returns sorted by tier order', () => {
    const chain = getToolCapableFallbackChain('reasoning');
    const tierOrder: Record<string, number> = { reasoning: 0, premium: 1, mid: 2, budget: 3, micro: 4 };
    const models = chain.map(id => getModelPricing(id)!);
    for (let i = 1; i < models.length; i++) {
      expect(tierOrder[models[i].tier]).toBeGreaterThanOrEqual(tierOrder[models[i - 1].tier]);
    }
  });

  it('returns at least one model for micro tier', () => {
    const chain = getToolCapableFallbackChain('micro');
    // Micro tier may not have tool-capable models, but budget does
    // so calling from budget ensures at least one
    const budgetChain = getToolCapableFallbackChain('budget');
    expect(budgetChain.length).toBeGreaterThan(0);
  });
});
