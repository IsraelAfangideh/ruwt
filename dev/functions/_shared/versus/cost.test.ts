import { describe, it, expect } from 'vitest';
import { estimateVersusMatchCost } from './cost';

describe('estimateVersusMatchCost', () => {
  it('returns a positive estimate for a known model', () => {
    expect(estimateVersusMatchCost('@cf/meta/llama-3.1-8b-instruct')).toBeGreaterThan(0);
  });
});
