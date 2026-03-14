import { describe, it, expect } from 'vitest';
import { estimateChatCost, formatEstimatedCost } from './cost-estimate';

describe('cost-estimate', () => {
  // ---------------------------------------------------------------------------
  // estimateChatCost
  // ---------------------------------------------------------------------------
  describe('estimateChatCost', () => {
    const KNOWN_MODEL = '@cf/meta/llama-3.1-8b-instruct'; // budget, input 0.01, output 0.01

    it('returns 0 for an empty message', () => {
      expect(estimateChatCost('', KNOWN_MODEL)).toBe(0);
    });

    it('returns 0 for a whitespace-only message', () => {
      expect(estimateChatCost('   \n\t  ', KNOWN_MODEL)).toBe(0);
    });

    it('returns 0 for an unknown model id', () => {
      expect(estimateChatCost('hello world', 'nonexistent-model')).toBe(0);
    });

    it('returns a positive cost for a non-empty message and valid model', () => {
      const cost = estimateChatCost('Write a function that sorts an array', KNOWN_MODEL);
      expect(cost).toBeGreaterThan(0);
    });

    it('longer messages cost more than shorter ones for the same model', () => {
      // Use a more expensive model so the cost difference survives Math.ceil rounding
      const expensiveModel = '@cf/qwen/qwen2.5-coder-32b-instruct';
      const short = estimateChatCost('hello', expensiveModel);
      const long = estimateChatCost('a'.repeat(2000), expensiveModel);
      expect(long).toBeGreaterThan(short);
    });

    it('premium models cost more than budget models for the same message', () => {
      const msg = 'Explain the difference between promises and callbacks in JavaScript';
      const budgetCost = estimateChatCost(msg, '@cf/meta/llama-3.1-8b-instruct');
      const premiumCost = estimateChatCost(msg, '@cf/qwen/qwen2.5-coder-32b-instruct');
      expect(premiumCost).toBeGreaterThan(budgetCost);
    });

    it('computes cost matching the documented formula', () => {
      // "hello" = 5 chars => messageTokens = ceil(5/4) = 2
      // inputTokens = 2 + 200 = 202
      // outputTokens = max(100, ceil(2*1.5)) = max(100, 3) = 100
      // For Llama 3.1 8B: input = 0.01 $/M, output = 0.01 $/M
      // inputCost  = ceil((202 / 1_000_000) * 0.01 * 10000) = ceil(0.0202) = 1
      // outputCost = ceil((100 / 1_000_000) * 0.01 * 10000) = ceil(0.01)   = 1
      // total = 2
      expect(estimateChatCost('hello', KNOWN_MODEL)).toBe(2);
    });

    it('uses the minimum 100 output tokens for very short messages', () => {
      // 1-char message: messageTokens = ceil(1/4) = 1
      // outputTokens = max(100, ceil(1*1.5)) = max(100, 2) = 100
      // This means a 1-char and 5-char message should produce the same output cost
      // if the input difference is small enough
      const cost1 = estimateChatCost('a', KNOWN_MODEL);
      const cost5 = estimateChatCost('hello', KNOWN_MODEL);
      // Both should use 100 output tokens (messageTokens <=66 chars means ceil(n*1.5)<=100)
      // The difference should only come from input tokens
      expect(cost1).toBeGreaterThan(0);
      expect(cost5).toBeGreaterThanOrEqual(cost1);
    });

    it('output tokens exceed 100 minimum for long messages', () => {
      // Use a model with higher pricing so the cost difference survives rounding
      const expensiveModel = '@cf/qwen/qwen2.5-coder-32b-instruct';
      // 1000 chars => messageTokens = ceil(1000/4) = 250
      // outputTokens = max(100, ceil(250*1.5)) = max(100, 375) = 375
      // So output tokens scale with message length for big messages
      const shortCost = estimateChatCost('a'.repeat(100), expensiveModel);
      const longCost = estimateChatCost('a'.repeat(1000), expensiveModel);
      expect(longCost).toBeGreaterThan(shortCost);
    });
  });

  // ---------------------------------------------------------------------------
  // formatEstimatedCost
  // ---------------------------------------------------------------------------
  describe('formatEstimatedCost', () => {
    it('returns "$0.00" for zero', () => {
      expect(formatEstimatedCost(0)).toBe('$0.00');
    });

    it('returns "<$0.0001" for values that round below $0.0001', () => {
      // 0.5 hundredths = $0.00005 which is < 0.0001
      // But we need dollars < 0.0001: hundredths / 10000 < 0.0001 => hundredths < 1
      // However hundredths=0 is handled above. Let's find one that's non-zero and < 1
      // Actually: cost-estimate returns integers from Math.ceil, so fractional hundredths
      // won't normally occur. But the function handles it.
      // 0.5 / 10000 = 0.00005 < 0.0001 => '<$0.0001'
      expect(formatEstimatedCost(0.5)).toBe('<$0.0001');
    });

    it('formats values between $0.0001 and $0.01 with tilde and 4 decimal places', () => {
      // 1 hundredth = $0.0001
      expect(formatEstimatedCost(1)).toBe('~$0.0001');
      // 50 hundredths = $0.005
      expect(formatEstimatedCost(50)).toBe('~$0.0050');
      // 99 hundredths = $0.0099
      expect(formatEstimatedCost(99)).toBe('~$0.0099');
    });

    it('formats values >= $0.01 with tilde and 2 decimal places', () => {
      // 100 hundredths = $0.01
      expect(formatEstimatedCost(100)).toBe('~$0.01');
      // 10000 hundredths = $1.00
      expect(formatEstimatedCost(10000)).toBe('~$1.00');
      // 50000 hundredths = $5.00
      expect(formatEstimatedCost(50000)).toBe('~$5.00');
    });

    it('boundary: exactly $0.0001 gets the tilde-4-digit format', () => {
      // dollars = 1 / 10000 = 0.0001, not < 0.0001, so falls through to < 0.01 branch
      expect(formatEstimatedCost(1)).toMatch(/^~\$/);
    });
  });
});
