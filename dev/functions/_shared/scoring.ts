/**
 * AI Fluency Index (AFI) — composite score from radar dimensions.
 *
 * Scale: 0-850 (deliberately echoing credit scores).
 * Five dimensions weighted by real-world signal strength:
 *   - Prompt Efficiency (25%) — strongest predictor of cost savings
 *   - Model Selection (20%) — picking the right tier for the task
 *   - Debugging Strategy (20%) — iterating cheaply vs. burning tokens
 *   - Speed (20%) — wall-clock time efficiency
 *   - Multi-Model Strategy (15%) — switching models mid-challenge
 *
 * Tiers:
 *   750-850  Exceptional  (top ~5%)
 *   650-749  Advanced     (top ~20%)
 *   500-649  Proficient   (median range)
 *   350-499  Developing   (below average)
 *     0-349  Novice       (just starting)
 */

export interface RadarData {
  modelSelection: number;   // 0-100
  promptEfficiency: number; // 0-100
  debugging: number;        // 0-100
  multiModel: number;       // 0-100
  realWorld: number;        // 0-100 (treated as "speed" axis)
}

export interface AFIResult {
  score: number;    // 0-850
  tier: AFITier;
  label: string;
}

export type AFITier = 'exceptional' | 'advanced' | 'proficient' | 'developing' | 'novice';

const WEIGHTS = {
  promptEfficiency: 0.25,
  modelSelection: 0.20,
  debugging: 0.20,
  realWorld: 0.20,       // speed axis
  multiModel: 0.15,
};

const TIERS: { min: number; tier: AFITier; label: string }[] = [
  { min: 750, tier: 'exceptional', label: 'Exceptional' },
  { min: 650, tier: 'advanced', label: 'Advanced' },
  { min: 500, tier: 'proficient', label: 'Proficient' },
  { min: 350, tier: 'developing', label: 'Developing' },
  { min: 0, tier: 'novice', label: 'Novice' },
];

/**
 * Compute AFI score from radar data.
 * Each radar dimension is 0-100. Weighted average is scaled to 0-850.
 */
export function computeAFI(radar: RadarData): AFIResult {
  const weighted =
    radar.promptEfficiency * WEIGHTS.promptEfficiency +
    radar.modelSelection * WEIGHTS.modelSelection +
    radar.debugging * WEIGHTS.debugging +
    radar.realWorld * WEIGHTS.realWorld +
    radar.multiModel * WEIGHTS.multiModel;

  // Scale 0-100 weighted average to 0-850
  const score = Math.round(weighted * 8.5);
  const clamped = Math.min(850, Math.max(0, score));

  /* istanbul ignore next -- @preserve: TIERS always matches since last entry has min:0 */
  const matched = TIERS.find((t) => clamped >= t.min) ?? TIERS[TIERS.length - 1];
  return { score: clamped, tier: matched.tier, label: matched.label };
}

/** Get tier info for a given score without recomputing. */
export function getAFITier(score: number): { tier: AFITier; label: string } {
  /* istanbul ignore next -- @preserve: TIERS always matches since last entry has min:0 */
  const matched = TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
  return { tier: matched.tier, label: matched.label };
}

/** Color associated with each AFI tier (gold palette). */
export const AFI_TIER_COLORS: Record<AFITier, string> = {
  exceptional: '#c9a962',
  advanced: '#b8993e',
  proficient: '#8a7d5a',
  developing: '#6b6560',
  novice: '#4a4540',
};

/** DB category names → radar key mapping (single source of truth). */
export const RADAR_CATEGORIES = ['model_selection', 'prompt_efficiency', 'iterative_debugging', 'multi_model_strategy', 'real_world'] as const;
export const RADAR_KEYS = ['modelSelection', 'promptEfficiency', 'debugging', 'multiModel', 'realWorld'] as const;

/** Certification tier type. */
export type CertificationType = 'ai_fluent' | 'ai_fluent_pro' | 'ai_fluent_expert';

/** Certification thresholds (single source of truth for server-side). */
export const CERTIFICATION_THRESHOLDS: { type: CertificationType; minSolves: number; minCategories: number; minAFI: number }[] = [
  { type: 'ai_fluent_expert', minSolves: 50, minCategories: 5, minAFI: 700 },
  { type: 'ai_fluent_pro', minSolves: 25, minCategories: 3, minAFI: 550 },
  { type: 'ai_fluent', minSolves: 10, minCategories: 1, minAFI: 400 },
];

/**
 * Compute radar data from global and user per-category avg costs.
 * Shared by badges.ts and [username].ts to avoid duplication.
 */
export function computeRadarFromCosts(
  globalAvgs: { category: string; avgCost: number }[],
  userAvgs: { category: string; avgCost: number }[],
): RadarData {
  const globalMap = Object.fromEntries(globalAvgs.map((g) => [g.category, Number(g.avgCost)]));
  const userMap = Object.fromEntries(userAvgs.map((u) => [u.category, Number(u.avgCost)]));

  const radar: Record<string, number> = {};
  RADAR_CATEGORIES.forEach((cat, i) => {
    const gAvg = globalMap[cat];
    const uAvg = userMap[cat];
    radar[RADAR_KEYS[i]] = (gAvg && uAvg) ? Math.min(100, Math.max(0, Math.round((gAvg / uAvg) * 50))) : 0;
  });
  return radar as unknown as RadarData;
}

/**
 * Determine highest certification level a user qualifies for.
 * Returns null if no certification is earned.
 */
export function determineCertification(
  solveCount: number,
  categoryCount: number,
  afiScore: number,
): CertificationType | null {
  for (const cert of CERTIFICATION_THRESHOLDS) {
    if (solveCount >= cert.minSolves && categoryCount >= cert.minCategories && afiScore >= cert.minAFI) {
      return cert.type;
    }
  }
  return null;
}
