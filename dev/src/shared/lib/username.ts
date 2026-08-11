/**
 * The one definition of a valid public handle.
 *
 * Imported by both the client and the Cloudflare Functions, so the rule and
 * the wording cannot drift. Before this existed the pattern was copied into
 * functions/api/profile.ts, functions/api/challenges/[id]/comments.ts,
 * src/shared/social/CommentSection.tsx and the claim UI, and the messages had
 * already diverged.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** Lowercase alphanumerics and hyphens, never leading or trailing. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export const USERNAME_RULE =
  'Lowercase letters, numbers and hyphens. Cannot start or end with a hyphen.';

/** Why the handle is unusable, or null when it is fine. */
export function usernameProblem(value: string): string | null {
  if (value.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters.`;
  if (value.length > USERNAME_MAX) return `At most ${USERNAME_MAX} characters.`;
  if (!USERNAME_PATTERN.test(value)) return USERNAME_RULE;
  return null;
}

/** Trims and lowercases, so '  Israel ' and 'israel' claim the same handle. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}
