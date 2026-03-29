/**
 * Tests for the in-memory SQLite test database utility.
 * Verifies that createTestDb() produces a working Drizzle instance
 * and that resetDb() properly truncates all tables.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { createTestDb, resetDb } from './test-db';
import { profiles, challenges, attempts, aiCalls, transactions } from '../../../drizzle/schema.d1';
import { eq } from 'drizzle-orm';

describe('test-db utility', () => {
  const { db, sqlite } = createTestDb();
  afterAll(() => sqlite.close());

  it('creates an in-memory database with all tables', () => {
    // Query sqlite_master to verify tables exist
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('profiles');
    expect(tableNames).toContain('challenges');
    expect(tableNames).toContain('attempts');
    expect(tableNames).toContain('ai_calls');
    expect(tableNames).toContain('transactions');
    expect(tableNames).toContain('organizations');
    expect(tableNames).toContain('assessments');
    expect(tableNames).toContain('badges');
    expect(tableNames).toContain('notifications');
    expect(tableNames).toContain('seasons');
    expect(tableNames).toContain('follows');
    expect(tableNames).toContain('bookmarks');
    expect(tableNames).toContain('afi_history');
  });

  it('supports insert and query via Drizzle ORM', () => {
    db.insert(profiles).values({
      id: 'u1',
      email: 'test@example.com',
      name: 'Test User',
      credits: 50000,
    }).run();

    const [row] = db.select().from(profiles).where(eq(profiles.id, 'u1')).all();

    expect(row).toBeDefined();
    expect(row.email).toBe('test@example.com');
    expect(row.name).toBe('Test User');
    expect(row.credits).toBe(50000);
    // Default values applied by SQLite
    expect(row.accountType).toBe('individual');
    expect(row.currentStreak).toBe(0);
    expect(row.newsletterSubscribed).toBe(1);
  });

  it('enforces foreign key constraints', () => {
    expect(() => {
      db.insert(attempts).values({
        id: 'a-orphan',
        userId: 'nonexistent-user',
        challengeId: 'nonexistent-challenge',
        status: 'in_progress',
        testCases: '[]',
      } as any).run();
    }).toThrow(); // FOREIGN KEY constraint failed
  });

  it('enforces unique constraints', () => {
    // Insert first profile
    db.insert(profiles).values({
      id: 'u-unique-1',
      email: 'unique@example.com',
      name: 'First',
    }).run();

    // Inserting duplicate email should fail
    expect(() => {
      db.insert(profiles).values({
        id: 'u-unique-2',
        email: 'unique@example.com',
        name: 'Second',
      }).run();
    }).toThrow(); // UNIQUE constraint failed
  });

  it('resetDb() truncates all rows while preserving schema', () => {
    // Insert data across multiple tables
    db.insert(profiles).values({
      id: 'u-reset',
      email: 'reset@example.com',
      name: 'Reset User',
    }).run();

    db.insert(challenges).values({
      id: 'ch-reset',
      title: 'Test Challenge',
      description: 'A test',
      difficulty: 'easy',
      testCases: '[]',
    }).run();

    // Verify data exists
    expect(db.select().from(profiles).all().length).toBeGreaterThan(0);
    expect(db.select().from(challenges).all().length).toBeGreaterThan(0);

    // Reset
    resetDb(sqlite);

    // All tables should be empty
    expect(db.select().from(profiles).all()).toHaveLength(0);
    expect(db.select().from(challenges).all()).toHaveLength(0);
    expect(db.select().from(attempts).all()).toHaveLength(0);
    expect(db.select().from(aiCalls).all()).toHaveLength(0);
    expect(db.select().from(transactions).all()).toHaveLength(0);
  });

  it('supports updates via Drizzle ORM', () => {
    db.insert(profiles).values({
      id: 'u-update',
      email: 'update@example.com',
      name: 'Before',
      credits: 100,
    }).run();

    db.update(profiles)
      .set({ name: 'After', credits: 200 })
      .where(eq(profiles.id, 'u-update'))
      .run();

    const [row] = db.select().from(profiles).where(eq(profiles.id, 'u-update')).all();
    expect(row.name).toBe('After');
    expect(row.credits).toBe(200);

    resetDb(sqlite);
  });

  it('supports deletes via Drizzle ORM', () => {
    db.insert(profiles).values({
      id: 'u-delete',
      email: 'delete@example.com',
    }).run();

    db.delete(profiles).where(eq(profiles.id, 'u-delete')).run();

    const rows = db.select().from(profiles).where(eq(profiles.id, 'u-delete')).all();
    expect(rows).toHaveLength(0);

    resetDb(sqlite);
  });
});
