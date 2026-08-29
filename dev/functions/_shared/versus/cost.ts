import { calculateCost } from '../ai/ai-pricing';
import { MAX_VERSUS_TICKS, VERSUS_TICK_INPUT_TOKENS, VERSUS_TICK_OUTPUT_TOKENS } from './types';

export function estimateVersusMatchCost(model: string): number {
  return calculateCost(model, VERSUS_TICK_INPUT_TOKENS, VERSUS_TICK_OUTPUT_TOKENS) * MAX_VERSUS_TICKS;
}