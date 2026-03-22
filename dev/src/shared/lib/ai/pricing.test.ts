import { describe, it, expect } from 'vitest';
import {
  TIER_MODELS,
  getModelsForTier,
  getModelById,
  formatCostFromHundredths,
  tierColor,
  tierLabel,
  estimateTypicalMessageCost,
  estimateMessagesForBudget,
  friendlyModelName,
  getModelTier,
  getCostEfficiencySignal,
  type ModelTier,
} from './pricing';

describe('pricing', () => {
  // ---------------------------------------------------------------------------
  // TIER_MODELS constant
  // ---------------------------------------------------------------------------
  describe('TIER_MODELS', () => {
    it('has exactly one representative model per tier', () => {
      const tiers: ModelTier[] = ['reasoning', 'premium', 'mid', 'budget', 'micro'];
      for (const tier of tiers) {
        expect(TIER_MODELS[tier]).toBeDefined();
        expect(TIER_MODELS[tier].tier).toBe(tier);
      }
    });

    it('each representative is the first model of its tier in the full list', () => {
      const tiers: ModelTier[] = ['reasoning', 'premium', 'mid', 'budget', 'micro'];
      for (const tier of tiers) {
        const firstOfTier = getModelsForTier(tier)[0];
        expect(TIER_MODELS[tier].id).toBe(firstOfTier.id);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // getModelsForTier
  // ---------------------------------------------------------------------------
  describe('getModelsForTier', () => {
    it('returns only models matching the requested tier', () => {
      const reasoningModels = getModelsForTier('reasoning');
      expect(reasoningModels.length).toBeGreaterThan(0);
      for (const m of reasoningModels) {
        expect(m.tier).toBe('reasoning');
      }
    });

    it('returns multiple models for tiers that have several entries', () => {
      // mid tier has several models in the source
      const midModels = getModelsForTier('mid');
      expect(midModels.length).toBeGreaterThanOrEqual(3);
    });

    it('returns models for every defined tier', () => {
      const tiers: ModelTier[] = ['reasoning', 'premium', 'mid', 'budget', 'micro'];
      for (const tier of tiers) {
        expect(getModelsForTier(tier).length).toBeGreaterThan(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // getModelById
  // ---------------------------------------------------------------------------
  describe('getModelById', () => {
    it('finds a known model by exact id', () => {
      const model = getModelById('@cf/meta/llama-3.1-8b-instruct');
      expect(model).toBeDefined();
      expect(model!.displayName).toBe('Llama 3.1 8B');
    });

    it('returns undefined for an unknown id', () => {
      expect(getModelById('nonexistent-model')).toBeUndefined();
    });

    it('returns undefined for an empty string', () => {
      expect(getModelById('')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // formatCostFromHundredths
  // ---------------------------------------------------------------------------
  describe('formatCostFromHundredths', () => {
    it('formats zero as $0.0000', () => {
      // 0 / 10000 = 0, which is < 0.01, so toFixed(4)
      expect(formatCostFromHundredths(0)).toBe('$0.0000');
    });

    it('formats small amounts (< $0.01) with 4 decimal places', () => {
      // 5 hundredths = 5/10000 = $0.0005
      expect(formatCostFromHundredths(5)).toBe('$0.0005');
    });

    it('formats exactly $0.01 boundary with 2 decimal places', () => {
      // 100 hundredths = 100/10000 = $0.01
      expect(formatCostFromHundredths(100)).toBe('$0.01');
    });

    it('formats amounts >= $0.01 with 2 decimal places', () => {
      // 500 hundredths = $0.05
      expect(formatCostFromHundredths(500)).toBe('$0.05');
      // 10000 hundredths = $1.00
      expect(formatCostFromHundredths(10000)).toBe('$1.00');
    });

    it('formats values just under the $0.01 boundary with 4 decimal places', () => {
      // 99 hundredths = $0.0099 (< 0.01)
      expect(formatCostFromHundredths(99)).toBe('$0.0099');
    });
  });

  // ---------------------------------------------------------------------------
  // tierColor
  // ---------------------------------------------------------------------------
  describe('tierColor', () => {
    it('returns purple for reasoning tier', () => {
      expect(tierColor('reasoning')).toBe('#a78bfa');
    });

    it('returns pink for premium tier', () => {
      expect(tierColor('premium')).toBe('#da8ee7');
    });

    it('returns gold for mid tier', () => {
      expect(tierColor('mid')).toBe('#c9a962');
    });

    it('returns green for budget tier', () => {
      expect(tierColor('budget')).toBe('#3fb950');
    });

    it('returns gray for micro tier', () => {
      expect(tierColor('micro')).toBe('#8b949e');
    });
  });

  // ---------------------------------------------------------------------------
  // tierLabel
  // ---------------------------------------------------------------------------
  describe('tierLabel', () => {
    it('capitalizes each tier name correctly', () => {
      expect(tierLabel('reasoning')).toBe('Reasoning');
      expect(tierLabel('premium')).toBe('Premium');
      expect(tierLabel('mid')).toBe('Mid');
      expect(tierLabel('budget')).toBe('Budget');
      expect(tierLabel('micro')).toBe('Micro');
    });
  });

  // ---------------------------------------------------------------------------
  // estimateTypicalMessageCost
  // ---------------------------------------------------------------------------
  describe('estimateTypicalMessageCost', () => {
    it('returns a positive number for every tier', () => {
      const tiers: ModelTier[] = ['reasoning', 'premium', 'mid', 'budget', 'micro'];
      for (const tier of tiers) {
        expect(estimateTypicalMessageCost(tier)).toBeGreaterThan(0);
      }
    });

    it('reasoning tier costs more than budget tier', () => {
      expect(estimateTypicalMessageCost('reasoning')).toBeGreaterThan(
        estimateTypicalMessageCost('budget')
      );
    });

    it('computes cost using 500 input / 750 output token formula', () => {
      // Verify against manual calculation for the micro tier representative (Granite Micro)
      // input: 0.017 $/M, output: 0.112 $/M
      const m = TIER_MODELS.micro;
      const expectedInput = Math.ceil((500 / 1_000_000) * m.input * 10000);
      const expectedOutput = Math.ceil((750 / 1_000_000) * m.output * 10000);
      expect(estimateTypicalMessageCost('micro')).toBe(expectedInput + expectedOutput);
    });
  });

  // ---------------------------------------------------------------------------
  // estimateMessagesForBudget
  // ---------------------------------------------------------------------------
  describe('estimateMessagesForBudget', () => {
    it('returns the floor of budget / cost-per-message', () => {
      const cost = estimateTypicalMessageCost('budget');
      const budget = cost * 10 + 1; // enough for 10 full messages plus a remainder
      expect(estimateMessagesForBudget(budget, 'budget')).toBe(10);
    });

    it('returns 0 when budget is less than one message cost', () => {
      const cost = estimateTypicalMessageCost('premium');
      expect(estimateMessagesForBudget(cost - 1, 'premium')).toBe(
        Math.floor((cost - 1) / cost)
      );
    });

    it('returns 0 for zero budget', () => {
      expect(estimateMessagesForBudget(0, 'mid')).toBe(0);
    });

    it('cheaper tiers yield more messages for the same budget', () => {
      const budget = 100000; // generous budget
      expect(estimateMessagesForBudget(budget, 'budget')).toBeGreaterThan(
        estimateMessagesForBudget(budget, 'reasoning')
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Model data integrity
  // ---------------------------------------------------------------------------
  describe('model data integrity', () => {
    const allTiers: ModelTier[] = ['reasoning', 'premium', 'mid', 'budget', 'micro'];
    const allModels = allTiers.flatMap((t) => getModelsForTier(t));

    it('all model ids start with @cf/', () => {
      for (const m of allModels) {
        expect(m.id.startsWith('@cf/')).toBe(true);
      }
    });

    it('costIndicator matches tier conventions', () => {
      for (const m of allModels) {
        if (m.tier === 'reasoning') expect(m.costIndicator).toBe('$$$$$');
        if (m.tier === 'premium') expect(m.costIndicator).toBe('$$$');
        if (m.tier === 'mid') expect(m.costIndicator).toBe('$$');
        if (m.tier === 'budget') expect(m.costIndicator).toBe('$');
        if (m.tier === 'micro') expect(m.costIndicator).toBe('\u00A2');
      }
    });

    it('supportsTools is set on models across tiers', () => {
      const withTools = allModels.filter((m) => m.supportsTools);
      expect(withTools.length).toBeGreaterThan(0);
      for (const m of withTools) {
        expect(['reasoning', 'premium', 'mid', 'budget', 'micro']).toContain(m.tier);
      }
    });
  });

  describe('friendlyModelName', () => {
    it('strips @cf/meta/ prefix and -instruct suffix', () => {
      expect(friendlyModelName('@cf/meta/llama-3.1-8b-instruct')).toBe('llama-3.1-8b');
    });

    it('strips @cf/mistralai/ prefix', () => {
      expect(friendlyModelName('@cf/mistralai/mistral-small-3.1-24b-instruct')).toBe('mistral-small-3.1-24b');
    });

    it('strips @hf/ prefix and -chat suffix', () => {
      expect(friendlyModelName('@hf/some-model-chat')).toBe('some-model');
    });

    it('handles model with no prefix or suffix', () => {
      expect(friendlyModelName('plain-model')).toBe('plain-model');
    });
  });

  describe('getModelTier', () => {
    it('returns correct tier for known model', () => {
      expect(getModelTier('@cf/meta/llama-3.3-70b-instruct-fp8-fast')).toBe('premium');
    });

    it('returns premium fallback for unknown 70b model', () => {
      expect(getModelTier('unknown-70b-model')).toBe('premium');
    });

    it('returns mid fallback for unknown 12b model', () => {
      expect(getModelTier('unknown-12b-model')).toBe('mid');
    });

    it('returns micro fallback for completely unknown model', () => {
      expect(getModelTier('tiny-unknown')).toBe('micro');
    });
  });

  describe('getCostEfficiencySignal', () => {
    it('warns on easy challenge with premium model', () => {
      const signal = getCostEfficiencySignal('easy', 'premium', true);
      expect(signal?.type).toBe('warning');
      expect(signal?.message).toContain('Expensive');
    });

    it('warns on hard challenge with budget model that failed', () => {
      const signal = getCostEfficiencySignal('hard', 'budget', false);
      expect(signal?.type).toBe('warning');
      expect(signal?.message).toContain('Budget model');
    });

    it('positive signal on hard challenge with budget model that passed', () => {
      const signal = getCostEfficiencySignal('hard', 'budget', true);
      expect(signal?.type).toBe('positive');
      expect(signal?.message).toContain('Efficient');
    });

    it('returns null for medium challenge with mid-tier model', () => {
      expect(getCostEfficiencySignal('medium', 'mid', true)).toBeNull();
    });

    it('returns null for easy challenge with micro model', () => {
      expect(getCostEfficiencySignal('easy', 'micro', true)).toBeNull();
    });
  });
});
