/**
 * The challenge a brand-new user is sent to.
 *
 * Six places route or name it — the welcome notification, the welcome email
 * (html and text), the onboarding CTA, the dashboard banner and its button,
 * and the 24h drip email — and each used to hard-code it separately.
 *
 * Chosen from production outcomes on 2026-08-11: fizzbuzz-budget had 43
 * attempts and 23 passes, against one-shot-csv-parser's 8 attempts and none.
 * Re-check the numbers before changing this. A first challenge nobody
 * finishes costs more than one that is slightly too easy.
 */
export const FIRST_CHALLENGE_ID = 'fizzbuzz-budget';

/**
 * Must equal `challenges.title` for FIRST_CHALLENGE_ID. This is a copy of
 * database state, so first-challenge.test.ts asserts the two still agree —
 * the first draft of this file said "FizzBuzz on a Budget" and would have
 * sent users to a page headed something else.
 */
export const FIRST_CHALLENGE_TITLE = 'FizzBuzz Budget';
