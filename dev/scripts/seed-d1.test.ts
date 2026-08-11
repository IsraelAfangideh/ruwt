import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';
import { sampleChallenges } from './seed-d1';
import { challenges } from '../drizzle/schema.d1';
import { createTestDb } from '../functions/_shared/infra/test-db';

/**
 * Guards the seed against the shape errors that make a challenge unsolvable
 * after a re-seed.
 *
 * one-shot-csv-parser sat wrong for months: production ran it in stdin mode
 * with a harness and hidden tests, while the seed described a function-call
 * challenge with `module.exports` and none of those fields. The generator's
 * type could not express the difference, so nothing failed — re-seeding just
 * replaced a working challenge with one that could not pass.
 */

describe('seed challenge shape', () => {
  it('has the challenges', () => {
    expect(sampleChallenges.length).toBeGreaterThan(20);
  });

  it('marks every stdin harness with useStdin', () => {
    // A harness that reads process.stdin but leaves useStdin unset is
    // dispatched as a function call by the judge, and fails every test.
    const wrong = sampleChallenges
      .filter((c) => c.testHarness?.includes('process.stdin') && !c.useStdin)
      .map((c) => c.id);
    expect(wrong).toEqual([]);
  });

  it('gives every useStdin challenge a harness to read that input', () => {
    const wrong = sampleChallenges.filter((c) => c.useStdin && !c.testHarness).map((c) => c.id);
    expect(wrong).toEqual([]);
  });

  it('keeps module.exports out of stdin starter code', () => {
    // The harness calls the function directly, so the export is dead code
    // that also signals the wrong mode to anyone reading the entry.
    const wrong = sampleChallenges
      .filter((c) => c.useStdin && c.starterCode.includes('module.exports'))
      .map((c) => c.id);
    expect(wrong).toEqual([]);
  });

  it('gives every challenge a unique id', () => {
    const ids = sampleChallenges.map((c) => c.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
});

/**
 * The generated statement uses INSERT OR REPLACE, so a column it does not name
 * is reset to its schema default on every re-seed. These run the real artifact
 * against the real schema, which is the only check that sees a dropped column,
 * a column/value mismatch, or broken escaping.
 */
describe('generated seed-d1.sql', () => {
  const sql = readFileSync(join(__dirname, 'seed-d1.sql'), 'utf8');

  /** Columns the generator deliberately leaves at their schema default. */
  const INTENTIONALLY_OMITTED = new Set([
    // Stamped by the database. Re-seeding resets it, which collapses the
    // createdAt tiebreaker in the /api/challenges ordering. Accepted: the
    // seed has no honest value to supply.
    'created_at',
    // Every seed entry is javascript, the column default. Add a field to the
    // generator before adding a python challenge to the array.
    'language',
    // Only set by migration 0039, for challenges this seed does not contain.
    'readonly_prefix',
  ]);

  it('applies cleanly to the real schema', () => {
    const { sqlite } = createTestDb();
    expect(() => sqlite.exec(sql)).not.toThrow();
    const n = sqlite.prepare('SELECT count(*) AS c FROM challenges').get() as { c: number };
    expect(n.c).toBe(sampleChallenges.length);
    sqlite.close();
  });

  it('round-trips a stdin challenge without losing its shape', () => {
    // The regression itself: this row must come back out of a re-seed still
    // runnable, not as a function-call challenge with no harness.
    const { sqlite } = createTestDb();
    sqlite.exec(sql);
    const row = sqlite
      .prepare('SELECT use_stdin, test_harness, hidden_test_cases, starter_code, tier, sort_order, tags, max_cost, wall_clock_limit FROM challenges WHERE id = ?')
      .get('one-shot-csv-parser') as Record<string, unknown>;

    expect(row.use_stdin).toBe(1);
    expect(row.test_harness).toContain('process.stdin');
    expect(row.starter_code).not.toContain('module.exports');
    expect(JSON.parse(row.hidden_test_cases as string)).toHaveLength(3);
    expect(JSON.parse(row.tags as string)).toContain('csv');
    expect(row.tier).toBe('core');
    expect(row.sort_order).toBe(20);
    expect(row.max_cost).toBe(100);
    expect(row.wall_clock_limit).toBe(1800);
    sqlite.close();
  });

  it('preserves the non-default tier of every onboarding and headline entry', () => {
    const { sqlite } = createTestDb();
    sqlite.exec(sql);
    const expected = sampleChallenges.filter((c) => c.tier && c.tier !== 'core');
    expect(expected.length).toBeGreaterThan(0);
    for (const c of expected) {
      const row = sqlite.prepare('SELECT tier FROM challenges WHERE id = ?').get(c.id) as { tier: string };
      expect(row.tier, c.id).toBe(c.tier);
    }
    sqlite.close();
  });

  it('emits every schema column it does not deliberately omit', () => {
    const schemaColumns = Object.values(getTableColumns(challenges)).map((c) => c.name);
    const open = sql.indexOf('(', sql.indexOf('INSERT OR REPLACE INTO challenges ('));
    const emitted = new Set(sql.slice(open + 1, sql.indexOf(')', open)).split(',').map((c) => c.trim()));
    const missing = schemaColumns.filter((c) => !emitted.has(c) && !INTENTIONALLY_OMITTED.has(c));
    expect(missing).toEqual([]);
  });
});
