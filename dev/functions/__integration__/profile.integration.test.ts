/**
 * Integration tests: Profile CRUD operations against real SQLite.
 *
 * These tests use an in-memory SQLite database via better-sqlite3 + Drizzle
 * to verify that profile operations work with real SQL execution, not mocked chains.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, resetDb } from '../_shared/test-db';
import { profiles } from '../../drizzle/schema.d1';

describe('Profile Integration (real SQLite)', () => {
  const { db, sqlite } = createTestDb();

  beforeEach(() => resetDb(sqlite));
  afterAll(() => sqlite.close());

  // ---------------------------------------------------------------------------
  // Insert
  // ---------------------------------------------------------------------------
  it('inserts a new profile with defaults applied', () => {
    db.insert(profiles).values({
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      credits: 50000,
    }).run();

    const [profile] = db.select().from(profiles).where(eq(profiles.id, 'user-1')).all();

    expect(profile).toBeDefined();
    expect(profile.email).toBe('alice@example.com');
    expect(profile.name).toBe('Alice');
    expect(profile.credits).toBe(50000);

    // Verify all SQLite DEFAULT values are applied
    expect(profile.accountType).toBe('individual');
    expect(profile.assessmentCredits).toBe(0);
    expect(profile.currentStreak).toBe(0);
    expect(profile.longestStreak).toBe(0);
    expect(profile.streakFreezes).toBe(0);
    expect(profile.onboardingCompleted).toBe(0);
    expect(profile.newsletterSubscribed).toBe(1);
    expect(profile.leaderboardExcluded).toBe(0);
    expect(profile.trialUsed).toBe(0);
    expect(profile.afiScore).toBe(0);
    expect(profile.afiTier).toBe('novice');
    expect(profile.createdAt).toBeTruthy();
  });

  it('inserts a profile with all optional fields', () => {
    db.insert(profiles).values({
      id: 'user-full',
      email: 'full@example.com',
      name: 'Full User',
      avatarUrl: 'https://example.com/avatar.jpg',
      credits: 100000,
      accountType: 'team',
      username: 'fulluser',
      bio: 'A full user profile',
      linkedinUrl: 'https://linkedin.com/in/fulluser',
      currentStreak: 5,
      longestStreak: 10,
      lastStreakDate: '2026-03-15',
      streakFreezes: 2,
      onboardingCompleted: 1,
      newsletterSubscribed: 0,
      timezone: 'America/New_York',
      preferredMode: 'hiring',
      afiScore: 650,
      afiTier: 'expert',
    }).run();

    const [profile] = db.select().from(profiles).where(eq(profiles.id, 'user-full')).all();

    expect(profile.accountType).toBe('team');
    expect(profile.username).toBe('fulluser');
    expect(profile.bio).toBe('A full user profile');
    expect(profile.currentStreak).toBe(5);
    expect(profile.longestStreak).toBe(10);
    expect(profile.lastStreakDate).toBe('2026-03-15');
    expect(profile.streakFreezes).toBe(2);
    expect(profile.onboardingCompleted).toBe(1);
    expect(profile.newsletterSubscribed).toBe(0);
    expect(profile.timezone).toBe('America/New_York');
    expect(profile.preferredMode).toBe('hiring');
    expect(profile.afiScore).toBe(650);
    expect(profile.afiTier).toBe('expert');
  });

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  it('updates profile fields and verifies persistence', () => {
    db.insert(profiles).values({
      id: 'user-update',
      email: 'update@example.com',
      name: 'Original Name',
      credits: 1000,
    }).run();

    // Update multiple fields
    db.update(profiles)
      .set({
        name: 'Updated Name',
        credits: 2000,
        username: 'updated-user',
        onboardingCompleted: 1,
        bio: 'Updated bio',
      })
      .where(eq(profiles.id, 'user-update'))
      .run();

    const [profile] = db.select().from(profiles).where(eq(profiles.id, 'user-update')).all();

    expect(profile.name).toBe('Updated Name');
    expect(profile.credits).toBe(2000);
    expect(profile.username).toBe('updated-user');
    expect(profile.onboardingCompleted).toBe(1);
    expect(profile.bio).toBe('Updated bio');
    // Unchanged fields should remain
    expect(profile.email).toBe('update@example.com');
    expect(profile.accountType).toBe('individual');
  });

  it('updates streak fields correctly', () => {
    db.insert(profiles).values({
      id: 'user-streak',
      email: 'streak@example.com',
    }).run();

    db.update(profiles)
      .set({
        currentStreak: 7,
        longestStreak: 14,
        lastStreakDate: '2026-03-16',
        streakFreezes: 3,
      })
      .where(eq(profiles.id, 'user-streak'))
      .run();

    const [profile] = db.select().from(profiles).where(eq(profiles.id, 'user-streak')).all();

    expect(profile.currentStreak).toBe(7);
    expect(profile.longestStreak).toBe(14);
    expect(profile.lastStreakDate).toBe('2026-03-16');
    expect(profile.streakFreezes).toBe(3);
  });

  it('updates AFI score and tier', () => {
    db.insert(profiles).values({
      id: 'user-afi',
      email: 'afi@example.com',
    }).run();

    db.update(profiles)
      .set({ afiScore: 720, afiTier: 'master' })
      .where(eq(profiles.id, 'user-afi'))
      .run();

    const [profile] = db.select().from(profiles).where(eq(profiles.id, 'user-afi')).all();
    expect(profile.afiScore).toBe(720);
    expect(profile.afiTier).toBe('master');
  });

  // ---------------------------------------------------------------------------
  // Unique constraint enforcement
  // ---------------------------------------------------------------------------
  it('prevents duplicate emails', () => {
    db.insert(profiles).values({ id: 'u1', email: 'dup@example.com' }).run();

    expect(() => {
      db.insert(profiles).values({ id: 'u2', email: 'dup@example.com' }).run();
    }).toThrow();
  });

  it('prevents duplicate usernames', () => {
    db.insert(profiles).values({ id: 'u1', email: 'a@example.com', username: 'taken' }).run();

    expect(() => {
      db.insert(profiles).values({ id: 'u2', email: 'b@example.com', username: 'taken' }).run();
    }).toThrow();
  });

  it('allows multiple profiles without usernames (null is not unique)', () => {
    db.insert(profiles).values({ id: 'u1', email: 'a@example.com' }).run();
    db.insert(profiles).values({ id: 'u2', email: 'b@example.com' }).run();

    const rows = db.select().from(profiles).all();
    expect(rows).toHaveLength(2);
    expect(rows[0].username).toBeNull();
    expect(rows[1].username).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Query patterns used by profile endpoint
  // ---------------------------------------------------------------------------
  it('selects profile by ID (mirrors GET /api/profile query)', () => {
    db.insert(profiles).values({
      id: 'user-query',
      email: 'query@example.com',
      name: 'Query User',
      credits: 50000,
      username: 'queryuser',
    }).run();

    const [profile] = db
      .select()
      .from(profiles)
      .where(eq(profiles.id, 'user-query'))
      .limit(1)
      .all();

    expect(profile).toBeDefined();
    expect(profile.email).toBe('query@example.com');
    expect(profile.credits).toBe(50000);
  });

  it('checks username uniqueness (mirrors PATCH /api/profile query)', () => {
    db.insert(profiles).values({
      id: 'existing-user',
      email: 'existing@example.com',
      username: 'existing-name',
    }).run();

    // Check if username is taken
    const [existing] = db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.username, 'existing-name'))
      .limit(1)
      .all();

    expect(existing).toBeDefined();
    expect(existing.id).toBe('existing-user');

    // Check for a free username
    const [free] = db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.username, 'free-name'))
      .limit(1)
      .all();

    expect(free).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  it('deletes a profile', () => {
    db.insert(profiles).values({ id: 'u-del', email: 'del@example.com' }).run();

    db.delete(profiles).where(eq(profiles.id, 'u-del')).run();

    const rows = db.select().from(profiles).where(eq(profiles.id, 'u-del')).all();
    expect(rows).toHaveLength(0);
  });
});
