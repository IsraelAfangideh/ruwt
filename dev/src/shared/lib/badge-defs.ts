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
  first_solve: { type: 'first_solve', title: 'First Blood', description: 'Solved your first challenge', icon: '🎯' },
  streak_3: { type: 'streak_3', title: 'Getting Warm', description: '3-day daily challenge streak', icon: '🔥' },
  streak_7: { type: 'streak_7', title: 'On Fire', description: '7-day daily challenge streak', icon: '🔥' },
  streak_30: { type: 'streak_30', title: 'Unstoppable', description: '30-day daily challenge streak', icon: '💎' },
  streak_100: { type: 'streak_100', title: 'Legendary', description: '100-day daily challenge streak', icon: '👑' },
  penny_pincher: { type: 'penny_pincher', title: 'Penny Pincher', description: 'Solved a challenge for under $0.01', icon: '💰' },
  speed_demon: { type: 'speed_demon', title: 'Speed Demon', description: 'Solved a timed challenge in under 5 minutes', icon: '⚡' },
  model_master: { type: 'model_master', title: 'Model Master', description: 'Used 5+ different AI models across solves', icon: '🧠' },
  polyglot: { type: 'polyglot', title: 'Polyglot', description: 'Solved challenges in both JavaScript and Python', icon: '🌍' },
  clean_sweep_easy: { type: 'clean_sweep_easy', title: 'Clean Sweep: Easy', description: 'Solved all Easy challenges', icon: '🧹' },
  clean_sweep_medium: { type: 'clean_sweep_medium', title: 'Clean Sweep: Medium', description: 'Solved all Medium challenges', icon: '🧹' },
  ten_solves: { type: 'ten_solves', title: 'Double Digits', description: 'Solved 10 challenges', icon: '🏅' },
  twenty_five_solves: { type: 'twenty_five_solves', title: 'Quarter Century', description: 'Solved 25 challenges', icon: '🏆' },
  fifty_solves: { type: 'fifty_solves', title: 'Half Century', description: 'Solved 50 challenges', icon: '🏆' },
  daily_warrior: { type: 'daily_warrior', title: 'Daily Warrior', description: 'Completed 10 daily challenges', icon: '⚔️' },
  ai_fluent: { type: 'ai_fluent', title: 'AI-Fluent', description: 'Passed 10+ challenges with AFI 400+', icon: '\uD83E\uDD49' },
  ai_fluent_pro: { type: 'ai_fluent_pro', title: 'AI-Fluent Pro', description: 'Passed 25+ challenges across 3+ categories with AFI 550+', icon: '\uD83E\uDD48' },
  ai_fluent_expert: { type: 'ai_fluent_expert', title: 'AI-Fluent Expert', description: 'Passed 50+ challenges across all categories with AFI 700+', icon: '\uD83E\uDD47' },
};
