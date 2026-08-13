/**
 * The challenge a brand-new user is routed to as their first hands-on task.
 *
 * Must be an easy `tier: 'onboarding'` challenge so a cold first-timer gets a
 * WIN in session one. `fizzbuzz-budget` is the app's designated onboarding
 * challenge #1 (tier=onboarding, sort_order=1, difficulty=sprint: "any model,
 * one prompt, compete on cost") — winnable by hand yet designed to be solved
 * with a single AI prompt, which pulls the user into the core loop.
 *
 * History: newcomers used to be funneled to `one-shot-csv-parser` (a MEDIUM),
 * which they failed 0/6 and bounced. See ISR-21.
 *
 * NOTE: this constant only reaches the Vite client bundle. Three out-of-bundle
 * mirrors must be kept in sync BY HAND (Functions + static HTML can't import it):
 *   - index.html                          — guest "Try a Challenge" link
 *   - functions/api/retention.ts          — drip email link
 *   - functions/_shared/ensure-profile.ts — welcome notification metadata
 *   - functions/_shared/email/templates.ts — welcome email copy
 */
export const ENTRY_CHALLENGE_ID = 'fizzbuzz-budget';
