/**
 * Client-side badge definitions mirroring functions/_shared/badges.ts BADGE_DEFS.
 * Used to resolve badge type strings from the submission API into display data.
 */
export interface BadgeDef {
  type: string;
  title: string;
  description: string;
  icon: string;
}

export const BADGE_DEFS: Record<string, BadgeDef> = {
  first_solve: { type: 'first_solve', title: 'First Blood', description: 'Solved your first challenge', icon: '\u{1F3AF}' },
  streak_3: { type: 'streak_3', title: 'Getting Warm', description: '3-day daily challenge streak', icon: '\u{1F525}' },
  streak_7: { type: 'streak_7', title: 'On Fire', description: '7-day daily challenge streak', icon: '\u{1F525}' },
  streak_30: { type: 'streak_30', title: 'Unstoppable', description: '30-day daily challenge streak', icon: '\u{1F48E}' },
  streak_100: { type: 'streak_100', title: 'Legendary', description: '100-day daily challenge streak', icon: '\u{1F451}' },
  penny_pincher: { type: 'penny_pincher', title: 'Penny Pincher', description: 'Solved a challenge for under $0.01', icon: '\u{1F4B0}' },
  speed_demon: { type: 'speed_demon', title: 'Speed Demon', description: 'Solved a timed challenge in under 5 minutes', icon: '\u{26A1}' },
  model_master: { type: 'model_master', title: 'Model Master', description: 'Used 5+ different AI models across solves', icon: '\u{1F9E0}' },
  polyglot: { type: 'polyglot', title: 'Polyglot', description: 'Solved challenges in both JavaScript and Python', icon: '\u{1F30D}' },
  clean_sweep_easy: { type: 'clean_sweep_easy', title: 'Clean Sweep: Easy', description: 'Solved all Easy challenges', icon: '\u{1F9F9}' },
  clean_sweep_medium: { type: 'clean_sweep_medium', title: 'Clean Sweep: Medium', description: 'Solved all Medium challenges', icon: '\u{1F9F9}' },
  ten_solves: { type: 'ten_solves', title: 'Double Digits', description: 'Solved 10 challenges', icon: '\u{1F3C5}' },
  twenty_five_solves: { type: 'twenty_five_solves', title: 'Quarter Century', description: 'Solved 25 challenges', icon: '\u{1F3C6}' },
  fifty_solves: { type: 'fifty_solves', title: 'Half Century', description: 'Solved 50 challenges', icon: '\u{1F3C6}' },
  daily_warrior: { type: 'daily_warrior', title: 'Daily Warrior', description: 'Completed 10 daily challenges', icon: '\u{2694}\u{FE0F}' },
};
