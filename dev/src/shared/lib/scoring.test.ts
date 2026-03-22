import { describe, it, expect } from 'vitest';
import { computeAFI, AFI_TIER_COLORS, CERTIFICATIONS } from './scoring';

describe('client-side scoring', () => {
  it('computeAFI returns correct score and tier', () => {
    const result = computeAFI({
      modelSelection: 70,
      promptEfficiency: 70,
      debugging: 70,
      multiModel: 70,
      realWorld: 70,
    });
    // 70 * 8.5 = 595
    expect(result.score).toBe(595);
    expect(result.tier).toBe('proficient');
  });

  it('computeAFI matches server-side for edge values', () => {
    expect(computeAFI({ modelSelection: 0, promptEfficiency: 0, debugging: 0, multiModel: 0, realWorld: 0 }).score).toBe(0);
    expect(computeAFI({ modelSelection: 100, promptEfficiency: 100, debugging: 100, multiModel: 100, realWorld: 100 }).score).toBe(850);
  });

  it('AFI_TIER_COLORS covers all tiers', () => {
    expect(Object.keys(AFI_TIER_COLORS)).toHaveLength(5);
  });
});

describe('CERTIFICATIONS', () => {
  it('defines three certification tiers', () => {
    expect(CERTIFICATIONS).toHaveLength(3);
  });

  it('has correct AFI thresholds in ascending order', () => {
    expect(CERTIFICATIONS[0].minAFI).toBe(400);
    expect(CERTIFICATIONS[1].minAFI).toBe(550);
    expect(CERTIFICATIONS[2].minAFI).toBe(700);
  });

  it('has correct solve count requirements in ascending order', () => {
    expect(CERTIFICATIONS[0].minSolves).toBe(10);
    expect(CERTIFICATIONS[1].minSolves).toBe(25);
    expect(CERTIFICATIONS[2].minSolves).toBe(50);
  });

  it('each certification has required fields', () => {
    for (const cert of CERTIFICATIONS) {
      expect(cert.type).toBeTruthy();
      expect(cert.title).toBeTruthy();
      expect(cert.description).toBeTruthy();
      expect(cert.icon).toBeTruthy();
    }
  });
});
