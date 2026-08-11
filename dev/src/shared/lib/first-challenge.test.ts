import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIRST_CHALLENGE_ID, FIRST_CHALLENGE_TITLE } from './first-challenge';

/**
 * Both constants are copies of database state, so they can go stale silently.
 * Every other test compares the source against the same constant, which means
 * a wrong value agrees with itself and passes. These check against the seed
 * catalogue instead — the first draft of the title constant said "FizzBuzz on
 * a Budget" while the catalogue says "FizzBuzz Budget", and only a check like
 * this one catches that.
 */
const seed = readFileSync(join(__dirname, '../../../scripts/seed-d1.ts'), 'utf8');

describe('FIRST_CHALLENGE_ID', () => {
  it('names a challenge that exists in the catalogue', () => {
    expect(seed).toContain(`id: '${FIRST_CHALLENGE_ID}'`);
  });

  it('is not the challenge nobody could finish', () => {
    // 8 attempts, 0 passes, 4 expired when this was written. Routing new
    // signups there is the mistake these constants exist to prevent.
    expect(FIRST_CHALLENGE_ID).not.toBe('one-shot-csv-parser');
  });
});

describe('FIRST_CHALLENGE_TITLE', () => {
  it('matches the title the catalogue gives that challenge', () => {
    // Find the entry by id, then read the title that follows it.
    const entry = seed.slice(seed.indexOf(`id: '${FIRST_CHALLENGE_ID}'`));
    const title = entry.match(/title:\s*'([^']+)'/)?.[1];
    expect(title).toBe(FIRST_CHALLENGE_TITLE);
  });
});
