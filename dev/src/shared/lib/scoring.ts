/**
 * AI Fluency Index (AFI) — client-side scoring.
 * Mirrors the server-side logic in functions/_shared/scoring.ts.
 */

export interface RadarData {
  modelSelection: number;
  promptEfficiency: number;
  debugging: number;
  multiModel: number;
  realWorld: number;
}

export type AFITier = 'exceptional' | 'advanced' | 'proficient' | 'developing' | 'novice';

export interface AFIResult {
  score: number;
  tier: AFITier;
  label: string;
}

const WEIGHTS = {
  promptEfficiency: 0.25,
  modelSelection: 0.20,
  debugging: 0.20,
  realWorld: 0.20,
  multiModel: 0.15,
};

const TIERS: { min: number; tier: AFITier; label: string }[] = [
  { min: 750, tier: 'exceptional', label: 'Exceptional' },
  { min: 650, tier: 'advanced', label: 'Advanced' },
  { min: 500, tier: 'proficient', label: 'Proficient' },
  { min: 350, tier: 'developing', label: 'Developing' },
  { min: 0, tier: 'novice', label: 'Novice' },
];

export function computeAFI(radar: RadarData): AFIResult {
  const weighted =
    radar.promptEfficiency * WEIGHTS.promptEfficiency +
    radar.modelSelection * WEIGHTS.modelSelection +
    radar.debugging * WEIGHTS.debugging +
    radar.realWorld * WEIGHTS.realWorld +
    radar.multiModel * WEIGHTS.multiModel;

  const score = Math.round(weighted * 8.5);
  const clamped = Math.min(850, Math.max(0, score));

  /* istanbul ignore next -- @preserve: TIERS always matches since last entry has min:0 */
  const matched = TIERS.find((t) => clamped >= t.min) ?? TIERS[TIERS.length - 1];
  return { score: clamped, tier: matched.tier, label: matched.label };
}

export function getAFITier(score: number): { tier: AFITier; label: string } {
  /* istanbul ignore next -- @preserve: TIERS always matches since last entry has min:0 */
  const matched = TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
  return { tier: matched.tier, label: matched.label };
}

export const AFI_TIER_COLORS: Record<AFITier, string> = {
  exceptional: '#c9a962',
  advanced: '#b8993e',
  proficient: '#8a7d5a',
  developing: '#6b6560',
  novice: '#4a4540',
};

/** Certification tiers for "AI-Fluent Verified" system. */
export interface CertificationDef {
  type: string;
  title: string;
  description: string;
  icon: string;
  minSolves: number;
  minCategories: number;
  minAFI: number;
}

export const CERTIFICATIONS: CertificationDef[] = [
  {
    type: 'ai_fluent',
    title: 'AI-Fluent',
    description: 'Passed 10+ challenges with AFI 400+',
    icon: '\uD83E\uDD49', // bronze medal
    minSolves: 10,
    minCategories: 1,
    minAFI: 400,
  },
  {
    type: 'ai_fluent_pro',
    title: 'AI-Fluent Pro',
    description: 'Passed 25+ challenges across 3+ categories with AFI 550+',
    icon: '\uD83E\uDD48', // silver medal
    minSolves: 25,
    minCategories: 3,
    minAFI: 550,
  },
  {
    type: 'ai_fluent_expert',
    title: 'AI-Fluent Expert',
    description: 'Passed 50+ challenges across all categories with AFI 700+',
    icon: '\uD83E\uDD47', // gold medal
    minSolves: 50,
    minCategories: 5,
    minAFI: 700,
  },
];
