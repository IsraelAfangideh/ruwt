/**
 * Nutrition calculation utilities.
 */

export interface MacroTargets {
  calories: number;
  protein: number;   // grams
  carbs: number;     // grams
  fat: number;       // grams
}

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

/** Calculate calories from macros (4-4-9 rule) */
export function macrosToCalories(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

/** Calculate macro split from calorie target and percentages */
export function calculateMacroTargets(
  calories: number,
  proteinPct: number,
  carbsPct: number,
  fatPct: number
): MacroTargets {
  return {
    calories,
    protein: Math.round((calories * proteinPct / 100) / 4),
    carbs: Math.round((calories * carbsPct / 100) / 4),
    fat: Math.round((calories * fatPct / 100) / 9),
  };
}

/** Default macro split: 30% protein, 40% carbs, 30% fat */
export const DEFAULT_MACRO_SPLIT = { protein: 30, carbs: 40, fat: 30 };

/** Format number with unit */
export function formatNutrient(value: number, unit: string): string {
  return `${Math.round(value)}${unit}`;
}

/** Get color for macro type */
export function getMacroColor(macro: 'protein' | 'carbs' | 'fat'): string {
  const macroColors = {
    protein: '#E74C3C',
    carbs: '#3498DB',
    fat: '#F39C12',
  };
  return macroColors[macro];
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export const MEAL_TYPE_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};
