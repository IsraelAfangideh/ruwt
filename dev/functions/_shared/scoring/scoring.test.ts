import { describe, it, expect } from 'vitest';
import { computeAFI, getAFITier, AFI_TIER_COLORS, computeRadarFromCosts, determineCertification, RADAR_CATEGORIES, RADAR_KEYS, CERTIFICATION_THRESHOLDS } from './scoring';

describe('computeAFI', () => {
  it('returns novice tier for all-zero radar data', () => {
    const result = computeAFI({
      modelSelection: 0,
      promptEfficiency: 0,
      debugging: 0,
      multiModel: 0,
      realWorld: 0,
    });
    expect(result.score).toBe(0);
    expect(result.tier).toBe('novice');
    expect(result.label).toBe('Novice');
  });

  it('returns exceptional tier for perfect radar data', () => {
    const result = computeAFI({
      modelSelection: 100,
      promptEfficiency: 100,
      debugging: 100,
      multiModel: 100,
      realWorld: 100,
    });
    expect(result.score).toBe(850);
    expect(result.tier).toBe('exceptional');
    expect(result.label).toBe('Exceptional');
  });

  it('returns proficient tier for median radar data', () => {
    const result = computeAFI({
      modelSelection: 60,
      promptEfficiency: 65,
      debugging: 60,
      multiModel: 55,
      realWorld: 60,
    });
    // Weighted: 65*0.25 + 60*0.20 + 60*0.20 + 60*0.20 + 55*0.15 = 16.25+12+12+12+8.25 = 60.5 -> 60.5*8.5 = 514
    expect(result.score).toBeGreaterThanOrEqual(500);
    expect(result.score).toBeLessThan(650);
    expect(result.tier).toBe('proficient');
  });

  it('returns developing tier for below-average radar data', () => {
    const result = computeAFI({
      modelSelection: 45,
      promptEfficiency: 40,
      debugging: 45,
      multiModel: 40,
      realWorld: 45,
    });
    expect(result.score).toBeGreaterThanOrEqual(350);
    expect(result.score).toBeLessThan(500);
    expect(result.tier).toBe('developing');
  });

  it('returns advanced tier for strong radar data', () => {
    const result = computeAFI({
      modelSelection: 85,
      promptEfficiency: 80,
      debugging: 80,
      multiModel: 75,
      realWorld: 80,
    });
    expect(result.score).toBeGreaterThanOrEqual(650);
    expect(result.score).toBeLessThan(750);
    expect(result.tier).toBe('advanced');
  });

  it('clamps score to 850 maximum', () => {
    // Even with values somehow above 100, score is capped
    const result = computeAFI({
      modelSelection: 100,
      promptEfficiency: 100,
      debugging: 100,
      multiModel: 100,
      realWorld: 100,
    });
    expect(result.score).toBeLessThanOrEqual(850);
  });

  it('applies correct weights to each dimension', () => {
    // Only promptEfficiency at 100, rest at 0 — should be 25% * 100 * 8.5 = 213
    const result = computeAFI({
      modelSelection: 0,
      promptEfficiency: 100,
      debugging: 0,
      multiModel: 0,
      realWorld: 0,
    });
    expect(result.score).toBe(213);
  });
});

describe('getAFITier', () => {
  it('returns correct tier for each threshold boundary', () => {
    expect(getAFITier(850).tier).toBe('exceptional');
    expect(getAFITier(750).tier).toBe('exceptional');
    expect(getAFITier(749).tier).toBe('advanced');
    expect(getAFITier(650).tier).toBe('advanced');
    expect(getAFITier(649).tier).toBe('proficient');
    expect(getAFITier(500).tier).toBe('proficient');
    expect(getAFITier(499).tier).toBe('developing');
    expect(getAFITier(350).tier).toBe('developing');
    expect(getAFITier(349).tier).toBe('novice');
    expect(getAFITier(0).tier).toBe('novice');
  });
});

describe('AFI_TIER_COLORS', () => {
  it('has a color defined for every tier', () => {
    expect(AFI_TIER_COLORS.exceptional).toBeDefined();
    expect(AFI_TIER_COLORS.advanced).toBeDefined();
    expect(AFI_TIER_COLORS.proficient).toBeDefined();
    expect(AFI_TIER_COLORS.developing).toBeDefined();
    expect(AFI_TIER_COLORS.novice).toBeDefined();
  });
});

describe('computeRadarFromCosts', () => {
  it('computes radar scores from global and user avg costs', () => {
    const globalAvgs = [{ category: 'model_selection', avgCost: 1000 }, { category: 'prompt_efficiency', avgCost: 2000 }];
    const userAvgs = [{ category: 'model_selection', avgCost: 500 }, { category: 'prompt_efficiency', avgCost: 2000 }];
    const radar = computeRadarFromCosts(globalAvgs, userAvgs);
    expect(radar.modelSelection).toBe(100); // 1000/500*50 = 100
    expect(radar.promptEfficiency).toBe(50); // 2000/2000*50 = 50
    expect(radar.debugging).toBe(0); // no data
  });

  it('returns all zeros when no data', () => {
    const radar = computeRadarFromCosts([], []);
    expect(radar.modelSelection).toBe(0);
    expect(radar.debugging).toBe(0);
  });
});

describe('determineCertification', () => {
  it('returns ai_fluent_expert for 50+ solves, 5+ categories, AFI 700+', () => {
    expect(determineCertification(50, 5, 700)).toBe('ai_fluent_expert');
  });

  it('returns ai_fluent_pro for 25+ solves, 3+ categories, AFI 550+', () => {
    expect(determineCertification(25, 3, 550)).toBe('ai_fluent_pro');
  });

  it('returns ai_fluent for 10+ solves, AFI 400+', () => {
    expect(determineCertification(10, 1, 400)).toBe('ai_fluent');
  });

  it('returns null when no certification met', () => {
    expect(determineCertification(5, 1, 300)).toBeNull();
  });

  it('returns highest matching certification', () => {
    // Meets all three — should return expert (highest)
    expect(determineCertification(60, 5, 750)).toBe('ai_fluent_expert');
  });
});

describe('RADAR_CATEGORIES and RADAR_KEYS', () => {
  it('have matching lengths', () => {
    expect(RADAR_CATEGORIES.length).toBe(RADAR_KEYS.length);
    expect(RADAR_CATEGORIES.length).toBe(5);
  });
});

describe('CERTIFICATION_THRESHOLDS', () => {
  it('has 3 tiers in descending order', () => {
    expect(CERTIFICATION_THRESHOLDS).toHaveLength(3);
    expect(CERTIFICATION_THRESHOLDS[0].minSolves).toBeGreaterThan(CERTIFICATION_THRESHOLDS[2].minSolves);
  });
});
